import { ethers } from "ethers";
import { normalizeAddress } from "./serverUtils";

export function deriveProxyWalletAddress(baseAddress: string, proxyType: string) {
  const seed = `foresight-proxy:${proxyType}:${baseAddress.toLowerCase()}`;
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  const body = hash.slice(-40);
  return normalizeAddress(`0x${body}`);
}

export function resolveSaltNonce(ownerEoa: string, chainId: number): bigint {
  const raw = String(process.env.SAFE_SALT_NONCE || "").trim();
  if (raw) {
    try {
      if (/^0x[0-9a-fA-F]+$/.test(raw)) return BigInt(raw);
      if (/^\d+$/.test(raw)) return BigInt(raw);
    } catch {}
  }
  const seed = `foresight-safe:${chainId}:${ownerEoa.toLowerCase()}`;
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(seed)));
}

export function encodeSafeInitializer(params: {
  ownerEoa: string;
  fallbackHandler: string;
}): string {
  const iface = new ethers.Interface([
    "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)",
  ]);
  return iface.encodeFunctionData("setup", [
    [params.ownerEoa],
    1,
    ethers.ZeroAddress,
    "0x",
    params.fallbackHandler,
    ethers.ZeroAddress,
    0,
    ethers.ZeroAddress,
  ]);
}

export async function computeSafeCounterfactualAddress(params: {
  provider: ethers.JsonRpcProvider;
  factoryAddress: string;
  singletonAddress: string;
  initializer: string;
  saltNonce: bigint;
}): Promise<string> {
  const factory = new ethers.Contract(
    params.factoryAddress,
    [
      "function calculateCreateProxyWithNonceAddress(address _singleton, bytes initializer, uint256 saltNonce) view returns (address)",
      "function proxyCreationCode() view returns (bytes)",
    ],
    params.provider
  );

  try {
    const addr = await factory.calculateCreateProxyWithNonceAddress(
      params.singletonAddress,
      params.initializer,
      params.saltNonce
    );
    const normalized = normalizeAddress(String(addr || ""));
    if (normalized) return normalized;
  } catch {}

  const creationCode = await factory.proxyCreationCode();
  const deploymentData = ethers.solidityPacked(
    ["bytes", "uint256"],
    [creationCode, BigInt(params.singletonAddress)]
  );
  const initializerHash = ethers.keccak256(params.initializer);
  const salt = ethers.keccak256(
    ethers.solidityPacked(["bytes32", "uint256"], [initializerHash, params.saltNonce])
  );
  const initCodeHash = ethers.keccak256(deploymentData);
  return normalizeAddress(ethers.getCreate2Address(params.factoryAddress, salt, initCodeHash));
}
