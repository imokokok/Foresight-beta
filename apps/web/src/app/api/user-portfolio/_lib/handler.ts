import { getClient } from "@/lib/supabase";
import { ApiResponses, successResponse } from "@/lib/apiResponse";
import { normalizeAddress } from "@/lib/serverUtils";
import { groupBets, buildPortfolioResponse } from "./compute";
import { fetchPredictionsMeta, fetchPredictionsStats, fetchUserBets } from "./queries";

export async function handleUserPortfolioGet(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawAddress = searchParams.get("address");
    const address = normalizeAddress(String(rawAddress || ""));

    if (!address) {
      return ApiResponses.badRequest("Wallet address is required");
    }

    const client = getClient();
    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        const empty = buildPortfolioResponse({
          grouped: {},
          predictionsMap: {},
          statsMap: {},
        });
        return successResponse(empty);
      }
      return ApiResponses.internalError("Supabase client not initialized");
    }

    const { bets, betsError } = await fetchUserBets(client, address);
    if (betsError) {
      console.error("Error fetching bets:", betsError);
      if (process.env.NODE_ENV !== "production") {
        const empty = buildPortfolioResponse({
          grouped: {},
          predictionsMap: {},
          statsMap: {},
        });
        return successResponse(empty);
      }
      return ApiResponses.databaseError("Failed to fetch bets", betsError.message);
    }

    const { grouped, predictionIds } = groupBets(bets);

    const { predictionsMap, predictionError } = await fetchPredictionsMeta(client, predictionIds);
    if (predictionError) {
      console.error("Error fetching predictions:", predictionError);
    }

    const { statsMap } = await fetchPredictionsStats(client, predictionIds);

    const response = buildPortfolioResponse({ grouped, predictionsMap, statsMap });
    return successResponse(response);
  } catch (error: unknown) {
    console.error("API Error:", error);
    if (process.env.NODE_ENV !== "production") {
      const empty = buildPortfolioResponse({
        grouped: {},
        predictionsMap: {},
        statsMap: {},
      });
      return successResponse(empty);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return ApiResponses.internalError(message);
  }
}
