import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import type { PredictionRow } from "./types";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { normalizeCategory } from "@/features/trending/trendingModel";
import { ethers } from "ethers";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

type DefaultDeployment = {
  network?: string;
  chainId?: number;
  deployer?: string;
  collateral?: string;
  outcome1155?: string;
  defaultOracle?: string;
  marketFactory?: string;
  templates?: {
    templateIds?: { binary?: string; multi?: string };
  };
  markets?: { binary?: string; multi?: string; multiOutcomeCount?: number };
};

let cachedDefaultDeployment: DefaultDeployment | null = null;

async function loadDefaultDeployment(): Promise<DefaultDeployment | null> {
  if (cachedDefaultDeployment) return cachedDefaultDeployment;
  const candidates = [
    process.env.DEPLOYMENT_OFFCHAIN_SECURE_PATH,
    path.resolve(process.cwd(), "deployment_offchain_secure.json"),
    path.resolve(process.cwd(), "../../deployment_offchain_secure.json"),
    path.resolve(process.cwd(), "../../../deployment_offchain_secure.json"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  const deploymentPath = candidates.find((p) => existsSync(p));
  if (!deploymentPath) return null;

  try {
    const raw = await readFile(deploymentPath, "utf8");
    const parsed = JSON.parse(raw) as DefaultDeployment;
    cachedDefaultDeployment = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function resolveChainId(): number {
  const raw = (process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || "").trim();
  if (raw) {
    const chainId = Number(raw);
    if (Number.isFinite(chainId) && chainId > 0) return chainId;
    const err = new Error("Invalid CHAIN_ID");
    (err as any).status = 500;
    throw err;
  }
  if (process.env.NODE_ENV !== "production") return 80002;
  const err = new Error("Missing CHAIN_ID");
  (err as any).status = 500;
  throw err;
}

function parseResolutionTimeSeconds(deadline: unknown): number {
  if (typeof deadline !== "string" || !deadline.trim()) {
    const err = new Error("Invalid deadline");
    (err as any).status = 400;
    throw err;
  }
  const ms = Date.parse(deadline);
  if (!Number.isFinite(ms)) {
    const err = new Error("Invalid deadline format");
    (err as any).status = 400;
    throw err;
  }
  const sec = Math.floor(ms / 1000);
  if (!Number.isFinite(sec) || sec <= Math.floor(Date.now() / 1000)) {
    const err = new Error("Deadline must be in the future");
    (err as any).status = 400;
    throw err;
  }
  return sec;
}

function assertAddress(value: string, label: string) {
  if (!ethers.isAddress(value)) {
    const err = new Error(`Invalid ${label} address`);
    (err as any).status = 500;
    throw err;
  }
}

function assertBytes32(value: string, label: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    const err = new Error(`Invalid ${label}`);
    (err as any).status = 500;
    throw err;
  }
}

function resolveRpcUrl(chainId: number): string {
  const env = process.env;
  const fromGeneric = (env.RPC_URL || env.NEXT_PUBLIC_RPC_URL || "").trim();
  if (fromGeneric) return fromGeneric;
  if (chainId === 80002) {
    return (
      (env.NEXT_PUBLIC_RPC_POLYGON_AMOY || "").trim() || "https://rpc-amoy.polygon.technology/"
    );
  }
  if (chainId === 137) {
    return (env.NEXT_PUBLIC_RPC_POLYGON || "").trim() || "https://polygon-rpc.com";
  }
  const err = new Error("RPC_URL is not configured");
  (err as any).status = 500;
  throw err;
}

async function resolveMarketCreationConfig(type: "binary" | "multi"): Promise<{
  chainId: number;
  rpcUrl: string;
  privateKey: string;
  marketFactory: string;
  collateralToken: string;
  templateId: string;
  outcome1155: string;
  outcomeCount: number;
}> {
  const chainId = resolveChainId();
  const rpcUrl = resolveRpcUrl(chainId);
  const privateKey = (
    process.env.MARKET_CREATOR_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    ""
  ).trim();
  if (!privateKey) {
    const err = new Error("Missing MARKET_CREATOR_PRIVATE_KEY or PRIVATE_KEY");
    (err as any).status = 500;
    throw err;
  }

  const dep = await loadDefaultDeployment();
  const marketFactory = String(
    process.env.MARKET_FACTORY_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ||
      dep?.marketFactory ||
      ""
  ).trim();
  if (!marketFactory) {
    const err = new Error("Missing MARKET_FACTORY_ADDRESS");
    (err as any).status = 500;
    throw err;
  }
  assertAddress(marketFactory, "marketFactory");

  const collateralToken = String(
    (chainId === 80002
      ? process.env.USDC_ADDRESS_AMOY || process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY
      : process.env.COLLATERAL_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS) ||
      dep?.collateral ||
      ""
  ).trim();
  if (!collateralToken) {
    const err = new Error("Missing collateral token address");
    (err as any).status = 500;
    throw err;
  }
  assertAddress(collateralToken, "collateralToken");

  const outcome1155 = String(
    process.env.OUTCOME1155_ADDRESS ||
      process.env.NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS ||
      dep?.outcome1155 ||
      ""
  ).trim();
  if (!outcome1155) {
    const err = new Error("Missing outcome1155 address");
    (err as any).status = 500;
    throw err;
  }
  assertAddress(outcome1155, "outcome1155");

  const templateId = String(
    (type === "multi"
      ? process.env.OFFCHAIN_TEMPLATE_ID_MULTI || dep?.templates?.templateIds?.multi
      : process.env.OFFCHAIN_TEMPLATE_ID_BINARY || dep?.templates?.templateIds?.binary) || ""
  ).trim();
  if (!templateId) {
    const err = new Error("Missing templateId for market creation");
    (err as any).status = 500;
    throw err;
  }
  assertBytes32(templateId, "templateId");

  const outcomeCount =
    type === "multi" ? Math.max(3, Math.min(8, dep?.markets?.multiOutcomeCount || 0)) : 2;
  return {
    chainId,
    rpcUrl,
    privateKey,
    marketFactory,
    collateralToken,
    templateId,
    outcome1155,
    outcomeCount,
  };
}

async function createMarketOnchain(args: {
  type: "binary" | "multi";
  outcomeCount: number;
  resolutionTimeSec: number;
}): Promise<{
  chainId: number;
  market: string;
  collateralToken: string;
  tickSize: number;
}> {
  const mock = (process.env.MOCK_ONCHAIN_MARKET_ADDRESS || "").trim();
  if (mock) {
    const chainId = resolveChainId();
    const collateralToken =
      (chainId === 80002
        ? process.env.USDC_ADDRESS_AMOY || process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY
        : process.env.COLLATERAL_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS) || "";
    return {
      chainId,
      market: mock,
      collateralToken: String(collateralToken || "").trim(),
      tickSize: 1,
    };
  }

  const cfg = await resolveMarketCreationConfig(args.type);
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const pk = cfg.privateKey.startsWith("0x") ? cfg.privateKey : `0x${cfg.privateKey}`;
  const signer = new ethers.Wallet(pk, provider);

  const abi = [
    "event MarketCreated(uint256 indexed marketId,address indexed market,bytes32 indexed templateId,address creator,address collateralToken,address oracle,uint256 feeBps,uint256 resolutionTime)",
    "function createMarket(bytes32 templateId,address collateralToken,uint256 feeBps,uint256 resolutionTime,bytes data) returns (address market,uint256 marketId)",
  ];
  const factory = new ethers.Contract(cfg.marketFactory, abi, signer);

  const coder = ethers.AbiCoder.defaultAbiCoder();
  const initData =
    args.type === "multi"
      ? coder.encode(["address", "uint8"], [cfg.outcome1155, args.outcomeCount])
      : coder.encode(["address"], [cfg.outcome1155]);

  const tx = await factory.createMarket(
    cfg.templateId,
    cfg.collateralToken,
    0,
    args.resolutionTimeSec,
    initData
  );
  const rc = await tx.wait();

  const iface = new ethers.Interface(abi);
  for (const log of rc.logs || []) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === "MarketCreated") {
        const market = String((parsed as any).args?.market || "").trim();
        if (market)
          return {
            chainId: cfg.chainId,
            market,
            collateralToken: cfg.collateralToken,
            tickSize: 1,
          };
      }
    } catch {}
  }

  const err = new Error("MarketCreated event not found");
  (err as any).status = 500;
  throw err;
}

