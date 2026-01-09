import { NextRequest, NextResponse } from "next/server";
import { supabase, getClient } from "@/lib/supabase";
import { Database } from "@/lib/database.types";
import {
  parseRequestBody,
  logApiError,
  getSessionAddress,
  normalizeAddress,
} from "@/lib/serverUtils";
import { ApiResponses } from "@/lib/apiResponse";

function isEvmAddress(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const client = supabase || getClient();
    if (!client) return NextResponse.json({ flags: [] }, { status: 200 });

    const sessionViewer = await getSessionAddress(req);
    const { searchParams } = new URL(req.url);
    const viewerParam = searchParams.get("viewer") || searchParams.get("address") || "";
    const viewer =
      sessionViewer || (isEvmAddress(viewerParam) ? normalizeAddress(viewerParam) : "");
    if (!viewer) return NextResponse.json({ flags: [] }, { status: 200 });

    const { data, error } = await client
      .from("flags")
      .select("*")
      .or(`user_id.eq.${viewer},witness_id.eq.${viewer}`)
      .order("created_at", { ascending: false });
    if (error) {
      return ApiResponses.databaseError("Failed to fetch flags", error.message);
    }
    return NextResponse.json({ flags: data || [] }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to fetch flags";
    return ApiResponses.internalError(
      "Failed to fetch flags",
      process.env.NODE_ENV === "development" ? message : undefined
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseRequestBody(req);
    const client = (supabase || getClient()) as any;
    if (!client) return ApiResponses.internalError("Service not configured");

    const ownerId = await getSessionAddress(req);
    if (!ownerId) return ApiResponses.unauthorized("Unauthorized");

    const title = String(body?.title || "").trim();
    const description = String(body?.description || "");
    const deadlineRaw = String(body?.deadline || "").trim();
    const verification_type =
      String(body?.verification_type || "self") === "witness" ? "witness" : "self";
    const witness_id = String(body?.witness_id || "").trim();
    if (!title) return ApiResponses.invalidParameters("Missing required parameters");
    const witnessIdToUse = verification_type === "witness" ? witness_id : "";
    if (verification_type === "witness") {
      const isOfficialWitness = witnessIdToUse === "official";
      const isValidWitnessAddress = isEvmAddress(witnessIdToUse);
      if (!witnessIdToUse || (!isOfficialWitness && !isValidWitnessAddress)) {
        return ApiResponses.invalidParameters("Invalid witness_id");
      }
    }

    let deadline: Date;
    if (!deadlineRaw) {
      const now = new Date();
      deadline = new Date(now.getTime() + 30 * 86400000);
    } else {
      deadline = new Date(deadlineRaw);
      if (Number.isNaN(deadline.getTime()))
        return ApiResponses.invalidParameters("Invalid deadline format");
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
    if (witnessIdToUse) {
      const res = await client
        .from("flags")
        .insert({
          ...payload,
          witness_id: isEvmAddress(witnessIdToUse)
            ? normalizeAddress(witnessIdToUse)
            : witnessIdToUse,
        } as never)
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
    if (error) return ApiResponses.databaseError("Failed to create flag", error.message);
    try {
      if (witnessIdToUse && witnessIdToUse !== "official" && data && data.id) {
        const flagIdNum = data.id;
        const recipient = normalizeAddress(witnessIdToUse);
        try {
          await (client as any).from("notifications").insert({
            recipient_id: recipient,
            type: "witness_invite",
            title: "",
            message: "",
            url: "/flags",
            dedupe_key: `witness_invite:${flagIdNum}`,
            actor_id: ownerId,
            payload: {
              flag_id: flagIdNum,
              owner_id: ownerId,
              title,
              description,
              deadline: String(data.deadline || ""),
              ts: new Date().toISOString(),
            },
          });
        } catch (e) {
          logApiError("POST /api/flags witness invite notification insert failed", e);
        }
        const invitePayload: Database["public"]["Tables"]["discussions"]["Insert"] = {
          proposal_id: flagIdNum,
          user_id: witnessIdToUse,
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
    return ApiResponses.internalError(
      "Failed to create flag",
      process.env.NODE_ENV === "development" ? detail : undefined
    );
  }
}
