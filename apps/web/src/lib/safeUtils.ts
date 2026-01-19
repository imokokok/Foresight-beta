import { ethers } from "ethers";
import { normalizeAddress } from "./address";

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

export async function deploySafe(params: {
  signer: ethers.Signer;
  factoryAddress: string;
  singletonAddress: string;
  initializer: string;
  saltNonce: bigint;
}) {
  const factory = new ethers.Contract(
    params.factoryAddress,
    [
      "function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
    ],
    params.signer
  );
  const tx = await factory.createProxyWithNonce(
    params.singletonAddress,
    params.initializer,
    params.saltNonce
  );
  return tx.wait();
}

export async function executeSafeTransaction(
  signer: ethers.Signer,
  safeAddress: string,
  to: string,
  data: string,
  value: bigint = 0n,
  operation: number = 0 // 0 = Call, 1 = DelegateCall
) {
  const safe = new ethers.Contract(
    safeAddress,
    [
      "function nonce() view returns (uint256)",
      "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool success)",
      "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 nonce) view returns (bytes32)",
    ],
    signer
  );

  const nonce = await safe.nonce();

  const txArgs = {
    to,
    value,
    data,
    operation,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ethers.ZeroAddress,
    refundReceiver: ethers.ZeroAddress,
    nonce,
  };

  const safeTxHash = await safe.getTransactionHash(
    txArgs.to,
    txArgs.value,
    txArgs.data,
    txArgs.operation,
    txArgs.safeTxGas,
    txArgs.baseGas,
    txArgs.gasPrice,
    txArgs.gasToken,
    txArgs.refundReceiver,
    txArgs.nonce
  );

  const signature = await signer.signMessage(ethers.getBytes(safeTxHash));

  // Adjust v for Safe eth_sign signature (v += 4)
  const sig = ethers.Signature.from(signature);
  let finalSig = signature;
  if (sig.v === 27 || sig.v === 28) {
    const v = sig.v + 4;
    finalSig = ethers.concat([sig.r, sig.s, new Uint8Array([v])]);
  }

  return safe.execTransaction(
    txArgs.to,
    txArgs.value,
    txArgs.data,
    txArgs.operation,
    txArgs.safeTxGas,
    txArgs.baseGas,
    txArgs.gasPrice,
    txArgs.gasToken,
    txArgs.refundReceiver,
    finalSig
  );
}
