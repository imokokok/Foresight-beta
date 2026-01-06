import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ethers, Wallet, JsonRpcProvider, Contract } from "ethers";

type MakerVolumeRow = {
  maker_address: string;
  maker_volume_usdc: number;
};

async function main() {
  const url = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const marketKey = process.env.LP_REBATE_MARKET_KEY;
  const fromIso = process.env.LP_REBATE_FROM;
  const toIso = process.env.LP_REBATE_TO;
  const totalRebateUsdc = Number(process.env.LP_REBATE_TOTAL_USDC || "0");
  const rpcUrl = process.env.LP_REBATE_RPC_URL;
  const privateKey = process.env.LP_REBATE_PRIVATE_KEY;
  const foresightToken = process.env.LP_REBATE_FORESIGHT_TOKEN;
  const pointsPerUsdc = Number(process.env.LP_REBATE_POINTS_PER_USDC || "1");
  const dryRun = String(process.env.LP_REBATE_DRY_RUN || "true").toLowerCase() !== "false";

  if (!marketKey || !fromIso || !toIso) {
    throw new Error("LP_REBATE_MARKET_KEY, LP_REBATE_FROM, LP_REBATE_TO are required");
  }
  if (!Number.isFinite(totalRebateUsdc) || totalRebateUsdc <= 0) {
    throw new Error("LP_REBATE_TOTAL_USDC must be > 0");
  }
  if (!Number.isFinite(pointsPerUsdc) || pointsPerUsdc <= 0) {
    throw new Error("LP_REBATE_POINTS_PER_USDC must be > 0");
  }

  const { data, error } = await supabase
    .from("trades")
    .select("maker_address, price, quantity")
    .eq("market_key", marketKey)
    .gte("created_at", fromIso)
    .lt("created_at", toIso);

  if (error) {
    throw error;
  }

  const acc = new Map<string, number>();
  for (const row of data as any[]) {
    const maker = String(row.maker_address).toLowerCase();
    const price = Number(row.price);
    const qty = Number(row.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
    const volumeUsdc = (price * qty) / 1_000_000;
    acc.set(maker, (acc.get(maker) || 0) + volumeUsdc);
  }

  const entries: MakerVolumeRow[] = [];
  for (const [maker_address, maker_volume_usdc] of acc.entries()) {
    if (maker_volume_usdc > 0) {
      entries.push({ maker_address, maker_volume_usdc });
    }
  }

  if (entries.length === 0) {
    console.log("No maker volume found in given window");
    return;
  }

  const totalVolume = entries.reduce((sum, r) => sum + r.maker_volume_usdc, 0);
  const result = entries.map((r) => ({
    maker_address: r.maker_address,
    maker_volume_usdc: r.maker_volume_usdc,
    share: r.maker_volume_usdc / totalVolume,
    rebate_usdc: (r.maker_volume_usdc / totalVolume) * totalRebateUsdc,
    points: r.maker_volume_usdc * pointsPerUsdc,
  }));

  console.log(
    JSON.stringify(
      {
        market_key: marketKey,
        from: fromIso,
        to: toIso,
        total_volume_usdc: totalVolume,
        total_rebate_usdc: totalRebateUsdc,
        points_per_usdc: pointsPerUsdc,
        dry_run: dryRun,
        makers: result,
      },
      null,
      2
    )
  );

  if (dryRun) return;
  if (!rpcUrl || !privateKey || !foresightToken) {
    throw new Error(
      "LP_REBATE_RPC_URL, LP_REBATE_PRIVATE_KEY, LP_REBATE_FORESIGHT_TOKEN are required when DRY_RUN=false"
    );
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const abi = [
    "function mint(address to, uint256 amount) external",
    "function decimals() view returns (uint8)",
  ];
  const token = new Contract(foresightToken, abi, wallet);
  const decimals: number = Number(await token.decimals());

  for (const r of result) {
    const points = r.points;
    if (!Number.isFinite(points) || points <= 0) continue;
    const amount = ethers.parseUnits(points.toFixed(6), decimals);
    const tx = await token.mint(r.maker_address, amount);
    const receipt = await tx.wait();
    console.log(
      JSON.stringify(
        {
          maker: r.maker_address,
          points,
          txHash: receipt?.hash ?? tx.hash,
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
