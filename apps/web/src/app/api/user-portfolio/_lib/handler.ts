import { NextResponse } from "next/server";
import { getClient } from "@/lib/supabase";
import { groupBets, buildPortfolioResponse } from "./compute";
import { fetchPredictionsMeta, fetchPredictionsStats, fetchUserBets } from "./queries";

export async function handleUserPortfolioGet(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ message: "Wallet address is required" }, { status: 400 });
    }

    const client = getClient();
    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        const empty = buildPortfolioResponse({
          grouped: {},
          predictionsMap: {},
          statsMap: {},
        });
        return NextResponse.json(empty);
      }
      return NextResponse.json({ message: "Supabase client not initialized" }, { status: 500 });
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
        return NextResponse.json(empty);
      }
      return NextResponse.json({ message: "Failed to fetch bets" }, { status: 500 });
    }

    const { grouped, predictionIds } = groupBets(bets);

    const { predictionsMap, predictionError } = await fetchPredictionsMeta(client, predictionIds);
    if (predictionError) {
      console.error("Error fetching predictions:", predictionError);
    }

    const { statsMap } = await fetchPredictionsStats(client, predictionIds);

    const response = buildPortfolioResponse({ grouped, predictionsMap, statsMap });
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("API Error:", error);
    if (process.env.NODE_ENV !== "production") {
      const empty = buildPortfolioResponse({
        grouped: {},
        predictionsMap: {},
        statsMap: {},
      });
      return NextResponse.json(empty);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
