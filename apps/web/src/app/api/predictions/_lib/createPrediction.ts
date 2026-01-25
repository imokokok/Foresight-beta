import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { PredictionRow } from "./types";
import { buildDiceBearUrl } from "@/lib/dicebear";
import { normalizeCategory } from "@/lib/categories";
import { ethers } from "ethers";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getChainAddresses, getConfiguredChainId, getConfiguredRpcUrl } from "@/lib/runtimeConfig";
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
  try {
    return getConfiguredChainId();
  } catch (e: any) {
    const err = new Error(String(e?.message || "Missing CHAIN_ID"));
    (err as any).status = 500;
    throw err;
  }
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
  try {
    return getConfiguredRpcUrl(chainId);
  } catch (e: any) {
    const err = new Error(String(e?.message || "RPC_URL is not configured"));
    (err as any).status = 500;
    throw err;
  }
}

async function resolveMarketCreationConfig(type: "binary" | "multi"): Promise<{
  chainId: number;
  rpcUrl: string;
  privateKey: string;
  marketFactory: string;
  collateralToken: string;
  templateId: string;
  outcome1155: string;
  oracle: string;
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
  const chainAddresses = getChainAddresses(chainId);
  const marketFactory = String(
    process.env.MARKET_FACTORY_ADDRESS ||
      process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS ||
      dep?.marketFactory ||
      chainAddresses.marketFactory ||
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
      ? process.env.USDC_ADDRESS_AMOY ||
        process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY ||
        chainAddresses.usdc
      : process.env.COLLATERAL_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS) ||
      dep?.collateral ||
      chainAddresses.usdc ||
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
      chainAddresses.outcomeToken1155 ||
      ""
  ).trim();
  if (!outcome1155) {
    const err = new Error("Missing outcome1155 address");
    (err as any).status = 500;
    throw err;
  }
  assertAddress(outcome1155, "outcome1155");

  const oracle = String(
    process.env.ORACLE_ADDRESS ||
      process.env.UMA_ADAPTER_ADDRESS ||
      process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS ||
      dep?.defaultOracle ||
      process.env.NEXT_PUBLIC_UMA_ADAPTER_ADDRESS ||
      chainAddresses.umaAdapter ||
      ""
  ).trim();
  if (!oracle) {
    const err = new Error("Missing oracle address");
    (err as any).status = 500;
    throw err;
  }
  assertAddress(oracle, "oracle");

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

  return {
    chainId,
    rpcUrl,
    privateKey,
    marketFactory,
    collateralToken,
    templateId,
    outcome1155,
    oracle,
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
  oracle: string;
}> {
  const mock = (process.env.MOCK_ONCHAIN_MARKET_ADDRESS || "").trim();
  if (mock) {
    const chainId = resolveChainId();
    const chainAddresses = getChainAddresses(chainId);
    const collateralToken =
      (chainId === 80002
        ? process.env.USDC_ADDRESS_AMOY ||
          process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY ||
          chainAddresses.usdc
        : process.env.COLLATERAL_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS) || "";
    return {
      chainId,
      market: mock,
      collateralToken: String(collateralToken || "").trim(),
      tickSize: 1,
      oracle: ethers.ZeroAddress,
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
  let marketIdVal: bigint | null = null;
  let marketAddress: string | null = null;

  for (const log of rc.logs || []) {
    try {
      const parsed = iface.parseLog(log as any);
      if (parsed?.name === "MarketCreated") {
        marketAddress = String((parsed as any).args?.market || "").trim();
        marketIdVal = (parsed as any).args?.marketId;
        break;
      }
    } catch {}
  }

  if (!marketAddress || marketIdVal === null) {
    const err = new Error("MarketCreated event not found");
    (err as any).status = 500;
    throw err;
  }

  return {
    chainId: cfg.chainId,
    market: marketAddress,
    collateralToken: cfg.collateralToken,
    tickSize: 1,
    oracle: cfg.oracle,
  };
}

export type CreatePredictionParams = {
  title: string;
  description: string;
  category: string;
  deadline: string;
  minStake: number;
  criteria: string;
  image_url?: string;
  reference_url?: string;
  type?: "binary" | "multi";
  outcomes?: OutcomeInput[];
};

export type OutcomeInput = {
  label: string;
  description?: string | null;
  color?: string | null;
  image_url?: string | null;
};

export async function createPrediction(
  client: SupabaseClient<Database>,
  params: CreatePredictionParams
): Promise<CreatePredictionResult> {
  const {
    title,
    description,
    category,
    deadline,
    minStake,
    criteria,
    image_url,
    reference_url,
    type = "binary",
    outcomes = [],
  } = params;

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

  const outcomeCount = type === "multi" ? outcomes.length : 2;
  const resolutionTimeSec = parseResolutionTimeSeconds(deadline);

  const { data: newPrediction, error } = await (client as any)
    .from("predictions")
    .insert({
      title,
      description,
      category,
      deadline,
      min_stake: minStake,
      criteria,
      reference_url: reference_url || "",
      image_url: image_url || "",
      status: "active",
      type,
      outcome_count: outcomeCount,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    await insertOutcomes(client, newPrediction.id, type, outcomes);

    const binding = await createMarketOnchain({
      type,
      outcomeCount,
      resolutionTimeSec,
    });
    const marketAddr = String(binding.market || "")
      .trim()
      .toLowerCase();
    const collateralAddr = String(binding.collateralToken || "")
      .trim()
      .toLowerCase();
    const payload: any = {
      event_id: newPrediction.id,
      chain_id: binding.chainId,
      market: marketAddr,
      collateral_token: collateralAddr || null,
      tick_size: binding.tickSize,
      resolution_time: deadline || null,
      status: "open",
      outcome_count: outcomeCount,
      outcomes: buildMarketsMapOutcomes(type, outcomes),
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

  // Validate deadline format
  parseResolutionTimeSeconds(deadline);

  const MAX_TITLE_LENGTH = 200;
  const MAX_DESCRIPTION_LENGTH = 2000;
  const MAX_CRITERIA_LENGTH = 2000;

  if (title.length > MAX_TITLE_LENGTH) {
    const err = new Error(`Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`);
    (err as any).status = 400;
    throw err;
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    const err = new Error(
      `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`
    );
    (err as any).status = 400;
    throw err;
  }

  if (criteria.length > MAX_CRITERIA_LENGTH) {
    const err = new Error(`Criteria exceeds maximum length of ${MAX_CRITERIA_LENGTH} characters`);
    (err as any).status = 400;
    throw err;
  }

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

  const imageUrl = resolveImageUrl(normalizedBody, buildDiceBearUrl);
  const { type, outcomes } = assertValidOutcomes(normalizedBody);

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

  return createPrediction(client, {
    title,
    description,
    category,
    deadline,
    minStake: minStake as number,
    criteria,
    image_url: imageUrl,
    reference_url: referenceUrl,
    type: type === "multi" ? "multi" : "binary",
    outcomes,
  });
}

async function insertOutcomes(
  client: SupabaseClient,
  predictionId: number,
  type: "binary" | "multi",
  outcomes: OutcomeInput[]
) {
  const items =
    type === "multi"
      ? outcomes.map((o: OutcomeInput, i: number) => ({
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

function buildMarketsMapOutcomes(type: "binary" | "multi", outcomes: OutcomeInput[]): unknown {
  if (type !== "multi") {
    return [
      { outcome_index: 0, label: "Yes" },
      { outcome_index: 1, label: "No" },
    ];
  }
  return (outcomes || []).map((o, i) => ({
    outcome_index: i,
    label: String(o?.label || "").trim(),
    description: o?.description == null ? null : String(o.description),
    color: o?.color == null ? null : String(o.color),
    image_url: o?.image_url == null ? null : String(o.image_url),
  }));
}
