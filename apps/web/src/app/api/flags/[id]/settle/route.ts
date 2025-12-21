import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError } from "@/lib/serverUtils";

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flagId = toNum(id);
    if (!flagId) return NextResponse.json({ message: "flagId is required" }, { status: 400 });
    const body = await parseRequestBody(req as any);
    const settler_id = String(body?.settler_id || "").trim();
    const minDays = Math.max(1, Number(body?.min_days || 10));
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold || 0.8)));

    const client = (supabaseAdmin || getClient()) as any;
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const { data: rawFlag, error: fErr } = await client
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .maybeSingle();
    const flag = rawFlag as Database["public"]["Tables"]["flags"]["Row"] | null;
    if (fErr)
      return NextResponse.json(
        { message: "Failed to query flag", detail: fErr.message },
        { status: 500 }
      );
    if (!flag) return NextResponse.json({ message: "Flag not found" }, { status: 404 });
    const owner = String(flag.user_id || "");
    if (!settler_id || settler_id.toLowerCase() !== owner.toLowerCase())
      return NextResponse.json({ message: "Only the owner can settle this flag" }, { status: 403 });

    const end = new Date(String(flag.deadline));
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    let startDay: Date;
    if (flag.created_at) {
      const c = new Date(String(flag.created_at));
      startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
    } else {
      // 回退：以最早打卡日作为起始
      const first = await client
        .from("flag_checkins")
        .select("created_at")
        .eq("flag_id", flagId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (!first.error && first.data && first.data[0]?.created_at) {
        const c = new Date(String(first.data[0].created_at));
        startDay = new Date(c.getFullYear(), c.getMonth(), c.getDate());
      } else {
        startDay = new Date(endDay.getTime());
      }
    }

    const msDay = 86400000;
    const totalDays = Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / msDay) + 1);

    let approvedDays = 0;
    const { data: approvals, error: aErr } = await client
      .from("flag_checkins")
      .select("created_at")
      .eq("flag_id", flagId)
      .eq("review_status", "approved")
      .gte("created_at", startDay.toISOString())
      .lte("created_at", new Date(endDay.getTime() + msDay - 1).toISOString());
    if (!aErr && approvals) {
      const set = new Set<string>();
      for (const r of approvals) {
        const d = new Date(String(r.created_at));
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        set.add(key);
      }
      approvedDays = set.size;
    } else {
      // 回退：没有专用表时，以 discussions 中的打卡视为通过
      const { data: ds, error: dErr } = await client
        .from("discussions")
        .select("content,created_at")
        .eq("proposal_id", flagId)
        .gte("created_at", startDay.toISOString())
        .lte("created_at", new Date(endDay.getTime() + msDay - 1).toISOString());
      if (!dErr && ds) {
        const set = new Set<string>();
        for (const r of ds) {
          try {
            const obj = JSON.parse(String(r.content || "{}"));
            if (obj?.type === "checkin") {
              const d = new Date(String(r.created_at));
              const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
              set.add(key);
            }
          } catch {}
        }
        approvedDays = set.size;
      }
    }

    const ratio = approvedDays / totalDays;
    const status = ratio >= threshold && approvedDays >= minDays ? "success" : "failed";
    const metrics = {
      approvedDays,
      totalDays,
      ratio,
      threshold,
      minDays,
      startDay: startDay.toISOString(),
      endDay: endDay.toISOString(),
    };

    await client.from("flags").update({ status }).eq("id", flagId);
    try {
      await client.from("flag_settlements").insert({
        flag_id: flagId,
        status,
        strategy: "ratio_threshold",
        metrics,
        settled_by: settler_id,
        settled_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["flag_settlements"]["Insert"]);

      if (status === "success") {
        const stickers = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
        const stickerId = stickers[Math.floor(Math.random() * stickers.length)];

        await client.from("user_stickers").insert({
          user_id: owner,
          sticker_id: stickerId,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      logApiError("POST /api/flags/[id]/settle settlement insert failed", e);
    }

    return NextResponse.json({ status, metrics }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to settle flag", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
