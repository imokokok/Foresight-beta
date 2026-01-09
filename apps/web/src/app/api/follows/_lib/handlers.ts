import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import {
  getSessionAddress,
  logApiError,
  normalizeAddress,
  parseRequestBody,
} from "@/lib/serverUtils";
import {
  isEventIdForeignKeyViolation,
  isMissingRelation,
  isOnConflictNoUniqueConstraint,
  isUserIdForeignKeyViolation,
  isUserIdTypeIntegerError,
} from "./errors";
import {
  SQL_CREATE_EVENT_FOLLOWS_TABLE,
  SQL_DROP_USER_ID_FK,
  SQL_FIX_USER_ID_AND_UNIQUE,
  SQL_FIX_USER_ID_TYPE_ONLY,
} from "./sql";
import { parsePredictionId, parseWalletAddressStrict } from "./validators";
import type { NextRequest } from "next/server";

function supabaseNotConfigured() {
  return ApiResponses.internalError(
    "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please set it in .env.local and restart the dev server."
  );
}

export async function handleFollowsPost(req: NextRequest) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const body = await parseRequestBody(req);
    const rawPredictionId = body?.predictionId ?? body?.eventId ?? body?.event_id;
    const rawWallet = body?.walletAddress ?? body?.userId ?? body?.user_id;
    const predictionId = parsePredictionId(rawPredictionId);
    const sessionAddress = await getSessionAddress(req);
    const sessionWallet = sessionAddress ? normalizeAddress(sessionAddress) : "";
    if (!sessionWallet) {
      return ApiResponses.unauthorized("Unauthorized");
    }
    const { walletAddress: bodyWallet } = parseWalletAddressStrict(rawWallet);

    if (!predictionId) {
      return ApiResponses.badRequest("predictionId is required and must be a number", {
        received: String(rawPredictionId ?? ""),
      });
    }
    if (rawWallet && bodyWallet && bodyWallet !== sessionWallet) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    const { count: pidCount, error: pidCheckError } = await supabaseAdmin
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .eq("id", predictionId);

    if (pidCheckError) {
      logApiError("POST /api/follows check prediction error", {
        predictionId,
        message: pidCheckError?.message,
      });
      return ApiResponses.databaseError(
        "Failed to read prediction on server, please try again later",
        pidCheckError.message
      );
    }
    if (!pidCount) {
      return ApiResponses.notFound(
        "predictionId does not exist; the prediction has been deleted or has not been created"
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_follows")
      .upsert(
        {
          user_id: sessionWallet,
          event_id: predictionId,
        } as Database["public"]["Tables"]["event_follows"]["Insert"] as never,
        {
          onConflict: "user_id,event_id",
        }
      )
      .select()
      .maybeSingle();

    if (error) {
      logApiError("POST /api/follows upsert error", {
        predictionId,
        walletAddress: sessionWallet,
        message: error?.message,
      });

      if (
        isMissingRelation(error) ||
        isUserIdForeignKeyViolation(error) ||
        isUserIdTypeIntegerError(error)
      ) {
        if (isMissingRelation(error)) {
          return ApiResponses.databaseError(
            "Missing event_follows table. Please run the following SQL in Supabase console and retry",
            {
              setupRequired: true,
              sql: SQL_CREATE_EVENT_FOLLOWS_TABLE,
            }
          );
        }
        if (isUserIdForeignKeyViolation(error)) {
          return ApiResponses.databaseError(
            "Foreign key constraint on event_follows.user_id is incorrect. Please change it to a unique key on TEXT type",
            {
              setupRequired: true,
              detail: error.message,
              sql: `${SQL_DROP_USER_ID_FK}\n${SQL_FIX_USER_ID_AND_UNIQUE}`,
            }
          );
        }
        if (isUserIdTypeIntegerError(error)) {
          return ApiResponses.databaseError(
            "event_follows.user_id column type is incorrect. Please change it to TEXT and add a unique index",
            {
              setupRequired: true,
              detail: error.message,
              sql: SQL_FIX_USER_ID_AND_UNIQUE,
            }
          );
        }
      }

      if (isOnConflictNoUniqueConstraint(error)) {
        const { count: existCount, error: existError } = await supabaseAdmin
          .from("event_follows")
          .select("*", { count: "exact", head: true })
          .eq("user_id", sessionWallet)
          .eq("event_id", predictionId);

        if (existError) {
          if (
            isMissingRelation(existError) ||
            isUserIdForeignKeyViolation(existError) ||
            isUserIdTypeIntegerError(existError)
          ) {
            return ApiResponses.databaseError(
              "Follow failed, please fix the table structure and retry",
              {
                setupRequired: true,
                detail: existError.message,
                sql: SQL_FIX_USER_ID_AND_UNIQUE,
              }
            );
          }
          return ApiResponses.databaseError("Failed to follow prediction", existError.message);
        }

        if (existCount && existCount > 0) {
          return successResponse(
            { follow: { user_id: sessionWallet, event_id: predictionId } },
            "Already followed"
          );
        }

        const { data: insData, error: insError } = await supabaseAdmin
          .from("event_follows")
          .insert({
            user_id: sessionWallet,
            event_id: predictionId,
          } as Database["public"]["Tables"]["event_follows"]["Insert"] as never)
          .select()
          .maybeSingle();

        if (insError) {
          if (
            isMissingRelation(insError) ||
            isUserIdForeignKeyViolation(insError) ||
            isUserIdTypeIntegerError(insError)
          ) {
            return ApiResponses.databaseError(
              "Follow failed, please fix the table structure and retry",
              {
                setupRequired: true,
                detail: insError.message,
                sql: SQL_FIX_USER_ID_AND_UNIQUE,
              }
            );
          }
          if (isEventIdForeignKeyViolation(insError)) {
            return ApiResponses.badRequest(
              "Invalid predictionId: prediction does not exist or was deleted (foreign key)",
              { detail: insError.message }
            );
          }
          return ApiResponses.databaseError("Failed to follow prediction", insError.message);
        }

        return successResponse({ follow: insData }, "Already followed");
      }

      if (isEventIdForeignKeyViolation(error)) {
        return ApiResponses.badRequest(
          "Invalid predictionId: prediction does not exist or was deleted (foreign key)",
          {
            detail: error.message,
            hint: "If this predictionId exists in the list but is still reported invalid, please check that event_follows.event_id foreign key points to public.predictions(id) and SUPABASE_* env config matches the frontend.",
          }
        );
      }

      return ApiResponses.databaseError("Failed to follow prediction", error.message);
    }

    return successResponse({ follow: data }, "Already followed");
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return ApiResponses.internalError("Failed to process request", detail);
  }
}

