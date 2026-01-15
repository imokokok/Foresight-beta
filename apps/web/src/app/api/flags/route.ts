import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase.server";
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
    const client = supabaseAdmin;
    if (!client) return NextResponse.json({ flags: [] }, { status: 200 });

    const sessionViewerRaw = await getSessionAddress(req);
    const sessionViewer = isEvmAddress(sessionViewerRaw) ? normalizeAddress(sessionViewerRaw) : "";
    if (!sessionViewer) return NextResponse.json({ flags: [] }, { status: 200 });

    const { data, error } = await client
      .from("flags")
      .select("*")
      .or(`user_id.eq.${sessionViewer},witness_id.eq.${sessionViewer}`)
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
    const client = supabaseAdmin as any;
    if (!client) return ApiResponses.internalError("Service not configured");

    const ownerId = await getSessionAddress(req);
    if (!isEvmAddress(ownerId)) return ApiResponses.unauthorized("Unauthorized");

    const title = String(body?.title || "").trim();
    const description = String(body?.description || "");
    const deadlineRaw = String(body?.deadline || "").trim();
    const rawPredictionId = body?.prediction_id;
    const predictionId =
      typeof rawPredictionId === "number"
        ? rawPredictionId
        : typeof rawPredictionId === "string"
          ? Number(rawPredictionId)
          : null;
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

    let predictionIdToUse: number | null = null;
    if (typeof predictionId === "number" && Number.isFinite(predictionId)) {
      const { data: predictionRow, error: pErr } = await client
        .from("predictions")
        .select("id")
        .eq("id", predictionId)
        .maybeSingle();
      if (pErr) return ApiResponses.databaseError("Failed to validate prediction_id", pErr.message);
      if (!predictionRow?.id) return ApiResponses.invalidParameters("Invalid prediction_id");
      predictionIdToUse = predictionId;
    }

    const payload: Database["public"]["Tables"]["flags"]["Insert"] = {
      user_id: ownerId,
      prediction_id: predictionIdToUse,
      title,
      description,
      deadline: deadline.toISOString(),
      verification_type,
      status: "active",
    };
    let data: Database["public"]["Tables"]["flags"]["Row"] | null = null;
    let error: { message?: string } | null = null;
    const shouldRetryWithoutPredictionId = (err?: { message?: string } | null) => {
      const msg = String(err?.message || "").toLowerCase();
      return (
        msg.includes("prediction_id") &&
        (msg.includes("could not find") ||
          (msg.includes("column") && msg.includes("does not exist")) ||
          msg.includes("schema cache"))
      );
    };

    const payloadWithoutPredictionId = { ...payload, prediction_id: null };

    if (witnessIdToUse) {
      const insertWithWitness = async (
        usePredictionId: boolean
      ): Promise<{ data: any; error: any }> => {
        const base = usePredictionId ? payload : payloadWithoutPredictionId;
        return await client
          .from("flags")
          .insert({
            ...base,
            witness_id: isEvmAddress(witnessIdToUse)
              ? normalizeAddress(witnessIdToUse)
              : witnessIdToUse,
          } as never)
          .select("*")
          .maybeSingle();
      };

      const res = await insertWithWitness(true);
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
      if (error && predictionIdToUse !== null && shouldRetryWithoutPredictionId(error)) {
        const resRetry = await insertWithWitness(false);
        data = resRetry.data as Database["public"]["Tables"]["flags"]["Row"] | null;
        error = resRetry.error;
      }
      if (error) {
        const res2 = await client
          .from("flags")
          .insert(payload as never)
          .select("*")
          .maybeSingle();
        data = res2.data as Database["public"]["Tables"]["flags"]["Row"] | null;
        error = res2.error;
        if (error && predictionIdToUse !== null && shouldRetryWithoutPredictionId(error)) {
          const res2Retry = await client
            .from("flags")
            .insert(payloadWithoutPredictionId as never)
            .select("*")
            .maybeSingle();
          data = res2Retry.data as Database["public"]["Tables"]["flags"]["Row"] | null;
          error = res2Retry.error;
        }
      }
    } else {
      const insertNoWitness = async (
        usePredictionId: boolean
      ): Promise<{ data: any; error: any }> =>
        await client
          .from("flags")
          .insert((usePredictionId ? payload : payloadWithoutPredictionId) as never)
          .select("*")
          .maybeSingle();

      const res = await insertNoWitness(true);
      data = res.data as Database["public"]["Tables"]["flags"]["Row"] | null;
      error = res.error;
      if (error && predictionIdToUse !== null && shouldRetryWithoutPredictionId(error)) {
        const resRetry = await insertNoWitness(false);
        data = resRetry.data as Database["public"]["Tables"]["flags"]["Row"] | null;
        error = resRetry.error;
      }
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
          user_id: recipient,
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
