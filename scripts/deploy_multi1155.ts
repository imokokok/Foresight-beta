/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  // Deploy MultiOutcomeMarket1155 implementation (template)
  const MultiFactory = await hre.ethers.getContractFactory("MultiOutcomeMarket1155");
  const multiImpl = await MultiFactory.deploy();
  await multiImpl.waitForDeployment();
  const multiImplAddress = await multiImpl.getAddress();
  console.log("MultiOutcomeMarket1155 implementation:", multiImplAddress);

  // Deploy MarketFactory (or reuse existing via env)
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

  // Register MULTI template
  const templateIdMulti = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MULTI"));
  {
    const t = await mf.getTemplate(templateIdMulti);
    if (!t.exists) {
      const txReg = await mf.registerTemplate(templateIdMulti, multiImplAddress, "MultiOutcome1155");
      await txReg.wait();
      console.log("Registered MULTI template");
    } else {
      console.log("MULTI template already registered:", t.implementation);
    }
  }

  // Deploy shared OutcomeToken1155 (or reuse existing via env)
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

  // Determine USDT collateral address
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  let collateral = env.COLLATERAL_TOKEN_ADDRESS;
  if (!collateral) {
    switch (chainId) {
      case 137: // polygon
        collateral = env.USDT_ADDRESS_POLYGON || env.NEXT_PUBLIC_USDT_ADDRESS_POLYGON;
        break;
      case 80002: // amoy
        collateral = env.USDT_ADDRESS_AMOY || env.NEXT_PUBLIC_USDT_ADDRESS_AMOY;
        break;
      case 11155111: // sepolia
        collateral = env.USDT_ADDRESS_SEPOLIA || env.NEXT_PUBLIC_USDT_ADDRESS_SEPOLIA;
        break;
      case 1337: // localhost
        collateral = env.USDT_ADDRESS_LOCALHOST || env.NEXT_PUBLIC_USDT_ADDRESS_LOCALHOST || env.COLLATERAL_TOKEN_ADDRESS;
        break;
      default:
        collateral = env.USDT_ADDRESS || env.NEXT_PUBLIC_USDT_ADDRESS || env.COLLATERAL_TOKEN_ADDRESS;
    }
  }

  if (!collateral) {
    console.error("Missing USDT collateral address env. Set COLLATERAL_TOKEN_ADDRESS or USDT_ADDRESS_*. ");
    return;
  }

  const oracle = env.ORACLE_ADDRESS || deployerAddress;
  const feeBps = env.MARKET_FEE_BPS ? Number(env.MARKET_FEE_BPS) : 30; // 0.30%
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS ? Number(env.MARKET_RESOLUTION_TS) : (now + 7 * 24 * 3600);

  // Prepare data: abi.encode(outcome1155, outcomeCount)
  const outcomeCount = env.OUTCOME_COUNT ? Number(env.OUTCOME_COUNT) : 3;
  const abiCoder = new hre.ethers.AbiCoder();
  const data = abiCoder.encode(["address", "uint256"], [outcome1155Address, outcomeCount]);

  // Create market
  const txCreate = await mf.createMarket(templateIdMulti, collateral, oracle, feeBps, resolutionTime, data);
  const receipt = await txCreate.wait();

  // Parse MarketCreated
  const iface = mf.interface;
  const log = receipt.logs.find((l: any) => {
    try { 
      const parsedLog = iface.parseLog(l);
      return parsedLog && parsedLog.name === "MarketCreated"; 
    } catch (_) { return false; }
  });
  if (log) {
    const parsed = iface.parseLog(log);
    if (parsed) {
      console.log("MarketCreated (MULTI):", {
        marketId: parsed.args[0].toString(),
        market: parsed.args[1],
        templateId: parsed.args[2],
        creator: parsed.args[3],
        collateralToken: parsed.args[4],
        oracle: parsed.args[5],
        feeBps: parsed.args[6].toString(),
        resolutionTime: parsed.args[7].toString()
      });
    }
  } else {
    console.log("Multi market created. Tx:", receipt.hash);
  }

  // Grant MINTER_ROLE on OutcomeToken1155 to created market
  // We need the market address from event above
  const createdMarket = log ? ((): any => { 
    const p = iface.parseLog(log); 
    return p ? (p.args.market ?? p.args[1]) : undefined; 
  })() : undefined;
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});