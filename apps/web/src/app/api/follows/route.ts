import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeAddress, parseRequestBody, logApiError } from "@/lib/serverUtils";

// Helper: detect missing relation error for graceful setup message
function isMissingRelation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("could not find") &&
      msg.includes("column") &&
      (msg.includes("user_address") || msg.includes("user_wallet") || msg.includes("user_id")))
  );
}

// Helper: detect FK constraint errors
function isUserIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("violates foreign key constraint") && msg.includes("event_follows_user_id_fkey")
  );
}

// Helper: detect event_id → predictions(id) foreign key violation
function isEventIdForeignKeyViolation(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  // 默认约束名为 event_follows_event_id_fkey；兼容部分环境错误信息仅提到 predictions
  return (
    msg.includes("violates foreign key constraint") &&
    (msg.includes("event_follows_event_id_fkey") || msg.includes("predictions"))
  );
}

// Helper: detect integer type mismatch on user_id column
function isUserIdTypeIntegerError(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("out of range for type integer") ||
    msg.includes("invalid input syntax for type integer")
  );
}

// Helper: detect missing unique/exclusion constraint for ON CONFLICT
function isOnConflictNoUniqueConstraint(error?: { message?: string }) {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("no unique or exclusion constraint") && msg.includes("on conflict");
}

// POST /api/follows  body: { predictionId: number, walletAddress: string }
export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          message:
            "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please set it in .env.local and restart the dev server.",
        },
        { status: 500 }
      );
    }
    const body = await parseRequestBody(req);
    const rawPredictionId = body?.predictionId;
    const rawWallet = body?.walletAddress;
    const predictionId = Number(rawPredictionId);
    const wa = normalizeAddress(String(rawWallet || ""));
    const walletAddress = /^0x[a-f0-9]{40}$/.test(wa) ? wa : "";

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

    // 前置校验：确认预测事件是否存在，避免外键冲突造成的迷惑性错误
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

    // 首先尝试插入（若缺表或结构错误按策略处理）
    const { data, error } = await supabaseAdmin
      .from("event_follows")
      .upsert({ user_id: walletAddress, event_id: predictionId } as any, {
        onConflict: "user_id,event_id",
      })
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
              sql: `
CREATE TABLE IF NOT EXISTS public.event_follows (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);
ALTER TABLE public.event_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_follows" ON public.event_follows
FOR ALL USING (true) WITH CHECK (true);`,
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
              sql: `
ALTER TABLE public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`,
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
              sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`,
            },
            { status: 501 }
          );
        }
      }
      // 针对缺少唯一约束的情况，回退为“存在性检查 + 普通插入”，避免接口 500
      if (isOnConflictNoUniqueConstraint(error)) {
        // 检查是否已存在记录
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
                sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`,
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

        // 尝试普通插入
        const { data: insData, error: insError } = await supabaseAdmin
          .from("event_follows")
          .insert({ user_id: walletAddress, event_id: predictionId } as any)
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
                sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`,
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

      // 针对 event_id 外键冲突返回明确的 400
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
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to process request", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// DELETE /api/follows  body: { predictionId: number, walletAddress: string }
export async function DELETE(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          message:
            "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please set it in .env.local and restart the dev server.",
        },
        { status: 500 }
      );
    }
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
              sql: `
ALTER TABLE public.event_follows DROP CONSTRAINT IF EXISTS event_follows_user_id_fkey;`,
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
              sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;`,
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

// GET /api/follows?predictionId=xx&walletAddress=xx
export async function GET(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          message:
            "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Please set it in .env.local and restart the dev server.",
        },
        { status: 500 }
      );
    }
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
            sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS event_follows_user_id_event_id_key ON public.event_follows (user_id, event_id);`,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { message: "Query failed", detail: countError.message },
        { status: 500 }
      );
    }

    // 检查当前用户是否已关注
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
              sql: `
ALTER TABLE public.event_follows ALTER COLUMN user_id TYPE TEXT;`,
            },
            { status: 500 }
          );
        } else {
          return NextResponse.json(
            { message: "Query failed", detail: followError.message },
            { status: 500 }
          );
        }
      } else {
        following = !!followData;
      }
    }

    return NextResponse.json({ following, followersCount: count || 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { message: "Failed to process request", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
