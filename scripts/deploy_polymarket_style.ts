/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying Offchain (Polymarket-style) prediction market system...");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`Deployer: ${deployerAddress}`);

  // --- UMA Specific Configuration ---
  // IMPORTANT: Set UMA_OO_V3_ADDRESS for your target network.
  const UMA_OO_V3_ADDRESS =
    process.env.UMA_OO_V3_ADDRESS || process.env.UMA_OPTIMISTIC_ORACLE_ADDRESS || "";
  if (!UMA_OO_V3_ADDRESS) {
    throw new Error("Missing UMA_OO_V3_ADDRESS env (UMA Optimistic Oracle V3 address).");
  }

  // Collateral (USDC)
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const env = process.env;
  const collateralTokenAddress =
    env.COLLATERAL_TOKEN_ADDRESS ||
    (chainId === 137 ? env.USDC_ADDRESS_POLYGON || env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON : "") ||
    (chainId === 80002 ? env.USDC_ADDRESS_AMOY || env.NEXT_PUBLIC_USDC_ADDRESS_AMOY : "") ||
    (chainId === 11155111
      ? env.USDC_ADDRESS_SEPOLIA || env.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA
      : "") ||
    (chainId === 1337
      ? env.USDC_ADDRESS_LOCALHOST || env.NEXT_PUBLIC_USDC_ADDRESS_LOCALHOST
      : "") ||
    env.USDC_ADDRESS ||
    env.NEXT_PUBLIC_USDC_ADDRESS ||
    "";
  if (!collateralTokenAddress) {
    throw new Error(
      `Missing USDC collateral address for chainId ${chainId}. Set COLLATERAL_TOKEN_ADDRESS or USDC_ADDRESS_*.`
    );
  }

  // 1. Deploy OutcomeToken1155
  const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");
  const outcomeToken1155 = await OutcomeToken1155.deploy();
  await outcomeToken1155.waitForDeployment();
  await outcomeToken1155.initialize("");
  const outcomeToken1155Address = await outcomeToken1155.getAddress();
  console.log(`OutcomeToken1155 deployed to: ${outcomeToken1155Address}`);

  // 2. Deploy UMAOracleAdapterV2 (production-oriented)
  const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
  const umaOracleAdapter = await UMAOracleAdapterV2.deploy(
    UMA_OO_V3_ADDRESS,
    collateralTokenAddress,
    deployerAddress,
    deployerAddress
  );
  await umaOracleAdapter.waitForDeployment();
  const umaOracleAdapterAddress = await umaOracleAdapter.getAddress();
  console.log(`UMAOracleAdapterV2 deployed to: ${umaOracleAdapterAddress}`);

  // 3. Deploy MarketFactory + initialize(defaultOracle=UMA adapter)
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const marketFactory = await MarketFactory.deploy();
  await marketFactory.waitForDeployment();
  await marketFactory.initialize(deployerAddress, umaOracleAdapterAddress);
  const marketFactoryAddress = await marketFactory.getAddress();
  console.log(`MarketFactory deployed to: ${marketFactoryAddress}`);

  const feeBpsWinner = 200;
  const feeToAddress = process.env.MARKET_FEE_TO || deployerAddress;
  await marketFactory.setFee(feeBpsWinner, feeToAddress);
  console.log(`MarketFactory fee set to ${feeBpsWinner} bps, feeTo=${feeToAddress}`);

  // 4. Deploy Offchain templates
  const OffchainBinaryMarket = await hre.ethers.getContractFactory("OffchainBinaryMarket");
  const offchainBinaryImpl = await OffchainBinaryMarket.deploy();
  await offchainBinaryImpl.waitForDeployment();
  const offchainBinaryImplAddress = await offchainBinaryImpl.getAddress();
  console.log("OffchainBinaryMarket template deployed:", offchainBinaryImplAddress);

  const OffchainMultiMarket8 = await hre.ethers.getContractFactory("OffchainMultiMarket8");
  const offchainMultiImpl = await OffchainMultiMarket8.deploy();
  await offchainMultiImpl.waitForDeployment();
  const offchainMultiImplAddress = await offchainMultiImpl.getAddress();
  console.log("OffchainMultiMarket8 template deployed:", offchainMultiImplAddress);

  // 5. Register templates
  const templateIdBinary = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const templateIdMulti = hre.ethers.id("OFFCHAIN_MULTI8_V1");
  await marketFactory.registerTemplate(
    templateIdBinary,
    offchainBinaryImplAddress,
    "Offchain Binary v1"
  );
  await marketFactory.registerTemplate(
    templateIdMulti,
    offchainMultiImplAddress,
    "Offchain Multi(<=8) v1"
  );
  console.log("Templates registered");

  // 6. Create example binary market (feeBps ignored by market; keep 0 per requirement)
  const feeBps = 0;
  const resolutionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const initDataBinary = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [outcomeToken1155Address]
  );

  const txBinary = await marketFactory.createMarket(
    templateIdBinary,
    collateralTokenAddress,
    umaOracleAdapterAddress,
    feeBps,
    resolutionTime,
    initDataBinary
  );
  const receiptBinary = await txBinary.wait();
  const marketCreatedEventBinary = receiptBinary.logs
    .map((l: any) => {
      try {
        return marketFactory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === "MarketCreated");
  const binaryMarketAddress =
    marketCreatedEventBinary?.args?.market ?? marketCreatedEventBinary?.args?.[1];
  console.log("New OffchainBinaryMarket created at:", binaryMarketAddress);

  // 7. Grant MINTER_ROLE to created market
  await outcomeToken1155.grantMinter(binaryMarketAddress);
  console.log("MINTER_ROLE granted to market:", binaryMarketAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployerAddress,
    outcomeToken1155: outcomeToken1155Address,
    marketFactory: marketFactoryAddress,
    umaOracleAdapterV2: umaOracleAdapterAddress,
    offchainBinaryTemplate: offchainBinaryImplAddress,
    offchainMultiTemplate: offchainMultiImplAddress,
    createdBinaryMarket: binaryMarketAddress,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync("deployment_polymarket_style.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("Polymarket-style deployment information saved to deployment_polymarket_style.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
