/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

function getEnvCollateral(chainId: number, env: NodeJS.ProcessEnv) {
  let collateral = env.COLLATERAL_TOKEN_ADDRESS;
  if (!collateral) {
    switch (chainId) {
      case 137:
        collateral = env.USDT_ADDRESS_POLYGON || env.NEXT_PUBLIC_USDT_ADDRESS_POLYGON;
        break;
      case 80002:
        collateral = env.USDT_ADDRESS_AMOY || env.NEXT_PUBLIC_USDT_ADDRESS_AMOY;
        break;
      case 11155111:
        collateral = env.USDT_ADDRESS_SEPOLIA || env.NEXT_PUBLIC_USDT_ADDRESS_SEPOLIA;
        break;
      case 1337:
        collateral = env.USDT_ADDRESS_LOCALHOST || env.NEXT_PUBLIC_USDT_ADDRESS_LOCALHOST || env.COLLATERAL_TOKEN_ADDRESS;
        break;
      default:
        collateral = env.USDT_ADDRESS || env.NEXT_PUBLIC_USDT_ADDRESS || env.COLLATERAL_TOKEN_ADDRESS;
    }
  }
  return collateral;
}

async function ensureFactory(deployerAddress: string) {
  const env = process.env;
  let mfAddress = env.MARKET_FACTORY_ADDRESS;
  let mf;
  if (!mfAddress) {
    const MarketFactoryFactory = await hre.ethers.getContractFactory("MarketFactory");
    mf = await MarketFactoryFactory.deploy(deployerAddress);
    await mf.waitForDeployment();
    mfAddress = await mf.getAddress();
    console.log("MarketFactory:", mfAddress);
  } else {
    mf = await hre.ethers.getContractAt("MarketFactory", mfAddress);
    console.log("Using existing MarketFactory:", mfAddress);
  }
  return { mf, mfAddress };
}

async function deployClobTemplate(mf: any) {
  const CLOBMarketFactory = await hre.ethers.getContractFactory("CLOBMarket");
  const clobImpl = await CLOBMarketFactory.deploy();
  await clobImpl.waitForDeployment();
  const clobImplAddress = await clobImpl.getAddress();
  console.log("CLOBMarket implementation:", clobImplAddress);

  const templateIdClob = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CLOB"));
  const t = await mf.getTemplate(templateIdClob);
  if (!t.exists) {
    const txReg = await mf.registerTemplate(templateIdClob, clobImplAddress, "CLOB");
    await txReg.wait();
    console.log("Registered CLOB template");
  } else {
    console.log("CLOB template already registered:", t.implementation);
  }
  return templateIdClob;
}

async function deployMultiTemplate(mf: any) {
  const MultiFactory = await hre.ethers.getContractFactory("MultiOutcomeMarket1155");
  const multiImpl = await MultiFactory.deploy();
  await multiImpl.waitForDeployment();
  const multiImplAddress = await multiImpl.getAddress();
  console.log("MultiOutcomeMarket1155 implementation:", multiImplAddress);

  const templateIdMulti = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MULTI"));
  const t = await mf.getTemplate(templateIdMulti);
  if (!t.exists) {
    const txReg = await mf.registerTemplate(templateIdMulti, multiImplAddress, "MultiOutcome1155");
    await txReg.wait();
    console.log("Registered MULTI template");
  } else {
    console.log("MULTI template already registered:", t.implementation);
  }
  return templateIdMulti;
}

async function createClobMarket(mf: any, deployerAddress: string) {
  const env = process.env;
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const collateral = getEnvCollateral(chainId, env);
  if (!collateral) throw new Error("Missing collateral address for clob market.");
  const oracle = env.ORACLE_ADDRESS || deployerAddress;
  const feeBps = env.MARKET_FEE_BPS ? Number(env.MARKET_FEE_BPS) : 30;
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS ? Number(env.MARKET_RESOLUTION_TS) : (now + 7 * 24 * 3600);
  const outcome1155Address = env.OUTCOME1155_ADDRESS;
  if (!outcome1155Address) throw new Error("Missing OUTCOME1155_ADDRESS for clob market.");
  const data = new hre.ethers.AbiCoder().encode(["address"],[outcome1155Address]);

  const templateIdClob = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CLOB"));
  const txCreate = await mf.createMarket(templateIdClob, collateral, oracle, feeBps, resolutionTime, data);
  const receipt = await txCreate.wait();
  const iface = mf.interface;
  const log = receipt.logs.find((l: any) => { try { return iface.parseLog(l).name === "MarketCreated"; } catch (_) { return false; } });
  if (log) {
    const parsed = iface.parseLog(log);
    console.log("MarketCreated (CLOB):", {
      marketId: parsed.args.marketId?.toString?.() ?? parsed.args[0].toString(),
      market: parsed.args.market ?? parsed.args[1],
      collateralToken: parsed.args.collateralToken ?? parsed.args[4],
      feeBps: parsed.args.feeBps?.toString?.() ?? parsed.args[6].toString(),
      resolutionTime: parsed.args.resolutionTime?.toString?.() ?? parsed.args[7].toString(),
    });
  }
}

