import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { logApiError, normalizeAddress, parseRequestBody } from "@/lib/serverUtils";
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

function supabaseNotConfigured() {
  return NextResponse.json(
    {
      message:
        "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please set it in .env.local and restart the dev server.",
    },
    { status: 500 }
  );
}

export async function handleFollowsPost(req: Request) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const body = await parseRequestBody(req);
    const rawPredictionId = body?.predictionId;
    const rawWallet = body?.walletAddress;
    const predictionId = parsePredictionId(rawPredictionId);
    const { walletAddress } = parseWalletAddressStrict(rawWallet);

    if (!predictionId) {
      return NextResponse.json(
        {
          message: "predictionId is required and must be a number",
          received: String(rawPredictionId ?? ""),
        },
        { status: 400 }
      );
    }
    if (!rawWallet) {
      return NextResponse.json(
        { message: "walletAddress is required", received: "" },
        { status: 400 }
      );
    }
    if (!walletAddress) {
      return NextResponse.json(
        {
          message: "walletAddress format is invalid, expected 0x followed by 40 hex characters",
          received: String(rawWallet),
        },
        { status: 422 }
      );
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
      return NextResponse.json(
        { message: "Failed to read prediction on server, please try again later" },
        { status: 500 }
      );
    }
    if (!pidCount) {
      return NextResponse.json(
        {
          message:
            "predictionId does not exist; the prediction has been deleted or has not been created",
        },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_follows")
      .upsert(
        {
          user_id: walletAddress,
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
        walletAddress,
        message: error?.message,
      });

      if (
        isMissingRelation(error) ||
        isUserIdForeignKeyViolation(error) ||
        isUserIdTypeIntegerError(error)
      ) {
        if (isMissingRelation(error)) {
          return NextResponse.json(
            {
              message:
                "Missing event_follows table. Please run the following SQL in Supabase console and retry",
              setupRequired: true,
              sql: SQL_CREATE_EVENT_FOLLOWS_TABLE,
            },
            { status: 501 }
          );
        }
        if (isUserIdForeignKeyViolation(error)) {
          return NextResponse.json(
            {
              message:
                "Foreign key constraint on event_follows.user_id is incorrect. Please change it to a unique key on TEXT type",
              setupRequired: true,
              detail: error.message,
              sql: `${SQL_DROP_USER_ID_FK}\n${SQL_FIX_USER_ID_AND_UNIQUE}`,
            },
            { status: 501 }
          );
        }
        if (isUserIdTypeIntegerError(error)) {
          return NextResponse.json(
            {
              message:
                "event_follows.user_id column type is incorrect. Please change it to TEXT and add a unique index",
              setupRequired: true,
              detail: error.message,
              sql: SQL_FIX_USER_ID_AND_UNIQUE,
            },
            { status: 501 }
          );
        }
      }

      if (isOnConflictNoUniqueConstraint(error)) {
        const { count: existCount, error: existError } = await supabaseAdmin
          .from("event_follows")
          .select("*", { count: "exact", head: true })
          .eq("user_id", walletAddress)
          .eq("event_id", predictionId);

        if (existError) {
          if (
            isMissingRelation(existError) ||
            isUserIdForeignKeyViolation(existError) ||
            isUserIdTypeIntegerError(existError)
          ) {
            return NextResponse.json(
              {
                message: "Follow failed, please fix the table structure and retry",
                setupRequired: true,
                detail: existError.message,
                sql: SQL_FIX_USER_ID_AND_UNIQUE,
              },
              { status: 500 }
            );
          }
          return NextResponse.json(
            { message: "Failed to follow prediction", detail: existError.message },
            { status: 500 }
          );
        }

        if (existCount && existCount > 0) {
          return NextResponse.json(
            {
              message: "Already followed",
              follow: { user_id: walletAddress, event_id: predictionId },
            },
            { status: 200 }
          );
        }

        const { data: insData, error: insError } = await supabaseAdmin
          .from("event_follows")
          .insert({
            user_id: walletAddress,
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
            return NextResponse.json(
              {
                message: "Follow failed, please fix the table structure and retry",
                setupRequired: true,
                detail: insError.message,
                sql: SQL_FIX_USER_ID_AND_UNIQUE,
              },
              { status: 500 }
            );
          }
          if (isEventIdForeignKeyViolation(insError)) {
            return NextResponse.json(
              {
                message:
                  "Invalid predictionId: prediction does not exist or was deleted (foreign key)",
                detail: insError.message,
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { message: "Failed to follow prediction", detail: insError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ message: "Already followed", follow: insData }, { status: 200 });
      }

      if (isEventIdForeignKeyViolation(error)) {
        return NextResponse.json(
          {
            message: "Invalid predictionId: prediction does not exist or was deleted (foreign key)",
            detail: error.message,
            hint: "If this predictionId exists in the list but is still reported invalid, please check that event_follows.event_id foreign key points to public.predictions(id) and SUPABASE_* env config matches the frontend.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { message: "Failed to follow prediction", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Already followed", follow: data }, { status: 200 });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: "Failed to process request", detail }, { status: 500 });
  }
}

export async function handleFollowsDelete(req: Request) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const body = await parseRequestBody(req);
    const predictionId = Number(body?.predictionId);
    const walletAddress = normalizeAddress(String(body?.walletAddress || ""));

    if (!predictionId || !walletAddress) {
      return NextResponse.json(
        { message: "predictionId and walletAddress are required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("event_follows")
      .delete()
      .eq("user_id", walletAddress)
      .eq("event_id", predictionId);

    if (error) {
      if (
        isMissingRelation(error) ||
        isUserIdForeignKeyViolation(error) ||
        isUserIdTypeIntegerError(error)
      ) {
        if (isMissingRelation(error)) {
          return NextResponse.json(
            {
              message: "Missing event_follows table. Please create it and retry.",
              setupRequired: true,
              sql: `
CREATE TABLE IF NOT EXISTS public.event_follows (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);`,
            },
            { status: 501 }
          );
        }
        if (isUserIdForeignKeyViolation(error)) {
          return NextResponse.json(
            {
              message:
                "Foreign key constraint on event_follows.user_id is incorrect. Please drop it and change column type to TEXT.",
              setupRequired: true,
              detail: error.message,
              sql: SQL_DROP_USER_ID_FK,
            },
            { status: 501 }
          );
        }
        if (isUserIdTypeIntegerError(error)) {
          return NextResponse.json(
            {
              message: "event_follows.user_id column type is integer. It must be TEXT.",
              setupRequired: true,
              detail: error.message,
              sql: SQL_FIX_USER_ID_TYPE_ONLY,
            },
            { status: 501 }
          );
        }
      }
      return NextResponse.json(
        { message: "Failed to unfollow prediction", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Unfollowed successfully" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to process request", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function handleFollowsGet(req: Request) {
  try {
    if (!supabaseAdmin) return supabaseNotConfigured();

    const { searchParams } = new URL(req.url);
    const predictionId = Number(searchParams.get("predictionId"));
    const wa = normalizeAddress(String(searchParams.get("walletAddress") || ""));
    const walletAddress = /^0x[a-f0-9]{40}$/.test(wa) ? wa : "";

    if (!predictionId) {
      return NextResponse.json({ message: "predictionId is required" }, { status: 400 });
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
        return NextResponse.json(
          {
            message: "Count query failed, please fix the table structure",
            setupRequired: true,
            detail: countError.message,
            sql: SQL_FIX_USER_ID_AND_UNIQUE,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { message: "Query failed", detail: countError.message },
        { status: 500 }
      );
    }

    let following = false;
    if (walletAddress) {
      const { data: followData, error: followError } = await supabaseAdmin
        .from("event_follows")
        .select("*")
        .eq("user_id", walletAddress)
        .eq("event_id", predictionId)
        .maybeSingle();

      if (followError) {
        if (
          isMissingRelation(followError) ||
          isUserIdForeignKeyViolation(followError) ||
          isUserIdTypeIntegerError(followError)
        ) {
          return NextResponse.json(
            {
              message: "Query failed, please fix the table structure",
              setupRequired: true,
              detail: followError.message,
              sql: SQL_FIX_USER_ID_TYPE_ONLY,
            },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { message: "Query failed", detail: followError.message },
          { status: 500 }
        );
      }
      following = !!followData;
    }

    return NextResponse.json({ following, followersCount: count || 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to process request", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
