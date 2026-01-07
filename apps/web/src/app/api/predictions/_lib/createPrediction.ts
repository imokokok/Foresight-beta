import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import type { PredictionRow } from "./types";
import { buildDiceBearUrl } from "@/lib/dicebear";
import {
  isAdminProfile,
  assertPositiveNumber,
  assertRequiredFields,
  assertValidOutcomes,
  resolveAndVerifyWalletAddress,
  resolveImageUrl,
} from "./validators";

export type CreatePredictionResult = {
  newPrediction: PredictionRow;
};

export async function createPredictionFromRequest(
  request: NextRequest,
  client: SupabaseClient<Database>
): Promise<CreatePredictionResult> {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);

  const { walletAddress } = await resolveAndVerifyWalletAddress(request, body);

  assertRequiredFields(body as Record<string, unknown>, [
    "title",
    "description",
    "category",
    "deadline",
    "minStake",
    "criteria",
  ]);
  assertPositiveNumber((body as Record<string, unknown>).minStake, "minStake");

  const { data: prof, error: profErr } = await (client as any)
    .from("user_profiles")
    .select("is_admin")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  const isAdmin = !profErr && isAdminProfile(prof, walletAddress);
  if (!isAdmin) {
    const err = new Error("Admin permission is required");
    (err as any).status = 403;
    throw err;
  }

  // duplicate title check
  const { data: existingPredictions, error: checkError } = await (client as any)
    .from("predictions")
    .select("id, title, description, category, deadline, status")
    .eq("title", (body as Record<string, unknown>).title);

  if (checkError) {
    const err = new Error("Failed to check prediction");
    (err as any).status = 500;
    throw err;
  }

  if (existingPredictions && existingPredictions.length > 0) {
    const err = new Error(
      "A prediction with the same title already exists. Please change the title or delete existing events."
    );
    (err as any).status = 409;
    (err as any).duplicateEvents = existingPredictions.map((event: any) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      status: event.status,
      deadline: event.deadline,
    }));
    throw err;
  }

  const imageUrl = resolveImageUrl(body as Record<string, unknown>, buildDiceBearUrl);
  const { type, outcomes } = assertValidOutcomes(body as Record<string, unknown>);

  const nextId = await getNextPredictionId(client);

  const { data: newPrediction, error } = await (client as any)
    .from("predictions")
    .insert({
      id: nextId,
      title: (body as Record<string, unknown>).title,
      description: (body as Record<string, unknown>).description,
      category: (body as Record<string, unknown>).category,
      deadline: (body as Record<string, unknown>).deadline,
      min_stake: (body as Record<string, unknown>).minStake,
      criteria: (body as Record<string, unknown>).criteria,
      reference_url: (body as Record<string, unknown>).reference_url || "",
      image_url: imageUrl,
      status: "active",
      type: type === "multi" ? "multi" : "binary",
      outcome_count: type === "multi" ? outcomes.length : 2,
    })
    .select()
    .single();

  if (error) throw error;

  await insertOutcomes(client, newPrediction.id, type, outcomes);

  return { newPrediction };
}

async function getNextPredictionId(client: SupabaseClient): Promise<number> {
  const { data: maxIdData, error } = await (client as any)
    .from("predictions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;
  return maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1;
}

async function insertOutcomes(
  client: SupabaseClient,
  predictionId: number,
  type: "binary" | "multi",
  outcomes: any[]
) {
  try {
    const items =
      type === "multi"
        ? outcomes.map((o: any, i: number) => ({
            prediction_id: predictionId,
            outcome_index: i,
            label: String(o?.label || "").trim(),
            description: o?.description || null,
            color: o?.color || null,
            image_url: o?.image_url || null,
          }))
        : [
            { prediction_id: predictionId, outcome_index: 0, label: "Yes" },
            { prediction_id: predictionId, outcome_index: 1, label: "No" },
          ];

    const { error } = await (client as any).from("prediction_outcomes").insert(items);
    if (error) {
      console.warn("Failed to insert prediction outcomes:", error);
    }
  } catch (e) {
    console.warn("Unexpected error while inserting prediction outcomes:", e);
  }
}
