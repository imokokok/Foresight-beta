/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

function getCollateral(chainId: number, env: NodeJS.ProcessEnv): string {
  const addresses: Record<number, string> = {
    137: env.USDC_ADDRESS_POLYGON || env.NEXT_PUBLIC_USDC_ADDRESS_POLYGON || "",
    80002: env.USDC_ADDRESS_AMOY || env.NEXT_PUBLIC_USDC_ADDRESS_AMOY || "",
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

async function parseCreatedMarketAddress(mf: any, receipt: any): Promise<string> {
  const parsed = receipt.logs
    .map((l: any) => {
      try {
        return mf.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((x: any) => x && x.name === "MarketCreated");
  if (!parsed) throw new Error("MarketCreated not found");
  return parsed.args.market;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const env = process.env;

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const collateral = getCollateral(chainId, env);
  if (!collateral) throw new Error(`Missing collateral address for chainId ${chainId}`);

  const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");
  const outcome1155 =
    env.OUTCOME1155_ADDRESS && env.OUTCOME1155_ADDRESS !== ""
      ? await hre.ethers.getContractAt("OutcomeToken1155", env.OUTCOME1155_ADDRESS)
      : await (async () => {
          const c = await OutcomeToken1155.deploy();
          await c.waitForDeployment();
          await c.initialize("");
          return c;
        })();
  const outcome1155Address = await outcome1155.getAddress();

  const oracleMode = (env.ORACLE_MODE || "").toUpperCase();
  let defaultOracleAddress = env.ORACLE_ADDRESS || "";

  if (!defaultOracleAddress) {
    if (oracleMode === "MANUAL") {
      const ManualOracle = await hre.ethers.getContractFactory("ManualOracle");
      const o = await ManualOracle.deploy(deployerAddress);
      await o.waitForDeployment();
      defaultOracleAddress = await o.getAddress();
    } else {
      const umaOO = env.UMA_OO_V3_ADDRESS || env.UMA_OPTIMISTIC_ORACLE_ADDRESS || "";
      if (!umaOO) throw new Error("Missing UMA_OO_V3_ADDRESS (or set ORACLE_MODE=MANUAL)");
      const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
      const reporter = env.UMA_REPORTER_ADDRESS || deployerAddress;
      const adapter = await UMAOracleAdapterV2.deploy(umaOO, collateral, deployerAddress, reporter);
      await adapter.waitForDeployment();
      defaultOracleAddress = await adapter.getAddress();
    }
  }

  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const mf = await MarketFactory.deploy();
  await mf.waitForDeployment();
  await mf.initialize(deployerAddress, defaultOracleAddress);
  const mfAddress = await mf.getAddress();

  const protocolFeeTo = env.PROTOCOL_FEE_TO || deployerAddress;
  const totalFeeBps = env.PROTOCOL_TOTAL_FEE_BPS ? Number(env.PROTOCOL_TOTAL_FEE_BPS) : 80;
  const lpFeeBps = env.LP_FEE_BPS ? Number(env.LP_FEE_BPS) : 40;
  const lpFeeTo = env.LP_FEE_TO || protocolFeeTo;

  await (await mf.setFee(totalFeeBps, protocolFeeTo)).wait();
  await (await mf.setFeeSplit(lpFeeBps, lpFeeTo)).wait();

  const enforceAllowlist = env.ENFORCE_ALLOWLIST ? env.ENFORCE_ALLOWLIST !== "0" : true;
  const requireContract = env.REQUIRE_CONTRACT_ADDR ? env.REQUIRE_CONTRACT_ADDR !== "0" : true;

  await (await mf.setAllowlistEnforcement(enforceAllowlist, enforceAllowlist)).wait();
  await (await mf.setContractRequirement(requireContract, requireContract)).wait();
  await (await mf.setCollateralAllowed(collateral, true)).wait();
  await (await mf.setOracleAllowed(defaultOracleAddress, true)).wait();

  const OffchainBinaryMarket = await hre.ethers.getContractFactory("OffchainBinaryMarket");
  const binaryImpl = await OffchainBinaryMarket.deploy();
  await binaryImpl.waitForDeployment();
  const binaryImplAddress = await binaryImpl.getAddress();

  const OffchainMultiMarket8 = await hre.ethers.getContractFactory("OffchainMultiMarket8");
  const multiImpl = await OffchainMultiMarket8.deploy();
  await multiImpl.waitForDeployment();
  const multiImplAddress = await multiImpl.getAddress();

  const templateBinaryId = hre.ethers.id(env.BINARY_TEMPLATE_ID || "OFFCHAIN_BINARY_V2");
  const templateMultiId = hre.ethers.id(env.MULTI_TEMPLATE_ID || "OFFCHAIN_MULTI8_V2");
  await (
    await mf.registerTemplate(templateBinaryId, binaryImplAddress, "Offchain Binary v2")
  ).wait();
  await (
    await mf.registerTemplate(templateMultiId, multiImplAddress, "Offchain Multi(<=8) v2")
  ).wait();

  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS
    ? Number(env.MARKET_RESOLUTION_TS)
    : now + 7 * 24 * 3600;

  const dataBin = new hre.ethers.AbiCoder().encode(["address"], [outcome1155Address]);
  const receiptBin = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateBinaryId,
      collateral,
      defaultOracleAddress,
      0,
      resolutionTime,
      dataBin
    )
  ).wait();
  const binaryMarket = await parseCreatedMarketAddress(mf, receiptBin);

  const outcomeCount = Math.max(2, Math.min(8, env.OUTCOME_COUNT ? Number(env.OUTCOME_COUNT) : 3));
  const dataMulti = new hre.ethers.AbiCoder().encode(
    ["address", "uint8"],
    [outcome1155Address, outcomeCount]
  );
  const receiptMulti = await (
    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateMultiId,
      collateral,
      defaultOracleAddress,
      0,
      resolutionTime,
      dataMulti
    )
  ).wait();
  const multiMarket = await parseCreatedMarketAddress(mf, receiptMulti);

  await (await outcome1155.grantMinter(binaryMarket)).wait();
  await (await outcome1155.grantMinter(multiMarket)).wait();

  const deploymentInfo = {
    network: hre.network.name,
    chainId,
    deployer: deployerAddress,
    collateral,
    outcome1155: outcome1155Address,
    defaultOracle: defaultOracleAddress,
    marketFactory: mfAddress,
    templates: {
      offchainBinary: binaryImplAddress,
      offchainMulti8: multiImplAddress,
      templateIds: { binary: templateBinaryId, multi: templateMultiId },
    },
    markets: { binary: binaryMarket, multi: multiMarket, multiOutcomeCount: outcomeCount },
    fee: { totalFeeBps, protocolFeeTo, lpFeeBps, lpFeeTo },
    allowlist: {
      enforceAllowlist,
      requireContract,
      collateralAllowed: [collateral],
      oracleAllowed: [defaultOracleAddress],
    },
    timestamp: new Date().toISOString(),
  };

  const outFile = env.DEPLOYMENT_OUT || "deployment_offchain_secure.json";
  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));

  console.log(`DEPLOYMENT_FILE=${outFile}`);
  console.log(`NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=${mfAddress}`);
  console.log(`NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS=${outcome1155Address}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${collateral}`);
  console.log(`NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS=${defaultOracleAddress}`);
  console.log(`NEXT_PUBLIC_BINARY_MARKET_ADDRESS=${binaryMarket}`);
  console.log(`NEXT_PUBLIC_MULTI_MARKET_ADDRESS=${multiMarket}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
