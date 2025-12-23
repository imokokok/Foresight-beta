// 预测事件API路由 - 处理GET和POST请求
import { NextRequest, NextResponse } from "next/server";
import { getClient, supabase, type Database } from "@/lib/supabase";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { getSessionAddress, normalizeAddress, isAdminAddress } from "@/lib/serverUtils";

// 预测列表可以短暂缓存
export const revalidate = 30; // 30秒缓存

type PredictionRow = Database["public"]["Tables"]["predictions"]["Row"];
type EventFollowRow = Database["public"]["Tables"]["event_follows"]["Row"];
type PredictionListItem = PredictionRow & {
  followers_count: number;
  stats: {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    participantCount: number;
    yesProbability: number;
    noProbability: number;
    betCount: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    // 对于获取预测事件列表，允许匿名访问（不需要登录）
    // 只有创建预测事件等敏感操作才需要登录验证

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = searchParams.get("limit");
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");
    const includeOutcomes = (searchParams.get("includeOutcomes") || "0") !== "0";

    // 在缺少服务密钥时使用匿名客户端降级读取
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase client is not configured" },
        { status: 500 }
      );
    }

    // 构建Supabase查询
    let selectExpr = "*";
    if (includeOutcomes) selectExpr = "*, outcomes:prediction_outcomes(*)";

    // 使用 any 绕过复杂的 query 构建类型检查，但保持返回结果的类型安全
    let query = (client as any)
      .from("predictions")
      .select(selectExpr, { count: "exact" })
      .order("created_at", { ascending: false });

    // 添加过滤条件
    if (category) {
      query = query.eq("category", category);
    }

    if (status) {
      query = query.eq("status", status);
    }

    // 分页支持（优先使用 page + pageSize，兼容旧的 limit）
    let totalCount = 0;
    let currentPage = 1;
    let pageSizeNum = 12; // 默认每页12条

    if (page && pageSize) {
      // 新分页模式
      currentPage = Math.max(1, parseInt(page) || 1);
      pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 12)); // 限制最大100条
      const from = (currentPage - 1) * pageSizeNum;
      const to = from + pageSizeNum - 1;
      query = query.range(from, to);
    } else if (limit) {
      // 旧模式兼容（只限制数量）
      const limitNum = parseInt(limit);
      query = query.limit(limitNum);
    }

    const { data: predictions, error, count } = await query;
    totalCount = count || 0;

    let predictionsWithFollowersCount: PredictionListItem[] = [];
    if (!error && predictions) {
      const predictionRows = (predictions || []) as PredictionRow[];

      const ids = predictionRows.map((p) => Number(p.id)).filter((n) => Number.isFinite(n));

      let followerCounts: Record<number, number> = {};
      if (ids.length > 0) {
        const { data: rows, error: rowsError } = await (client as any)
          .from("event_follows")
          .select("event_id")
          .in("event_id", ids);

        if (!rowsError && rows) {
          const followRows = rows as EventFollowRow[];
          for (const r of followRows) {
            const eid = Number(r.event_id);
            if (Number.isFinite(eid)) {
              followerCounts[eid] = (followerCounts[eid] || 0) + 1;
            }
          }
        }
      }

      let statsMap: Record<
        number,
        {
          yesAmount: number;
          noAmount: number;
          totalAmount: number;
          participantCount: number;
          betCount: number;
        }
      > = {};

      if (ids.length > 0) {
        // prediction_stats is likely a view or table
        const { data: statsRows, error: statsError } = await (client as any)
          .from("prediction_stats")
          .select(
            "prediction_id, yes_amount, no_amount, total_amount, participant_count, bet_count"
          )
          .in("prediction_id", ids);

        if (!statsError && Array.isArray(statsRows)) {
          for (const row of statsRows) {
            const pid = Number((row as any).prediction_id);
            if (!Number.isFinite(pid)) continue;
            statsMap[pid] = {
              yesAmount: Number((row as any).yes_amount || 0),
              noAmount: Number((row as any).no_amount || 0),
              totalAmount: Number((row as any).total_amount || 0),
              participantCount: Number((row as any).participant_count || 0),
              betCount: Number((row as any).bet_count || 0),
            };
          }
        }
      }

      predictionsWithFollowersCount = predictionRows.map((p) => {
        const idNum = Number(p.id);
        const followersCount = followerCounts[idNum] || 0;
        const stat = statsMap[idNum];

        let yesAmount = stat?.yesAmount ?? 0;
        let noAmount = stat?.noAmount ?? 0;
        let totalAmount = stat?.totalAmount ?? 0;
        let participantCount = stat?.participantCount ?? 0;
        let betCount = stat?.betCount ?? 0;

        let yesProbability = 0.5;
        let noProbability = 0.5;
        if (totalAmount > 0) {
          yesProbability = yesAmount / totalAmount;
          noProbability = noAmount / totalAmount;
        }

        return {
          ...p,
          followers_count: followersCount,
          stats: {
            yesAmount: parseFloat(yesAmount.toFixed(4)),
            noAmount: parseFloat(noAmount.toFixed(4)),
            totalAmount: parseFloat(totalAmount.toFixed(4)),
            participantCount,
            yesProbability: parseFloat(yesProbability.toFixed(4)),
            noProbability: parseFloat(noProbability.toFixed(4)),
            betCount,
          },
        };
      });
    }

    if (error) {
      console.error("Failed to fetch predictions list:", error);
      return NextResponse.json(
        { success: false, message: "Failed to fetch prediction list" },
        { status: 500 }
      );
    }

    // 计算分页元数据
    const totalPages = pageSizeNum > 0 ? Math.ceil(totalCount / pageSizeNum) : 1;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return NextResponse.json(
      {
        success: true,
        data: predictionsWithFollowersCount,
        message: "获取预测事件列表成功",
        pagination:
          page && pageSize
            ? {
                page: currentPage,
                pageSize: pageSizeNum,
                total: totalCount,
                totalPages,
                hasNextPage,
                hasPrevPage,
              }
            : undefined,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=5, stale-while-revalidate=20",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected error while fetching prediction list:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch prediction list" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体中的JSON数据
    const body = await request.json();

    const sessAddr = await getSessionAddress(request);
    let walletAddress: string = normalizeAddress(String(body.walletAddress || ""));
    if (!walletAddress && sessAddr) walletAddress = normalizeAddress(sessAddr);

    // 验证钱包地址格式
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid wallet address format",
        },
        { status: 400 }
      );
    }

    if (sessAddr && normalizeAddress(sessAddr) !== walletAddress) {
      return NextResponse.json(
        { success: false, message: "Unauthorized or session address does not match" },
        { status: 401 }
      );
    }

    // 验证必填字段
    const requiredFields = ["title", "description", "category", "deadline", "minStake", "criteria"];
    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
          missingFields,
        },
        { status: 400 }
      );
    }

    // 验证数据类型
    if (typeof body.minStake !== "number" || body.minStake <= 0) {
      return NextResponse.json(
        { success: false, message: "minStake must be a positive number" },
        { status: 400 }
      );
    }

    // 选择客户端：优先使用服务端密钥，缺失则回退匿名（需有RLS读取策略）
    const client = getClient() || supabase;
    if (!client) {
      return NextResponse.json(
        { success: false, message: "Supabase client is not configured" },
        { status: 500 }
      );
    }

    const { data: prof, error: profErr } = await (client as any)
      .from("user_profiles")
      .select("is_admin")
      .eq("wallet_address", walletAddress)
      .maybeSingle();
    const isAdmin = !!prof?.is_admin || isAdminAddress(walletAddress);
    if (profErr || !isAdmin) {
      return NextResponse.json(
        { success: false, message: "Admin permission is required" },
        { status: 403 }
      );
    }
    // 检查是否已存在相同标题的预测事件
    const { data: existingPredictions, error: checkError } = await (client as any)
      .from("predictions")
      .select("id, title, description, category, deadline, status")
      .eq("title", body.title);

    if (checkError) {
      console.error("Failed to check duplicate prediction title:", checkError);
      return NextResponse.json(
        { success: false, message: "Failed to check prediction" },
        { status: 500 }
      );
    }

    // 如果存在相同标题的预测事件，返回错误并列出所有重复事件
    if (existingPredictions && existingPredictions.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A prediction with the same title already exists. Please change the title or delete existing events.",
          duplicateEvents: existingPredictions.map((event: any) => ({
            id: event.id,
            title: event.title,
            category: event.category,
            status: event.status,
            deadline: event.deadline,
          })),
        },
        { status: 409 } // 409 Conflict 状态码
      );
    }

    // 验证图片URL（如果提供了）
    if (body.imageUrl && typeof body.imageUrl !== "string") {
      return NextResponse.json(
        { success: false, message: "Invalid imageUrl format" },
        { status: 400 }
      );
    }

    // 优先使用上传的图片URL，如果没有上传则使用生成的图片
    let imageUrl: string;
    if (body.imageUrl) {
      // 如果imageUrl包含supabase.co，说明是上传的图片
      if (body.imageUrl.includes("supabase.co")) {
        imageUrl = body.imageUrl;
      } else if (body.imageUrl.startsWith("https://")) {
        imageUrl = body.imageUrl;
      } else {
        const seed = body.title.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "prediction";
        imageUrl = buildDiceBearUrl(
          seed,
          "&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20"
        );
      }
    } else {
      const seed = body.title.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "prediction";
      imageUrl = buildDiceBearUrl(seed, "&size=400&backgroundColor=b6e3f4,c0aede,d1d4f9&radius=20");
    }

    // 插入新的预测事件到Supabase数据库
    // 先获取当前最大id，然后手动指定id来避免序列冲突
    const { data: maxIdData, error: maxIdError } = await (client as any)
      .from("predictions")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    if (maxIdError) {
      console.error("Failed to fetch max prediction id:", maxIdError);
      return NextResponse.json(
        { success: false, message: "Failed to create prediction" },
        { status: 500 }
      );
    }

    const nextId = maxIdData && maxIdData.length > 0 ? maxIdData[0].id + 1 : 1;

    // 事件类型与选项校验
    const type = String(body.type || "binary");
    const outcomes = Array.isArray(body.outcomes) ? body.outcomes : [];
    if (type === "multi") {
      if (outcomes.length < 3 || outcomes.length > 8) {
        return NextResponse.json(
          {
            success: false,
            message: "Multi-outcome events must have between 3 and 8 options",
          },
          { status: 400 }
        );
      }
      if (outcomes.some((o: any) => !String(o?.label || "").trim())) {
        return NextResponse.json(
          { success: false, message: "Each option must have a non-empty label" },
          { status: 400 }
        );
      }
    }

    const { data: newPrediction, error } = await (client as any)
      .from("predictions")
      .insert({
        id: nextId, // 手动指定id，避免序列冲突
        title: body.title,
        description: body.description,
        category: body.category,
        deadline: body.deadline,
        min_stake: body.minStake,
        criteria: body.criteria,
        reference_url: body.reference_url || "",
        image_url: imageUrl,
        status: "active",
        type: type === "multi" ? "multi" : "binary",
        outcome_count: type === "multi" ? outcomes.length : 2,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create prediction:", error);
      return NextResponse.json(
        { success: false, message: "Failed to create prediction" },
        { status: 500 }
      );
    }

    // 根据类型插入选项（binary 默认 Yes/No；multi 按用户输入）
    try {
      const items =
        type === "multi"
          ? outcomes.map((o: any, i: number) => ({
              prediction_id: newPrediction.id,
              outcome_index: i,
              label: String(o?.label || "").trim(),
              description: o?.description || null,
              color: o?.color || null,
              image_url: o?.image_url || null,
            }))
          : [
              {
                prediction_id: newPrediction.id,
                outcome_index: 0,
                label: "Yes",
              },
              {
                prediction_id: newPrediction.id,
                outcome_index: 1,
                label: "No",
              },
            ];
      const { error: outcomesErr } = await (client as any)
        .from("prediction_outcomes")
        .insert(items);
      if (outcomesErr) {
        console.warn("Failed to insert prediction outcomes:", outcomesErr);
      }
    } catch (e) {
      console.warn("Unexpected error while inserting prediction outcomes:", e);
    }

    return NextResponse.json(
      {
        success: true,
        data: newPrediction,
        message: "Prediction created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error while creating prediction:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create prediction",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
