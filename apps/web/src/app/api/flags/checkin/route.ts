import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";

async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const t = await req.text();
      try {
        return JSON.parse(t);
      } catch {
        return {};
      }
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const t = await req.text();
      const p = new URLSearchParams(t);
      return Object.fromEntries(p.entries());
    }
    const t = await req.text();
    if (t) {
      try {
        return JSON.parse(t);
      } catch {
        return {};
      }
    }
    return {};
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req as any);
    const client = (supabaseAdmin || getClient()) as any;
    if (!client)
      return NextResponse.json({ message: "服务未配置" }, { status: 500 });

    const flagId = Number(body?.flag_id);
    const userId = String(body?.user_id || "").trim();
    const note = String(body?.note || "").trim();
    const imageUrl = String(body?.image_url || "").trim();
    if (!flagId || !userId)
      return NextResponse.json(
        { message: "flag_id 与 user_id 必填" },
        { status: 400 }
      );

    const { data: rawFlag, error: findErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();

    const flag = rawFlag as {
      user_id: string;
      verification_type: string;
      witness_id?: string;
    } | null;

    if (findErr)
      return NextResponse.json(
        { message: "查询失败", detail: findErr.message },
        { status: 500 }
      );
    if (!flag)
      return NextResponse.json({ message: "不存在的 Flag" }, { status: 404 });
    if (String(flag.user_id || "") !== userId)
      return NextResponse.json({ message: "仅创建者可打卡" }, { status: 403 });
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = new Date(start.getTime() + 86400000);
    const startIso = start.toISOString();
    const nextIso = next.toISOString();
    let todayCount = 0;
    const cnt = await client
      .from("flag_checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso)
      .lt("created_at", nextIso);
    if (!cnt.error) {
      todayCount = Number(cnt.count || 0);
    } else {
      const fb = await client
        .from("discussions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", nextIso)
        .ilike("content", "%checkin%");
      if (!fb.error) todayCount = Number(fb.count || 0);
    }
    if (todayCount >= 3)
      return NextResponse.json(
        { message: "今日打卡次数已达上限（3）" },
        { status: 429 }
      );

    const historyPayload = {
      proposal_id: flagId,
      user_id: userId,
      content: JSON.stringify({
        type: "checkin",
        note,
        image_url: imageUrl,
        ts: new Date().toISOString(),
      }),
    };
    try {
      await client.from("discussions").insert(historyPayload);
    } catch {}

    let insertedCheckin: any = null;
    try {
      const ins = await client
        .from("flag_checkins")
        .insert({
          flag_id: flagId,
          user_id: userId,
          note,
          image_url: imageUrl || null,
        })
        .select("*")
        .maybeSingle();
      insertedCheckin = ins?.data || null;
    } catch {}

    if (flag?.verification_type === "witness" && String(flag?.witness_id || "") === "official" && insertedCheckin?.id) {
      try {
        await client
          .from("flag_checkins")
          .update({
            review_status: "approved",
            reviewer_id: "official",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", insertedCheckin.id);
      } catch {}
    }

    // Reward Logic: Randomly reward an emoji
    let rewardedEmoji = null;
    try {
      // 1. Fetch available emojis
      const { data: allEmojis } = await client
        .from("emojis")
        .select("*");
      
      if (allEmojis && allEmojis.length > 0) {
        // Simple random selection
        const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
        
        // 2. Insert into user_emojis
        const { error: rewardError } = await client
            .from("user_emojis")
            .insert({
                user_id: userId,
                emoji_id: randomEmoji.id,
                source: 'checkin'
            });

        if (!rewardError) {
             rewardedEmoji = randomEmoji;
        }
      }
    } catch (e) {
      console.error("Reward error", e);
    }

    let { data, error } = await client
      .from("flags")
      .update({
        proof_comment: note || null,
        proof_image_url: imageUrl || null,
        status:
          flag.verification_type === "witness"
            ? String(flag?.witness_id || "") === "official"
              ? "active"
              : "pending_review"
            : "active",
      })
      .eq("id", flagId)
      .select("*")
      .maybeSingle();
    if (error) {
      // 容错：部分环境缺少 proof_* 字段，降级仅更新状态
      const fallback = await client
        .from("flags")
        .update({
          status:
            flag.verification_type === "witness" ? "pending_review" : "active",
        })
        .eq("id", flagId)
        .select("*")
        .maybeSingle();
      if (fallback.error)
        return NextResponse.json(
          { message: "打卡失败", detail: fallback.error.message },
          { status: 500 }
        );
      data = fallback.data;
    }
    return NextResponse.json({ message: "ok", data, reward: rewardedEmoji }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "打卡失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
