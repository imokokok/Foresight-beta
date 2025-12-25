import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { groupBets, buildPortfolioResponse } from "./compute";
import { fetchPredictionsMeta, fetchPredictionsStats, fetchUserBets } from "./queries";

export async function handleUserPortfolioGet(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ message: "Wallet address is required" }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ message: "Supabase client not initialized" }, { status: 500 });
    }

    const { bets, betsError } = await fetchUserBets(supabaseAdmin, address);
    if (betsError) {
      console.error("Error fetching bets:", betsError);
      return NextResponse.json({ message: "Failed to fetch bets" }, { status: 500 });
    }

    const { grouped, predictionIds } = groupBets(bets);

    const { predictionsMap, predictionError } = await fetchPredictionsMeta(
      supabaseAdmin,
      predictionIds
    );
    if (predictionError) {
      console.error("Error fetching predictions:", predictionError);
    }

    const { statsMap } = await fetchPredictionsStats(supabaseAdmin, predictionIds);

    const response = buildPortfolioResponse({ grouped, predictionsMap, statsMap });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { message: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
