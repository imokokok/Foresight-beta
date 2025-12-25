import { ethers } from "ethers";
import type { MarketInfo } from "../marketTypes";
import {
  createBrowserProvider,
  ensureNetwork,
  getCollateralTokenContract,
  parseUnitsByDecimals,
} from "../wallet";

export async function mintAction(args: {
  amountStr: string;
  market: MarketInfo;
  account: string;
  walletProvider: any;
  switchNetwork: (chainId: number) => Promise<any>;
  erc20Abi: any;
  marketAbi: any;
  setOrderMsg: (msg: string | null) => void;
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
  } = args;
  try {
    setOrderMsg("准备铸币...");

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const { tokenContract, decimals } = await getCollateralTokenContract(market, signer, erc20Abi);
    const amountBN = parseUnitsByDecimals(amountStr, decimals);

    const allowance = await tokenContract.allowance(account, market.market);
    if (allowance < amountBN) {
      setOrderMsg("请授权 USDC...");
      const txApp = await tokenContract.approve(market.market, ethers.MaxUint256);
      await txApp.wait();
    }

    setOrderMsg("正在铸币...");
    const marketContract = new ethers.Contract(market.market, marketAbi, signer);

    try {
      await marketContract.mintCompleteSet.estimateGas(amountBN);
    } catch (err: any) {
      throw new Error("铸币交易预估失败，请检查余额或权限: " + (err.reason || err.message));
    }

    const tx = await marketContract.mintCompleteSet(amountBN);
    await tx.wait();

    setOrderMsg("铸币成功！您现在可以出售代币了。");
  } catch (e: any) {
    setOrderMsg("铸币失败: " + (e.message || "未知错误"));
  }
}
