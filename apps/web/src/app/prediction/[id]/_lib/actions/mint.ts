import { ethers } from "ethers";
import { formatTranslation, t } from "@/lib/i18n";
import type { MarketInfo } from "../marketTypes";
import {
  createBrowserProvider,
  ensureNetwork,
  getCollateralTokenContract,
  parseUnitsByDecimals,
} from "../wallet";
import { trySubmitAaCalls, isAaEnabled } from "../aaUtils";
import { executeSafeTransaction } from "@/lib/safeUtils";

export async function mintAction(args: {
  amountStr: string;
  market: MarketInfo;
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  erc20Abi: any;
  marketAbi: any;
  setOrderMsg: (msg: string | null) => void;
  useProxy?: boolean;
  proxyAddress?: string;
}) {
  const {
    amountStr,
    market,
    account,
    walletProvider,
    switchNetwork,
    erc20Abi,
    marketAbi,
    setOrderMsg,
    useProxy,
    proxyAddress,
  } = args;
  try {
    setOrderMsg(t("trading.mintFlow.prepare"));

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const { tokenContract } = await getCollateralTokenContract(market, signer, erc20Abi);

    // Check decimals to ensure compatibility with contract's hardcoded 1e6 scale
    const decimals = await tokenContract.decimals();
    if (Number(decimals) !== 6) {
      throw new Error(
        t("trading.mintFlow.invalidDecimals") ||
          `Collateral token must have 6 decimals (current: ${decimals})`
      );
    }

    const amount18 = parseUnitsByDecimals(amountStr, 18);
    if (amount18 % 1_000_000_000_000n !== 0n) {
      throw new Error(t("trading.orderFlow.invalidAmountPrecision"));
    }
    // USDC deposit is amount18 * 1e6 / 1e18
    const deposit6 = (amount18 * 1_000_000n) / 1_000_000_000_000_000_000n;

    if (useProxy && proxyAddress) {
      const allowance = await tokenContract.allowance(proxyAddress, market.market);
      if (allowance < deposit6) {
        setOrderMsg(t("trading.mintFlow.approveUsdc"));
        const erc20Iface = new ethers.Interface(erc20Abi);
        const approveData = erc20Iface.encodeFunctionData("approve", [
          market.market,
          ethers.MaxUint256,
        ]);
        await executeSafeTransaction(
          signer,
          proxyAddress,
          String(tokenContract.target),
          approveData
        );
      }

      setOrderMsg(t("trading.mintFlow.minting"));
      const marketIface = new ethers.Interface(marketAbi);
      const mintData = marketIface.encodeFunctionData("mintCompleteSet", [amount18]);
      await executeSafeTransaction(signer, proxyAddress, market.market, mintData);

      setOrderMsg(t("trading.mintFlow.success"));
      return;
    }

    if (isAaEnabled()) {
      try {
        const calls = [];
        const erc20Iface = new ethers.Interface(erc20Abi);
        const approveData = erc20Iface.encodeFunctionData("approve", [
          market.market,
          ethers.MaxUint256,
        ]);
        calls.push({
          to: String(tokenContract.target),
          data: approveData,
        });

        const marketIface = new ethers.Interface(marketAbi);
        const mintData = marketIface.encodeFunctionData("mintCompleteSet", [amount18]);
        calls.push({
          to: market.market,
          data: mintData,
        });

        setOrderMsg(t("trading.mintFlow.minting"));
        await trySubmitAaCalls({ chainId: market.chain_id, calls });

        setOrderMsg(t("trading.mintFlow.success"));
        return;
      } catch (e) {
        const error = e as Error;
        console.error("AA mint failed, falling back to EOA", error);
      }
    }

    const allowance = await tokenContract.allowance(account, market.market);
    if (allowance < deposit6) {
      setOrderMsg(t("trading.mintFlow.approveUsdc"));
      const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
      await txApp.wait();
    }

    setOrderMsg(t("trading.mintFlow.minting"));
    const marketContract = new ethers.Contract(market.market, marketAbi, signer);

    try {
      await marketContract.mintCompleteSet.estimateGas(amount18);
    } catch (err) {
      const error = err as Error & { reason?: string; message?: string };
      throw new Error(
        formatTranslation(t("trading.mintFlow.estimateFailed"), {
          reason: String(error?.reason || error?.message || ""),
        })
      );
    }

    const tx = await marketContract.mintCompleteSet(amount18);
    await tx.wait();

    setOrderMsg(t("trading.mintFlow.success"));
  } catch (e) {
    const error = e as Error;
    setOrderMsg(
      formatTranslation(t("trading.mintFlow.failed"), {
        reason: String(error?.message || t("trading.mintFlow.unknownError")),
      })
    );
  }
}