export async function createPredictionFromRequest(
  request: NextRequest,
  client: SupabaseClient<Database>
): Promise<CreatePredictionResult> {
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);

  const { walletAddress, sessionAddress } = await resolveAndVerifyWalletAddress(request, body);
  if (!sessionAddress) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }

  const rawTitle = String((body as Record<string, unknown>).title || "");
  const rawDescription = String((body as Record<string, unknown>).description || "");
  const rawCriteria = String((body as Record<string, unknown>).criteria || "");
  const rawCategory = String((body as Record<string, unknown>).category || "");
  const rawDeadline = String((body as Record<string, unknown>).deadline || "");

  const title = rawTitle.trim();
  const description = rawDescription.trim();
  const criteria = rawCriteria.trim();
  const category = normalizeCategory(rawCategory);
  const deadline = rawDeadline.trim();

  const rawMinStake = (body as Record<string, unknown>).minStake;
  const minStake = typeof rawMinStake === "string" ? Number(rawMinStake) : rawMinStake;

  const normalizedBody: Record<string, unknown> = {
    ...body,
    title,
    description,
    criteria,
    category,
    deadline,
    minStake,
  };

  assertRequiredFields(body as Record<string, unknown>, [
    "title",
    "description",
    "category",
    "deadline",
    "minStake",
    "criteria",
  ]);
  assertPositiveNumber(minStake, "minStake");
  const resolutionTimeSec = parseResolutionTimeSeconds(deadline);

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
    .eq("title", title);

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

  const imageUrl = resolveImageUrl(normalizedBody, buildDiceBearUrl);
  const { type, outcomes } = assertValidOutcomes(normalizedBody);

  const nextId = await getNextPredictionId(client);

  const referenceUrl =
    String(
      (normalizedBody as Record<string, unknown>).reference_url ||
        (normalizedBody as Record<string, unknown>).referenceUrl ||
        ""
    ).trim() || "";
  if (referenceUrl && !/^https?:\/\//i.test(referenceUrl)) {
    const err = new Error("Invalid reference_url format");
    (err as any).status = 400;
    throw err;
  }

  const { data: newPrediction, error } = await (client as any)
    .from("predictions")
    .insert({
      id: nextId,
      title,
      description,
      category,
      deadline,
      min_stake: minStake,
      criteria,
      reference_url: referenceUrl,
      image_url: imageUrl,
      status: "active",
      type: type === "multi" ? "multi" : "binary",
      outcome_count: type === "multi" ? outcomes.length : 2,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    await insertOutcomes(client, newPrediction.id, type, outcomes);

    const binding = await createMarketOnchain({
      type,
      outcomeCount: type === "multi" ? outcomes.length : 2,
      resolutionTimeSec,
    });
    const payload: any = {
      event_id: newPrediction.id,
      chain_id: binding.chainId,
      market: binding.market,
      collateral_token: binding.collateralToken || null,
      tick_size: binding.tickSize,
      resolution_time: deadline || null,
      status: "open",
    };

    const { error: mapErr } = await (client as any)
      .from("markets_map")
      .upsert(payload, { onConflict: "event_id,chain_id" });
    if (mapErr) {
      throw mapErr;
    }
  } catch (e) {
    try {
      await (client as any)
        .from("prediction_outcomes")
        .delete()
        .eq("prediction_id", newPrediction.id);
    } catch {}
    try {
      await (client as any).from("predictions").delete().eq("id", newPrediction.id);
    } catch {}
    throw e;
  }

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
  if (error) throw error;
}
