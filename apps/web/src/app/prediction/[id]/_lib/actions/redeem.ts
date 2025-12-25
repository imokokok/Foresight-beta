import { ethers } from "ethers";
import type { MarketInfo } from "../marketTypes";
import {
  createBrowserProvider,
  ensureNetwork,
  getCollateralTokenContract,
  parseUnitsByDecimals,
} from "../wallet";

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
  } = args;
  try {
    setOrderMsg("准备赎回...");

    const provider = await createBrowserProvider(walletProvider);
    await ensureNetwork(provider, market.chain_id, switchNetwork);
    const signer = await provider.getSigner();

    const { decimals } = await getCollateralTokenContract(market, signer, erc20Abi);
    const amountBN = parseUnitsByDecimals(amountStr, decimals);

    const marketContract = new ethers.Contract(market.market, marketAbi, signer);
    const outcomeTokenAddress = await marketContract.outcomeToken();
    const outcome1155 = new ethers.Contract(outcomeTokenAddress, erc1155Abi, signer);

    const isApproved = await outcome1155.isApprovedForAll(account, market.market);
    if (!isApproved) {
      setOrderMsg("请授权预测代币...");
      const txApp = await outcome1155.setApprovalForAll(market.market, true);
      await txApp.wait();
    }

    setOrderMsg("正在赎回...");
    const tx = await marketContract.depositCompleteSet(amountBN);
    await tx.wait();

    setOrderMsg("赎回成功！USDC 已退回。");
  } catch (e: any) {
    setOrderMsg("赎回失败: " + (e.message || "未知错误"));
  }
}
