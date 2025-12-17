import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req as any);
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

    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;

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
    if (todayCount >= 100)
      return NextResponse.json(
        { message: "今日打卡次数已达上限（100）" },
        { status: 429 }
      );

    const historyPayload: Database["public"]["Tables"]["discussions"]["Insert"] = {
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
    } catch (e) {
      logApiError("POST /api/flags/checkin history insert failed", e);
    }

    let insertedCheckin: Database["public"]["Tables"]["flag_checkins"]["Row"] | null =
      null;
    try {
      const ins = await client
        .from("flag_checkins")
        .insert({
          flag_id: flagId,
          user_id: userId,
          note,
          image_url: imageUrl || null,
        } as Database["public"]["Tables"]["flag_checkins"]["Insert"])
        .select("*")
        .maybeSingle();
      insertedCheckin = ins?.data || null;
    } catch (e) {
      logApiError("POST /api/flags/checkin insert failed", e);
    }

    // Auto-approve logic:
    // 1. If witness_id is 'official' (handled above)
    // 2. If verification_type is 'self' (User manually created self-supervised flag)
    // 3. If the user is the owner AND there is no witness set (implicit self-supervision)
    const isSelfSupervised =
      flag.verification_type === "self" ||
      (!flag.witness_id && flag.user_id === userId);

    if (
      insertedCheckin?.id &&
      ((flag?.verification_type === "witness" &&
        String(flag?.witness_id || "") === "official") ||
        isSelfSupervised)
    ) {
      try {
        await client
          .from("flag_checkins")
          .update({
            review_status: "approved",
            reviewer_id: isSelfSupervised ? "self" : "official",
            reviewed_at: new Date().toISOString(),
          } as Database["public"]["Tables"]["flag_checkins"]["Update"])
          .eq("id", insertedCheckin.id);
      } catch (e) {
        logApiError("POST /api/flags/checkin auto-approve update failed", e);
      }
    }

    // Reward Logic: Randomly reward a sticker (if auto-approved)
    let rewardedSticker = null;
    // Only reward if checkin is approved (official or self)
    if (
      insertedCheckin?.id &&
      ((flag?.verification_type === "witness" &&
        String(flag?.witness_id || "") === "official") ||
        isSelfSupervised)
    ) {
      try {
        // 1. Fetch available stickers (using the stickers table we created)
        const { data: allStickers } = await client.from("stickers").select("*");

        if (allStickers && allStickers.length > 0) {
          // Simple random selection
          const randomSticker =
            allStickers[Math.floor(Math.random() * allStickers.length)];

          // 2. Insert into user_stickers
          const { error: rewardError } = await client
            .from("user_stickers")
            .insert({
              user_id: userId,
              sticker_id: randomSticker.id,
            });

          if (!rewardError) {
            rewardedSticker = randomSticker;
          }
        }
      } catch (e) {
        console.error("Reward error", e);
      }
    }

    // For self-supervised flags, update status to 'success' immediately if checkin is approved
    let newStatus =
      flag.verification_type === "witness" &&
      String(flag?.witness_id || "") !== "official"
        ? "pending_review"
        : "active";

    // IMPORTANT: Check if status update is actually needed.
    // If the flag is already 'success', we should NOT update it back to 'active' or 'pending'.
    // However, if isSelfSupervised is true, we force it to 'success' because that's the point of self-checkin completion.
    if (isSelfSupervised && insertedCheckin?.id) {
      newStatus = "success";
    }

    let { data, error } = await client
      .from("flags")
      .update({
        proof_comment: note || null,
        proof_image_url: imageUrl || null,
        status: newStatus,
      })
      .eq("id", flagId)
      .select("*")
      .maybeSingle();
    if (error) {
      // 容错：部分环境缺少 proof_* 字段，降级仅更新状态
      const fallback = await client
        .from("flags")
        .update({
          status: newStatus,
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
    return NextResponse.json(
      { message: "ok", data, reward: rewardedSticker },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { message: "打卡失败", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
