"use client";
import { ethers } from "ethers";

export async function switchNetwork(provider: any, chainId: number): Promise<void> {
  if (!provider) throw new Error("Wallet provider not found");

  const chainIdHex = "0x" + chainId.toString(16);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      let chainParams = null;
      if (chainId === 80002) {
        chainParams = {
          chainId: "0x13882",
          chainName: "Polygon Amoy Testnet",
          nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
          rpcUrls: [
            process.env.NEXT_PUBLIC_RPC_POLYGON_AMOY || "https://rpc-amoy.polygon.technology/",
          ],
          blockExplorerUrls: ["https://amoy.polygonscan.com/"],
        };
      } else if (chainId === 137) {
        chainParams = {
          chainId: "0x89",
          chainName: "Polygon Mainnet",
          nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
          rpcUrls: [process.env.NEXT_PUBLIC_RPC_POLYGON || "https://polygon-rpc.com"],
          blockExplorerUrls: ["https://polygonscan.com/"],
        };
      } else if (chainId === 11155111) {
        chainParams = {
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        };
      }

      if (chainParams) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [chainParams],
          });
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
        } catch (addError: any) {
          throw new Error("添加网络失败: " + (addError.message || "未知错误"));
        }
      } else {
        throw new Error("请在钱包中添加该网络");
      }
    } else if (switchError.code === 4001) {
      throw new Error("用户取消了切换网络");
    } else {
      throw switchError;
    }
  }

  try {
    const browserProvider = new ethers.BrowserProvider(provider);
    const network = await browserProvider.getNetwork();
    const hexChainId =
      typeof network.chainId === "bigint"
        ? "0x" + network.chainId.toString(16)
        : "0x" + Number(network.chainId).toString(16);
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      accounts[0];
    }
  } catch {}
}
