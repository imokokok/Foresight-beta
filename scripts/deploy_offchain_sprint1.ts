/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

/**
 * =================================================================
 * Foresight 合约部署脚本 - 链下订单簿架构
 * =================================================================
 *
 * 使用方法:
 *
 * 1. 配置环境变量 (.env 或 .env.local):
 *    - PRIVATE_KEY: 部署者私钥
 *    - AMOY_RPC_URL: Polygon Amoy RPC URL
 *    - USDC_ADDRESS_AMOY: USDC 地址 (默认: 0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf)
 *    - UMA_OO_V3_ADDRESS: UMA Oracle 地址 (测试网可用部署者地址)
 *    - UMA_REPORTER_ADDRESS: Reporter 地址 (可选，默认用部署者)
 *
 * 2. 运行部署:
 *    npx hardhat run scripts/deploy_offchain_sprint1.ts --network polygonAmoy
 *
 * 3. 部署后:
 *    - 合约地址保存在 deployment_offchain_sprint1.json
 *    - 将地址复制到前端 .env.local
 *
 * =================================================================
 */

function getUSDC(chainId: number, env: NodeJS.ProcessEnv): string {
  const addresses: Record<number, string> = {
    137: env.USDC_ADDRESS_POLYGON || env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON || "",
    80002:
      env.USDC_ADDRESS_AMOY ||
      env.NEXT_PUBLIC_USDC_ADDRESS_AMOY ||
      "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf",
    11155111: env.USDC_ADDRESS_SEPOLIA || env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA || "",
    1337: env.USDC_ADDRESS_LOCALHOST || env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST || "",
  };

  return (
    env.COLLATERAL_TOKEN_ADDRESS ||
    addresses[chainId] ||
    env.USDC_ADDRESS ||
    env.NEXT_PUBLIC_USDC_ADDRESS ||
    ""
  );
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const env = process.env;

  const usdc = getUSDC(chainId, env);
  if (!usdc) {
    throw new Error(
      `Missing USDC collateral address for chainId ${chainId}. Set COLLATERAL_TOKEN_ADDRESS or USDC_ADDRESS_*.`
    );
  }

  const umaOO =
    env.UMA_OO_V3_ADDRESS || env.UMA_OPTIMISTIC_ORACLE_ADDRESS || env.ORACLE_ADDRESS || "";
  if (!umaOO) {
    throw new Error("Missing UMA_OO_V3_ADDRESS env (UMA Optimistic Oracle V3 address).");
  }

  // Deploy OutcomeToken1155
  const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");
  const outcome1155 = await OutcomeToken1155.deploy();
  await outcome1155.waitForDeployment();
  await outcome1155.initialize("");
  const outcome1155Address = await outcome1155.getAddress();
  console.log("OutcomeToken1155:", outcome1155Address);

  // Deploy UMAOracleAdapterV2
  const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
  const reporter = env.UMA_REPORTER_ADDRESS || deployerAddress;
  const umaAdapter = await UMAOracleAdapterV2.deploy(umaOO, usdc, deployerAddress, reporter);
  await umaAdapter.waitForDeployment();
  const umaAdapterAddress = await umaAdapter.getAddress();
  console.log("UMAOracleAdapterV2:", umaAdapterAddress, "reporter:", reporter);

  // Deploy MarketFactory + initialize defaultOracle = UMA adapter
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const mf = await MarketFactory.deploy();
  await mf.waitForDeployment();
  await mf.initialize(deployerAddress, umaAdapterAddress);
  const defaultFeeBps = env.MARKET_FEE_BPS ? Number(env.MARKET_FEE_BPS) : 40;
  const feeRecipient = env.MARKET_FEE_TO || "0x377f4bB22F0eBd9238C1A30A8872fd00fB0B6F43";
  await mf.setFee(defaultFeeBps, feeRecipient);
  const mfAddress = await mf.getAddress();
  console.log("MarketFactory:", mfAddress);

  // Deploy templates
  const OffchainBinaryMarket = await hre.ethers.getContractFactory("OffchainBinaryMarket");
  const binImpl = await OffchainBinaryMarket.deploy();
  await binImpl.waitForDeployment();
  const binImplAddress = await binImpl.getAddress();
  console.log("OffchainBinaryMarket impl:", binImplAddress);

  const OffchainMultiMarket8 = await hre.ethers.getContractFactory("OffchainMultiMarket8");
  const multiImpl = await OffchainMultiMarket8.deploy();
  await multiImpl.waitForDeployment();
  const multiImplAddress = await multiImpl.getAddress();
  console.log("OffchainMultiMarket8 impl:", multiImplAddress);

  // Register templates
  const templateBinary = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const templateMulti = hre.ethers.id("OFFCHAIN_MULTI8_V1");
  await (await mf.registerTemplate(templateBinary, binImplAddress, "Offchain Binary v1")).wait();
  await (
    await mf.registerTemplate(templateMulti, multiImplAddress, "Offchain Multi(<=8) v1")
  ).wait();

  // Create example markets
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS
    ? Number(env.MARKET_RESOLUTION_TS)
    : now + 7 * 24 * 3600;

  // Binary: data = abi.encode(outcome1155)
  const dataBin = new hre.ethers.AbiCoder().encode(["address"], [outcome1155Address]);
  // 使用完整签名避免重载歧义
  const receiptBin = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateBinary,
      usdc,
      umaAdapterAddress,
      0,
      resolutionTime,
      dataBin
    )
  ).wait();
  const createdBinLog = receiptBin.logs.find((l: any) => {
    try {
      return mf.interface.parseLog(l).name === "MarketCreated";
    } catch {
      return false;
    }
  });
  const createdBinParsed = createdBinLog ? mf.interface.parseLog(createdBinLog) : null;
  const binaryMarket = createdBinParsed
    ? (createdBinParsed.args.market ?? createdBinParsed.args[1])
    : undefined;
  console.log("Created binary market:", binaryMarket);

  // Multi: data = abi.encode(outcome1155, uint8 outcomeCount)
  const outcomeCount = Math.max(2, Math.min(8, env.OUTCOME_COUNT ? Number(env.OUTCOME_COUNT) : 3));
  const dataMulti = new hre.ethers.AbiCoder().encode(
    ["address", "uint8"],
    [outcome1155Address, outcomeCount]
  );
  const receiptMulti = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateMulti,
      usdc,
      umaAdapterAddress,
      0,
      resolutionTime,
      dataMulti
    )
  ).wait();
  const createdMultiLog = receiptMulti.logs.find((l: any) => {
    try {
      return mf.interface.parseLog(l).name === "MarketCreated";
    } catch {
      return false;
    }
  });
  const createdMultiParsed = createdMultiLog ? mf.interface.parseLog(createdMultiLog) : null;
  const multiMarket = createdMultiParsed
    ? (createdMultiParsed.args.market ?? createdMultiParsed.args[1])
    : undefined;
  console.log("Created multi market:", multiMarket, "outcomeCount:", outcomeCount);

  // Grant MINTER_ROLE to markets
  if (binaryMarket) await (await outcome1155.grantMinter(binaryMarket)).wait();
  if (multiMarket) await (await outcome1155.grantMinter(multiMarket)).wait();

  const deploymentInfo = {
    network: hre.network.name,
    chainId,
    deployer: deployerAddress,
    collateralUSDC: usdc,
    outcome1155: outcome1155Address,
    umaOOv3: umaOO,
    umaAdapterV2: umaAdapterAddress,
    marketFactory: mfAddress,
    templates: {
      offchainBinary: binImplAddress,
      offchainMulti8: multiImplAddress,
      templateIds: {
        binary: templateBinary,
        multi: templateMulti,
      },
    },
    markets: { binary: binaryMarket, multi: multiMarket, multiOutcomeCount: outcomeCount },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync("deployment_offchain_sprint1.json", JSON.stringify(deploymentInfo, null, 2));

  // 打印前端配置指南
  console.log("\n" + "=".repeat(60));
  console.log("✅ 部署完成！");
  console.log("=".repeat(60));
  console.log("\n📋 请将以下环境变量添加到前端 apps/web/.env.local:\n");
  console.log(`NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${mfAddress}`);
  console.log(`NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS=${outcome1155Address}`);
  console.log(`NEXT_PUBLIC_UMA_ADAPTER_ADDRESS=${umaAdapterAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdc}`);
  console.log(`\n📋 示例市场地址（用于测试）:`);
  console.log(`NEXT_PUBLIC_BINARY_MARKET_ADDRESS=${binaryMarket}`);
  console.log(`NEXT_PUBLIC_MULTI_MARKET_ADDRESS=${multiMarket}`);
  console.log("\n" + "=".repeat(60));
  console.log("📄 完整部署信息已保存到 deployment_offchain_sprint1.json");
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