export async function handleFollowsDelete(req: NextRequest) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const body = await parseRequestBody(req);
    const predictionId = Number(body?.predictionId ?? body?.eventId ?? body?.event_id);
    const rawWallet = body?.walletAddress ?? body?.userId ?? body?.user_id;
    const sessionAddress = await getSessionAddress(req);
    const sessionWallet = sessionAddress ? normalizeAddress(sessionAddress) : "";
    if (!sessionWallet) {
      return ApiResponses.unauthorized("Unauthorized");
    }
    const { walletAddress: bodyWallet } = parseWalletAddressStrict(rawWallet);

    if (!predictionId) return ApiResponses.badRequest("predictionId is required");
    if (rawWallet && bodyWallet && bodyWallet !== sessionWallet) {
      return ApiResponses.forbidden("walletAddress mismatch");
    }

    const { error } = await supabaseAdmin
      .from("event_follows")
      .delete()
      .eq("user_id", sessionWallet)
      .eq("event_id", predictionId);

    if (error) {
      if (
        isMissingRelation(error) ||
        isUserIdForeignKeyViolation(error) ||
        isUserIdTypeIntegerError(error)
      ) {
        if (isMissingRelation(error)) {
          return ApiResponses.databaseError(
            "Missing event_follows table. Please create it and retry.",
            {
              setupRequired: true,
              sql: `
CREATE TABLE IF NOT EXISTS public.event_follows (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);`,
            }
          );
        }
        if (isUserIdForeignKeyViolation(error)) {
          return ApiResponses.databaseError(
            "Foreign key constraint on event_follows.user_id is incorrect. Please drop it and change column type to TEXT.",
            {
              setupRequired: true,
              detail: error.message,
              sql: SQL_DROP_USER_ID_FK,
            }
          );
        }
        if (isUserIdTypeIntegerError(error)) {
          return ApiResponses.databaseError(
            "event_follows.user_id column type is integer. It must be TEXT.",
            {
              setupRequired: true,
              detail: error.message,
              sql: SQL_FIX_USER_ID_TYPE_ONLY,
            }
          );
        }
      }
      return ApiResponses.databaseError("Failed to unfollow prediction", error.message);
    }

    return successResponse({ ok: true }, "Unfollowed successfully");
  } catch (e: any) {
    return ApiResponses.internalError("Failed to process request", String(e?.message || e));
  }
}

export async function handleFollowsGet(req: NextRequest) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const { searchParams } = new URL(req.url);
    const predictionId = Number(searchParams.get("predictionId"));
    const sessionAddress = await getSessionAddress(req);
    const sessionWallet = sessionAddress ? normalizeAddress(sessionAddress) : "";

    if (!predictionId) {
      return ApiResponses.badRequest("predictionId is required");
    }

    const { count, error: countError } = await supabaseAdmin
      .from("event_follows")
      .select("*", { count: "exact", head: true })
      .eq("event_id", predictionId);

    if (countError) {
      if (
        isMissingRelation(countError) ||
        isUserIdForeignKeyViolation(countError) ||
        isUserIdTypeIntegerError(countError)
      ) {
        return ApiResponses.databaseError("Count query failed, please fix the table structure", {
          setupRequired: true,
          detail: countError.message,
          sql: SQL_FIX_USER_ID_AND_UNIQUE,
        });
      }
      return ApiResponses.databaseError("Query failed", countError.message);
    }

    let following = false;
    if (sessionWallet) {
      const { data: followData, error: followError } = await supabaseAdmin
        .from("event_follows")
        .select("*")
        .eq("user_id", sessionWallet)
        .eq("event_id", predictionId)
        .maybeSingle();

      if (followError) {
        if (
          isMissingRelation(followError) ||
          isUserIdForeignKeyViolation(followError) ||
          isUserIdTypeIntegerError(followError)
        ) {
          return ApiResponses.databaseError("Query failed, please fix the table structure", {
            setupRequired: true,
            detail: followError.message,
            sql: SQL_FIX_USER_ID_TYPE_ONLY,
          });
        }
        return ApiResponses.databaseError("Query failed", followError.message);
      }
      following = !!followData;
    }

    return successResponse({ following, followersCount: count || 0 });
  } catch (e: any) {
    return ApiResponses.internalError("Failed to process request", String(e?.message || e));
  }
}
