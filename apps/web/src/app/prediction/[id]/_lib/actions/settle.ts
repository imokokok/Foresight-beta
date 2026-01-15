import { ethers } from "ethers";
import { formatTranslation, t } from "@/lib/i18n";
import type { MarketInfo } from "../marketTypes";
import { createBrowserProvider, ensureNetwork, getCollateralTokenContract } from "../wallet";
import { trySubmitAaCalls, isAaEnabled } from "../aaUtils";

const ORACLE_ADAPTER_ABI = [
  "function requestOutcome(bytes32 marketId, uint8 outcomeIndex, bytes calldata claim) external returns (bytes32 assertionId)",
  "function settleOutcome(bytes32 marketId) external",
  "function getMarketStatus(bytes32 marketId) external view returns (uint8 status, uint256 outcome, bytes32 assertionId, uint8 reassertionCount)",
];

const MARKET_ABI = [
  "function resolve() external",
  "function state() external view returns (uint8)",
];

export async function assertOutcomeAction(args: {
  market: MarketInfo;
  outcomeIndex: number;
  claim: string; // Description or JSON
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  setMsg: (msg: string | null) => void;
}) {
  const { market, outcomeIndex, claim, walletProvider, switchNetwork, setMsg } = args;

  try {
    setMsg(t("settlement.assertFlow.prepare"));

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    // The market contract has an 'oracle' field which is the adapter address
    // We need to call the adapter, not the market
    const marketContract = new ethers.Contract(
      market.market,
      ["function oracle() view returns (address)"],
      signer
    );
    const oracleAddress = await marketContract.oracle();

    const oracleContract = new ethers.Contract(oracleAddress, ORACLE_ADAPTER_ABI, signer);

    setMsg(t("settlement.assertFlow.asserting"));

    // Convert claim string to bytes
    const claimBytes = ethers.toUtf8Bytes(claim);

    // market.market is the address, but UMA expects a marketId (bytes32)
    // In OffchainMarketBase, marketId is a bytes32.
    // We need to get the marketId from the market contract.
    const marketIdContract = new ethers.Contract(
      market.market,
      ["function marketId() view returns (bytes32)"],
      signer
    );
    const marketId = await marketIdContract.marketId();

    if (isAaEnabled()) {
      try {
        const oracleIface = new ethers.Interface(ORACLE_ADAPTER_ABI);
        const data = oracleIface.encodeFunctionData("requestOutcome", [
          marketId,
          outcomeIndex,
          claimBytes,
        ]);
        await trySubmitAaCalls({ chainId: market.chain_id, calls: [{ to: oracleAddress, data }] });
        setMsg(t("settlement.assertFlow.success"));
        return;
      } catch {}
    }

    const tx = await oracleContract.requestOutcome(marketId, outcomeIndex, claimBytes);
    await tx.wait();

    setMsg(t("settlement.assertFlow.success"));
  } catch (e: any) {
    console.error(e);
    setMsg(
      formatTranslation(t("settlement.assertFlow.failed"), {
        reason: String(e?.message || "Unknown error"),
      })
    );
    throw e;
  }
}

export async function settleAdapterAction(args: {
  market: MarketInfo;
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  setMsg: (msg: string | null) => void;
}) {
  const { market, walletProvider, switchNetwork, setMsg } = args;

  try {
    setMsg(t("settlement.settleFlow.prepare"));

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const marketContract = new ethers.Contract(
      market.market,
      ["function oracle() view returns (address)", "function marketId() view returns (bytes32)"],
      signer
    );
    const oracleAddress = await marketContract.oracle();
    const marketId = await marketContract.marketId();

    const oracleContract = new ethers.Contract(oracleAddress, ORACLE_ADAPTER_ABI, signer);

    setMsg(t("settlement.settleFlow.settling"));

    if (isAaEnabled()) {
      try {
        const oracleIface = new ethers.Interface(ORACLE_ADAPTER_ABI);
        const data = oracleIface.encodeFunctionData("settleOutcome", [marketId]);
        await trySubmitAaCalls({ chainId: market.chain_id, calls: [{ to: oracleAddress, data }] });
        setMsg(t("settlement.settleFlow.success"));
        return;
      } catch {}
    }

    const tx = await oracleContract.settleOutcome(marketId);
    await tx.wait();

    setMsg(t("settlement.settleFlow.success"));
  } catch (e: any) {
    console.error(e);
    setMsg(
      formatTranslation(t("settlement.settleFlow.failed"), {
        reason: String(e?.message || "Unknown error"),
      })
    );
    throw e;
  }
}

export async function resolveMarketAction(args: {
  market: MarketInfo;
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  setMsg: (msg: string | null) => void;
}) {
  const { market, walletProvider, switchNetwork, setMsg } = args;

  try {
    setMsg(t("settlement.resolveFlow.prepare"));

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const marketContract = new ethers.Contract(market.market, MARKET_ABI, signer);

    setMsg(t("settlement.resolveFlow.resolving"));

    if (isAaEnabled()) {
      try {
        const marketIface = new ethers.Interface(MARKET_ABI);
        const data = marketIface.encodeFunctionData("resolve", []);
        await trySubmitAaCalls({ chainId: market.chain_id, calls: [{ to: market.market, data }] });
        setMsg(t("settlement.resolveFlow.success"));
        return;
      } catch {}
    }

    const tx = await marketContract.resolve();
    await tx.wait();

    setMsg(t("settlement.resolveFlow.success"));
  } catch (e: any) {
    console.error(e);
    setMsg(
      formatTranslation(t("settlement.resolveFlow.failed"), {
        reason: String(e?.message || "Unknown error"),
      })
    );
    throw e;
  }
}
