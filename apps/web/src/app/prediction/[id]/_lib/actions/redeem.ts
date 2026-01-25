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

export async function redeemAction(args: {
  amountStr: string;
  market: MarketInfo;
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  erc20Abi: any;
  erc1155Abi: any;
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
    erc1155Abi,
    marketAbi,
    setOrderMsg,
    useProxy,
    proxyAddress,
  } = args;
  try {
    setOrderMsg(t("trading.redeemFlow.prepare"));

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const amount18 = parseUnitsByDecimals(amountStr, 18);
    if (amount18 % 1_000_000_000_000n !== 0n) {
      throw new Error(t("trading.orderFlow.invalidAmountPrecision"));
    }

    const marketContract = new ethers.Contract(market.market, marketAbi, signer);
    const outcomeTokenAddress = await marketContract.outcomeToken();
    const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

    if (useProxy && proxyAddress) {
      const isApproved = await outcome1155.isApprovedForAll(proxyAddress, market.market);
      if (!isApproved) {
        setOrderMsg(t("trading.redeemFlow.approveOutcomeToken"));
        const erc1155Iface = new ethers.Interface(erc1155Abi);
        const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [
          market.market,
          true,
        ]);
        await executeSafeTransaction(signer, proxyAddress, outcomeTokenAddress, approveData);
      }

      setOrderMsg(t("trading.redeemFlow.redeeming"));
      const marketIface = new ethers.Interface(marketAbi);
      const state = Number(await marketContract.state());
      let redeemData;
      if (state === 1) {
        redeemData = marketIface.encodeFunctionData("redeem", [amount18]);
      } else if (state === 2) {
        redeemData = marketIface.encodeFunctionData("redeemCompleteSetOnInvalid", [amount18]);
      } else {
        throw new Error(t("trading.redeemFlow.marketNotResolved"));
      }
      await executeSafeTransaction(signer, proxyAddress, market.market, redeemData);

      setOrderMsg(t("trading.redeemFlow.success"));
      return;
    }

    if (isAaEnabled()) {
      try {
        const calls = [];
        // 1. Approve Outcome Token
        const erc1155Iface = new ethers.Interface(erc1155Abi);
        const approveData = erc1155Iface.encodeFunctionData("setApprovalForAll", [
          market.market,
          true,
        ]);
        calls.push({
          to: outcomeTokenAddress,
          data: approveData,
        });

        // 2. Redeem
        const marketIface = new ethers.Interface(marketAbi);
        const state = Number(await marketContract.state());
        let redeemData;
        if (state === 1) {
          redeemData = marketIface.encodeFunctionData("redeem", [amount18]);
        } else if (state === 2) {
          redeemData = marketIface.encodeFunctionData("redeemCompleteSetOnInvalid", [amount18]);
        } else {
          throw new Error(t("trading.redeemFlow.marketNotResolved"));
        }
        calls.push({
          to: market.market,
          data: redeemData,
        });

        setOrderMsg(t("trading.redeemFlow.redeeming"));
        await trySubmitAaCalls({ chainId: market.chain_id, calls });
        setOrderMsg(t("trading.redeemFlow.success"));
        return;
      } catch (e) {
        const error = e as Error;
        console.error("AA redeem failed", error);
      }
    }

    const isApproved = await outcome1155.isApprovedForAll(account, market.market);
    if (!isApproved) {
      setOrderMsg(t("trading.redeemFlow.approveOutcomeToken"));
      const txApp = await outcome1155.setApprovalForAll(market.market, true);
      await txApp.wait();
    }

    setOrderMsg(t("trading.redeemFlow.redeeming"));
    const state = Number(await marketContract.state());
    let tx;
    if (state === 1) {
      tx = await marketContract.redeem(amount18);
    } else if (state === 2) {
      tx = await marketContract.redeemCompleteSetOnInvalid(amount18);
    } else {
      throw new Error(t("trading.redeemFlow.marketNotResolved"));
    }
    await tx.wait();

    setOrderMsg(t("trading.redeemFlow.success"));
  } catch (e) {
    const error = e as Error;
    setOrderMsg(
      formatTranslation(t("trading.redeemFlow.failed"), {
        reason: String(error?.message || t("trading.redeemFlow.unknownError")),
      })
    );
  }
}
