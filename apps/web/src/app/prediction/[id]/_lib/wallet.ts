import { ethers } from "ethers";

export async function createBrowserProvider(walletProvider: any) {
  return new ethers.BrowserProvider(walletProvider);
}

export async function ensureNetwork(
  provider: ethers.BrowserProvider,
  targetChainId: number,
  switchNetwork: (chainId: number) => Promise<void>
) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== targetChainId) {
    await switchNetwork(targetChainId);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export function resolveAddresses(chainId: number): { foresight: string; usdc: string } {
  const defaultForesight = (process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS || "").trim();
  const defaultUsdc = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "").trim();

  const map: Record<number, { foresight?: string; usdc?: string }> = {
    137: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_POLYGON,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON,
    },
    80002: {
      foresight:
        process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_AMOY ||
        "0xBec1Fd7e69346aCBa7C15d6E380FcCA993Ea6b02",
      usdc:
        process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY || "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf",
    },
    11155111: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_SEPOLIA,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA,
    },
    31337: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST,
    },
    1337: {
      foresight: process.env.NEXT_PUBLIC_FORESIGHT_ADDRESS_LOCALHOST,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST,
    },
  };

  const fromMap = map[chainId] || {};
  const foresight = (fromMap.foresight || defaultForesight || "").trim();
  const usdc = (fromMap.usdc || defaultUsdc || "").trim();

  return { foresight, usdc };
}

export async function getCollateralTokenContract(
  market: { market: string; chain_id: number; collateral_token?: string },
  signer: ethers.Signer,
  erc20Abi: readonly string[]
) {
  const addresses = resolveAddresses(market.chain_id);
  const collateralToken = market.collateral_token || addresses.usdc;
  const tokenContract = new ethers.Contract(collateralToken, erc20Abi, signer);
  const decimals = await tokenContract.decimals();
  return { tokenContract, decimals: Number(decimals) };
}

export function parseUnitsByDecimals(value: number | string, decimals: number): bigint {
  const str = typeof value === "number" ? String(value) : value;
  try {
    return ethers.parseUnits(str, decimals);
  } catch {
    const parts = str.split(".");
    if (parts.length === 1) {
      return BigInt(parts[0]) * BigInt(10) ** BigInt(decimals);
    }
    const [intPart, fracRaw] = parts;
    const frac = (fracRaw || "").slice(0, decimals).padEnd(decimals, "0");
    return BigInt(intPart || "0") * BigInt(10) ** BigInt(decimals) + BigInt(frac || "0");
  }
}
