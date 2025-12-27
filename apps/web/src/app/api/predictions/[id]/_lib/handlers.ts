import { NextResponse, type NextRequest } from "next/server";
import { getClient } from "@/lib/supabase";
import { normalizeAddress, logApiError } from "@/lib/serverUtils";
import { requireAdmin } from "./admin";
import { computeProbabilities, fetchPredictionStats, toPredictionStatsResponse } from "./stats";
import { getTimeAgo, getTimeRemaining } from "./time";
import { parseIncludeOutcomesParam, parseIncludeStatsParam, parsePredictionId } from "./validators";
import { ApiResponses } from "@/lib/apiResponse";

export async function handleGetPredictionDetail(request: NextRequest, id: string) {
  try {
    const url = new URL(request.url);
    const includeStats = parseIncludeStatsParam(url.searchParams.get("includeStats"));
    const includeOutcomes = parseIncludeOutcomesParam(url.searchParams.get("includeOutcomes"));

    const predictionId = parsePredictionId(id);
    if (!predictionId) {
      return ApiResponses.invalidParameters("Invalid prediction id");
    }

    const client = getClient() as any;
    if (!client) {
      return ApiResponses.internalError("Supabase client is not configured");
    }

    const sel = includeOutcomes ? "*, outcomes:prediction_outcomes(*)" : "*";
    const { data: prediction, error } = await (client as any)
      .from("predictions")
      .select(sel)
      .eq("id", predictionId)
      .single();

    if (error) {
      if ((error as any)?.code === "PGRST116") {
        return ApiResponses.notFound("Prediction not found");
      }
      logApiError("GET /api/predictions/[id] detail query failed", error);
      return ApiResponses.databaseError("Failed to fetch prediction detail", error.message);
    }

    let stats = {
      yesAmount: 0,
      noAmount: 0,
      totalAmount: 0,
      participantCount: 0,
      yesProbability: 0.5,
      noProbability: 0.5,
      betCount: 0,
    };

    if (includeStats) {
      const base = await fetchPredictionStats(client, predictionId);
      const probs = computeProbabilities(base);
      stats = toPredictionStatsResponse({ ...base, ...probs });
    }

    const predictionDetail = {
      id: prediction.id,
      title: prediction.title,
      description: prediction.description,
      category: prediction.category,
      deadline: prediction.deadline,
      minStake: prediction.min_stake,
      criteria: prediction.criteria,
      referenceUrl: prediction.reference_url,
      status: prediction.status,
      createdAt: prediction.created_at,
      updatedAt: prediction.updated_at,
      stats,
      timeInfo: {
        createdAgo: getTimeAgo(prediction.created_at),
        deadlineIn: getTimeRemaining(prediction.deadline),
        isExpired: new Date(prediction.deadline) < new Date(),
      },
      type: prediction.type,
      outcome_count: prediction.outcome_count,
      outcomes: includeOutcomes
        ? ((prediction as any)?.outcomes || []).sort(
            (a: any, b: any) => (a.outcome_index || 0) - (b.outcome_index || 0)
          )
        : undefined,
    };

    return NextResponse.json(
      { success: true, data: predictionDetail, message: "Prediction detail fetched successfully" },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=5, stale-while-revalidate=20",
        },
      }
    );
  } catch (error: any) {
    logApiError("GET /api/predictions/[id] detail unhandled error", error);
    const detail = error?.message || String(error);
    return ApiResponses.internalError("Failed to fetch prediction detail", detail);
  }
}

export async function handlePatchPrediction(request: NextRequest, id: string) {
  try {
    const predictionId = parsePredictionId(id);
    if (!predictionId) {
      return ApiResponses.invalidParameters("Invalid prediction id");
    }
    const body = await request.json().catch(() => ({}));

    const client = getClient() as any;
    if (!client) {
      return ApiResponses.internalError("Supabase client is not configured");
    }

    const admin = await requireAdmin({
      request,
      client,
      allowWalletFromBody: normalizeAddress(String((body as any).walletAddress || "")),
    });
    if (!admin.ok) return admin.response;

    const upd: any = {};
    if (typeof (body as any).title === "string") upd.title = (body as any).title;
    if (typeof (body as any).description === "string") upd.description = (body as any).description;
    if (typeof (body as any).category === "string") upd.category = (body as any).category;
    if (typeof (body as any).deadline === "string") upd.deadline = (body as any).deadline;
    if (typeof (body as any).minStake !== "undefined")
      upd.min_stake = Number((body as any).minStake);
    if (typeof (body as any).criteria === "string") upd.criteria = (body as any).criteria;
    if (typeof (body as any).reference_url === "string")
      upd.reference_url = (body as any).reference_url;
    if (typeof (body as any).image_url === "string") upd.image_url = (body as any).image_url;
    if (typeof (body as any).status === "string") upd.status = (body as any).status;
    if (Object.keys(upd).length === 0) {
      return ApiResponses.invalidParameters("No fields to update");
    }

    const { data, error } = await client
      .from("predictions")
      .update(upd)
      .eq("id", predictionId)
      .select("*")
      .maybeSingle();
    if (error) {
      logApiError("PATCH /api/predictions/[id] update failed", error);
      return ApiResponses.databaseError("Failed to update prediction", error.message);
    }
    return NextResponse.json(
      { success: true, data, message: "Prediction updated successfully" },
      { status: 200 }
    );
  } catch (e: any) {
    logApiError("PATCH /api/predictions/[id] unhandled error", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError("Failed to update prediction", detail);
  }
}

export async function handleDeletePrediction(request: NextRequest, id: string) {
  try {
    const predictionId = parsePredictionId(id);
    if (!predictionId) {
      return ApiResponses.invalidParameters("Invalid prediction id");
    }
    const client = getClient() as any;
    if (!client) {
      return ApiResponses.internalError("Supabase client is not configured");
    }

    const admin = await requireAdmin({ request, client });
    if (!admin.ok) return admin.response;

    const { error } = await client.from("predictions").delete().eq("id", predictionId);
    if (error) {
      logApiError("DELETE /api/predictions/[id] delete failed", error);
      return ApiResponses.databaseError("Failed to delete prediction", error.message);
    }
    return NextResponse.json({ success: true, message: "Prediction deleted" }, { status: 200 });
  } catch (e: any) {
    logApiError("DELETE /api/predictions/[id] unhandled error", e);
    const detail = String(e?.message || e);
    return ApiResponses.internalError("Failed to delete prediction", detail);
  }
}
