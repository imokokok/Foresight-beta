import { NextRequest, NextResponse } from "next/server";
import { supabase, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import { parseRequestBody, logApiError, getSessionAddress } from "@/lib/serverUtils";

export async function GET(req: NextRequest) {
  try {
    const client = supabase || getClient();
    if (!client) return NextResponse.json({ flags: [] }, { status: 200 });

    const viewer = await getSessionAddress(req);
    if (!viewer) return NextResponse.json({ flags: [] }, { status: 200 });

    const { data, error } = await client
      .from("flags")
      .select("*")
      .or(`user_id.eq.${viewer},witness_id.eq.${viewer}`)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ flags: [] }, { status: 200 });
    return NextResponse.json({ flags: data || [] }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch flags";
    return NextResponse.json({ flags: [], message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const client = (supabase || getClient()) as any;
    if (!client) return NextResponse.json({ message: "Service not configured" }, { status: 500 });

    const ownerId = await getSessionAddress(req);
    if (!ownerId)
      return NextResponse.json(
        { message: "Unauthorized", detail: "Missing session address" },
        { status: 401 }
      );

    const title = String(body?.title || "").trim();
    const description = String(body?.description || "");
    const deadlineRaw = String(body?.deadline || "").trim();
    const verification_type =
      String(body?.verification_type || "self") === "witness" ? "witness" : "self";
    const witness_id = String(body?.witness_id || "").trim();
    if (!title)
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 });

    let deadline: Date;
    if (!deadlineRaw) {
      const now = new Date();
      deadline = new Date(now.getTime() + 30 * 86400000);
    } else {
      deadline = new Date(deadlineRaw);
      if (Number.isNaN(deadline.getTime()))
        return NextResponse.json({ message: "Invalid deadline format" }, { status: 400 });
    }

    const payload: Database["public"]["Tables"]["flags"]["Insert"] = {
      user_id: ownerId,
      title,
      description,
      deadline: deadline.toISOString(),
      verification_type,
      status: "active",
    };
    let data: Database["public"]["Tables"]["flags"]["Row"] | null = null;
    let error: { message?: string } | null = null;
    if (witness_id) {
      const res = await client
        .from("flags")
        .insert({ ...payload, witness_id } as never)
        .select("*")
        .maybeSingle();
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
      if (error) {
        const res2 = await client
          .from("flags")
          .insert(payload as never)
          .select("*")
          .maybeSingle();
        data = res2.data as Database["public"]["Tables"]["flags"]["Row"] | null;
        error = res2.error;
      }
    } else {
      const res = await client
        .from("flags")
        .insert(payload as never)
        .select("*")
        .maybeSingle();
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
    }
    if (error)
      return NextResponse.json(
        { message: "Failed to create flag", detail: error.message },
        { status: 500 }
      );
    try {
      if (witness_id && data && data.id) {
        const flagIdNum = data.id;
        const invitePayload: Database["public"]["Tables"]["discussions"]["Insert"] = {
          proposal_id: flagIdNum,
          user_id: witness_id,
          content: JSON.stringify({
            type: "witness_invite",
            flag_id: flagIdNum,
            owner_id: ownerId,
            title,
            description,
            deadline: String(data.deadline || ""),
            ts: new Date().toISOString(),
          }),
        };
        await client.from("discussions").insert(invitePayload as never);
      }
    } catch (e) {
      logApiError("POST /api/flags witness invite insert failed", e);
    }
    return NextResponse.json({ message: "ok", data }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "Failed to create flag", detail }, { status: 500 });
  }
}
