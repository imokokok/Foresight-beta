/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

/**
 * 重新部署模板并创建市场
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  // 已部署的合约地址
  const outcome1155Address = "0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087";
  const umaAdapterAddress = "0x5e42fce766Ad623cE175002B7b2528411C47cc92";
  const mfAddress = "0x0762A2EeFEB20f03ceA60A542FfC8CEC85FE8A30";
  const usdc = "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf";
  const umaOO = process.env.UMA_OO_V3_ADDRESS || "0xC14eE1A093c5B715d5aC2E7F9bAEf1a50dB86148";

  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");
  const mf = MarketFactory.attach(mfAddress);
  const outcome1155 = OutcomeToken1155.attach(outcome1155Address);

  // 部署新的模板实现
  console.log("\n=== Deploying new template implementations ===");

  const OffchainBinaryMarket = await hre.ethers.getContractFactory("OffchainBinaryMarket");
  const binImpl = await OffchainBinaryMarket.deploy();
  await binImpl.waitForDeployment();
  const binImplAddress = await binImpl.getAddress();
  console.log("New OffchainBinaryMarket impl:", binImplAddress);

  const OffchainMultiMarket8 = await hre.ethers.getContractFactory("OffchainMultiMarket8");
  const multiImpl = await OffchainMultiMarket8.deploy();
  await multiImpl.waitForDeployment();
  const multiImplAddress = await multiImpl.getAddress();
  console.log("New OffchainMultiMarket8 impl:", multiImplAddress);

  // 移除旧模板，注册新模板
  console.log("\n=== Updating template registrations ===");
  const templateBinary = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const templateMulti = hre.ethers.id("OFFCHAIN_MULTI8_V1");

  // 先移除旧的
  try {
    await (await mf.removeTemplate(templateBinary)).wait();
    console.log("Removed old binary template");
  } catch (e) {
    console.log("Binary template not found or already removed");
  }

  try {
    await (await mf.removeTemplate(templateMulti)).wait();
    console.log("Removed old multi template");
  } catch (e) {
    console.log("Multi template not found or already removed");
  }

  // 注册新的
  await (await mf.registerTemplate(templateBinary, binImplAddress, "Offchain Binary v1")).wait();
  console.log("Registered new binary template");

  await (
    await mf.registerTemplate(templateMulti, multiImplAddress, "Offchain Multi(<=8) v1")
  ).wait();
  console.log("Registered new multi template");

  // 创建市场
  console.log("\n=== Creating markets ===");
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = now + 7 * 24 * 3600;
  const feeBps = 0;

  // Binary market
  console.log("Creating binary market...");
  const dataBin = new hre.ethers.AbiCoder().encode(["address"], [outcome1155Address]);
  const receiptBin = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateBinary,
      usdc,
      umaAdapterAddress,
      feeBps,
      resolutionTime,
      dataBin
    )
  ).wait();

  const createdBinLog = receiptBin?.logs.find((l: any) => {
    try {
      return mf.interface.parseLog(l)?.name === "MarketCreated";
    } catch {
      return false;
    }
  });
  const createdBinParsed = createdBinLog ? mf.interface.parseLog(createdBinLog) : null;
  const binaryMarket = createdBinParsed
    ? (createdBinParsed.args.market ?? createdBinParsed.args[1])
    : undefined;
  console.log("✅ Created binary market:", binaryMarket);

  // Multi market
  console.log("Creating multi market (3 outcomes)...");
  const outcomeCount = 3;
  const dataMulti = new hre.ethers.AbiCoder().encode(
    ["address", "uint8"],
    [outcome1155Address, outcomeCount]
  );
  const receiptMulti = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateMulti,
      usdc,
      umaAdapterAddress,
      feeBps,
      resolutionTime,
      dataMulti
    )
  ).wait();

  const createdMultiLog = receiptMulti?.logs.find((l: any) => {
    try {
      return mf.interface.parseLog(l)?.name === "MarketCreated";
    } catch {
      return false;
    }
  });
  const createdMultiParsed = createdMultiLog ? mf.interface.parseLog(createdMultiLog) : null;
  const multiMarket = createdMultiParsed
    ? (createdMultiParsed.args.market ?? createdMultiParsed.args[1])
    : undefined;
  console.log("✅ Created multi market:", multiMarket);

  // Grant MINTER_ROLE
  console.log("\n=== Granting MINTER_ROLE ===");
  if (binaryMarket) {
    await (await outcome1155.grantMinter(binaryMarket)).wait();
    console.log("Granted MINTER_ROLE to binary market");
  }
  if (multiMarket) {
    await (await outcome1155.grantMinter(multiMarket)).wait();
    console.log("Granted MINTER_ROLE to multi market");
  }

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

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

  console.log("\n" + "=".repeat(60));
  console.log("✅ 部署完成！");
  console.log("=".repeat(60));
  console.log("\n📋 请将以下环境变量添加到前端 apps/web/.env.local:\n");
  console.log(`NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${mfAddress}`);
  console.log(`NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS=${outcome1155Address}`);
  console.log(`NEXT_PUBLIC_UMA_ADAPTER_ADDRESS=${umaAdapterAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdc}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
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
