import { ethers } from "ethers";
import {
  computeSafeCounterfactualAddress,
  resolveSaltNonce,
  encodeSafeInitializer,
} from "../safeUtils";
import { getChainAddresses, getConfiguredRpcUrl } from "../runtimeConfig";
import { getProxyWalletConfig } from "../serverUtils";

const SAFE_4337_MODULE_ABI = [
  "function executeUserOp(address to, uint256 value, bytes data, uint8 operation)",
];

const MULTISEND_ABI = ["function multiSend(bytes transactions)"];

const MULTISEND_ADDRESS = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D";

const ENTRYPOINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256 nonce)",
];

export interface UserOperation {
  sender: string;
  nonce: string; // Hex string for compatibility
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export async function buildUserOpFromCalls(
  chainId: number,
  ownerEoa: string,
  calls: Array<{ to: string; data: string; value?: string }>
): Promise<UserOperation> {
  const rpcUrl = getConfiguredRpcUrl(chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const addresses = getChainAddresses(chainId);

  if (!addresses.entryPoint) throw new Error("EntryPoint not configured");
  const entryPoint = new ethers.Contract(addresses.entryPoint, ENTRYPOINT_ABI, provider);

  const proxyConfig = getProxyWalletConfig();
  if (!proxyConfig.ok || !proxyConfig.config) throw new Error("Proxy config missing");

  const factoryAddress = proxyConfig.config.safeFactoryAddress;
  const singletonAddress = proxyConfig.config.safeSingletonAddress;
  const fallbackHandler = proxyConfig.config.safeFallbackHandlerAddress || ethers.ZeroAddress;

  if (!factoryAddress || !singletonAddress) throw new Error("Safe Factory/Singleton missing");

  // 1. Get/Compute Sender
  const saltNonce = resolveSaltNonce(ownerEoa, chainId);
  const initializer = encodeSafeInitializer({ ownerEoa, fallbackHandler });

  const sender = await computeSafeCounterfactualAddress({
    provider,
    factoryAddress,
    singletonAddress,
    initializer,
    saltNonce,
  });

  // 2. Get Nonce
  let nonce = 0n;
  let isDeployed = false;
  const code = await provider.getCode(sender);
  if (code && code !== "0x") {
    isDeployed = true;
    try {
      nonce = await entryPoint.getNonce(sender, 0);
    } catch {
      nonce = 0n;
    }
  } else {
    nonce = 0n;
  }

  // 3. InitCode
  let initCode = "0x";
  if (!isDeployed) {
    const factory = new ethers.Contract(
      factoryAddress,
      [
        "function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)",
      ],
      provider
    );
    const data = factory.interface.encodeFunctionData("createProxyWithNonce", [
      singletonAddress,
      initializer,
      saltNonce,
    ]);
    initCode = ethers.solidityPacked(["address", "bytes"], [factoryAddress, data]);
  }

  // 4. CallData
  let callData = "0x";
  const safe4337Module = new ethers.Interface(SAFE_4337_MODULE_ABI);

  if (calls.length === 1) {
    const call = calls[0];
    callData = safe4337Module.encodeFunctionData("executeUserOp", [
      call.to,
      BigInt(call.value || 0),
      call.data,
      0, // Operation.Call
    ]);
  } else {
    const multiSend = new ethers.Interface(MULTISEND_ABI);
    let packed = "0x";
    for (const call of calls) {
      const operation = 0; // Call
      const to = call.to;
      const value = BigInt(call.value || 0);
      const data = call.data;
      const dataLen = ethers.dataLength(data);

      // solidityPacked doesn't handle the dynamic bytes + length prefix exactly as MultiSend expects if not careful
      // MultiSend expects: [operation 1b][to 20b][value 32b][dataLength 32b][data bytes]
      // ethers.solidityPacked will pack them tightly.

      const part = ethers.solidityPacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [operation, to, value, dataLen, data]
      );
      // part includes 0x, we remove it
      packed += part.slice(2);
    }

    const multiSendData = multiSend.encodeFunctionData("multiSend", ["0x" + packed.slice(2)]);

    callData = safe4337Module.encodeFunctionData("executeUserOp", [
      MULTISEND_ADDRESS,
      0,
      multiSendData,
      1, // Operation.DelegateCall
    ]);
  }

  // 5. Gas & Fee
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 1000000000n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 1000000000n;

  // Use conservative limits since we are not using a proper bundler estimate here
  // In production, we should call eth_estimateUserOperationGas
  const callGasLimit = 2_000_000n;
  const verificationGasLimit = 1_000_000n;
  const preVerificationGas = 100_000n;

  return {
    sender,
    nonce: "0x" + nonce.toString(16),
    initCode,
    callData,
    callGasLimit: "0x" + callGasLimit.toString(16),
    verificationGasLimit: "0x" + verificationGasLimit.toString(16),
    preVerificationGas: "0x" + preVerificationGas.toString(16),
    maxFeePerGas: "0x" + maxFeePerGas.toString(16),
    maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
    paymasterAndData: "0x",
    signature: "0x",
  };
}