async function ensureOutcome1155() {
  const env = process.env;
  let outcome1155Address = env.OUTCOME1155_ADDRESS;
  let outcome1155;
  if (!outcome1155Address) {
    const Outcome1155Factory = await hre.ethers.getContractFactory("OutcomeToken1155");
    outcome1155 = await Outcome1155Factory.deploy();
    await outcome1155.waitForDeployment();
    outcome1155Address = await outcome1155.getAddress();
    console.log("OutcomeToken1155:", outcome1155Address);
  } else {
    outcome1155 = await hre.ethers.getContractAt("OutcomeToken1155", outcome1155Address);
    console.log("Using existing OutcomeToken1155:", outcome1155Address);
  }
  return { outcome1155, outcome1155Address };
}

async function createMultiMarket(mf: any, deployerAddress: string) {
  const env = process.env;
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const collateral = getEnvCollateral(chainId, env);
  if (!collateral) throw new Error("Missing collateral address for multi market.");
  const oracle = env.ORACLE_ADDRESS || deployerAddress;
  const feeBps = env.MARKET_FEE_BPS ? Number(env.MARKET_FEE_BPS) : 30;
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS ? Number(env.MARKET_RESOLUTION_TS) : (now + 7 * 24 * 3600);

  const { outcome1155, outcome1155Address } = await ensureOutcome1155();
  const outcomeCount = env.OUTCOME_COUNT ? Number(env.OUTCOME_COUNT) : 3;
  const data = new hre.ethers.AbiCoder().encode(["address", "uint256"], [outcome1155Address, outcomeCount]);

  const templateIdMulti = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MULTI"));
  const txCreate = await mf.createMarket(templateIdMulti, collateral, oracle, feeBps, resolutionTime, data);
  const receipt = await txCreate.wait();
  const iface = mf.interface;
  const log = receipt.logs.find((l: any) => { try { return iface.parseLog(l).name === "MarketCreated"; } catch (_) { return false; } });
  let createdMarket: string | undefined;
  if (log) {
    const parsed = iface.parseLog(log);
    createdMarket = parsed.args.market ?? parsed.args[1];
    console.log("MarketCreated (MULTI):", {
      marketId: parsed.args.marketId?.toString?.() ?? parsed.args[0].toString(),
      market: createdMarket,
      collateralToken: parsed.args.collateralToken ?? parsed.args[4],
      feeBps: parsed.args.feeBps?.toString?.() ?? parsed.args[6].toString(),
      resolutionTime: parsed.args.resolutionTime?.toString?.() ?? parsed.args[7].toString(),
    });
  }

  if (createdMarket) {
    const MINTER_ROLE = await outcome1155.MINTER_ROLE();
    const hasRole = await outcome1155.hasRole(MINTER_ROLE, createdMarket);
    if (!hasRole) {
      const txGrant = await outcome1155.grantMinter(createdMarket);
      await txGrant.wait();
      console.log("Granted MINTER_ROLE to market:", createdMarket);
    } else {
      console.log("Market already has MINTER_ROLE:", createdMarket);
    }
  } else {
    console.warn("Could not parse created market address. Please grant MINTER_ROLE manually.");
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  const typeArg = (process.argv.find(a => a.startsWith("--type=")) || "").split("=")[1];
  const envType = process.env.MARKET_TYPE;
  const mode = (typeArg || envType || "both").toLowerCase();

  const { mf } = await ensureFactory(deployerAddress);

  if (mode === "binary" || mode === "both" || mode === "clob") {
    await deployClobTemplate(mf);
    await createClobMarket(mf, deployerAddress);
  }

  if (mode === "multi" || mode === "both") {
    await deployMultiTemplate(mf);
    await createMultiMarket(mf, deployerAddress);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});