import { createOrderDomain } from "@/lib/orderVerification";
import { toast } from "@/lib/toast";
import { API_BASE } from "../constants";
import { safeJson } from "../http";
import { createBrowserProvider } from "../wallet";
import type { MarketInfo } from "../marketTypes";

export async function cancelOrderAction(args: {
  salt: string;
  account: string;
  market: MarketInfo;
  walletProvider: any;
  predictionIdRaw: string | number;
  tTrading: (key: string) => string;
  setOrderMsg: (msg: string | null) => void;
  setOpenOrders: (updater: (prev: any[]) => any[]) => void;
}) {
  const {
    salt,
    account,
    market,
    walletProvider,
    predictionIdRaw,
    tTrading,
    setOrderMsg,
    setOpenOrders,
  } = args;
  try {
    const provider = await createBrowserProvider(walletProvider);
    const signer = await provider.getSigner();

    const domain = createOrderDomain(market.chain_id, market.market);
    const types = {
      CancelSaltRequest: [
        { name: "maker", type: "address" },
        { name: "salt", type: "uint256" },
      ],
    } as const;
    const value = {
      maker: account,
      salt: BigInt(salt),
    };
    const signature = await signer.signTypedData(domain as any, types as any, value as any);

    const mk = `${market.chain_id}:${predictionIdRaw}`;

    const res = await fetch(`${API_BASE}/orderbook/cancel-salt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: market.chain_id,
        verifyingContract: market.market,
        contract: market.market,
        marketKey: mk,
        salt,
        maker: account,
        signature,
      }),
    });

    const json = await safeJson(res);
    if (json.success) {
      setOrderMsg("订单已取消");
      setOpenOrders((prev) => prev.filter((o) => o.maker_salt !== salt));
    } else {
      throw new Error(json.message || "取消失败");
    }
    toast.success(
      tTrading("toast.cancelOrderSuccessTitle"),
      tTrading("toast.cancelOrderSuccessDesc")
    );
  } catch (error: any) {
    const description = error?.message || tTrading("toast.retryLater");
    toast.error(tTrading("toast.cancelOrderFailedTitle"), description);
  }
}
