/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  // Collateral (USDC)
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const env = process.env;
  let collateral =
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
  if (!collateral) {
    console.error(
      "Missing USDC collateral address env. Set COLLATERAL_TOKEN_ADDRESS or USDC_ADDRESS_*."
    );
    return;
  }

  // UMA OOv3 + adapter params
  const UMA_OO_V3_ADDRESS =
    env.UMA_OO_V3_ADDRESS || env.UMA_OPTIMISTIC_ORACLE_ADDRESS || env.ORACLE_ADDRESS || "";
  if (!UMA_OO_V3_ADDRESS) {
    console.error("Missing UMA_OO_V3_ADDRESS env (UMA Optimistic Oracle V3 address).");
    return;
  }

  // Deploy UMAOracleAdapterV2
  const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
  const umaAdapter = await UMAOracleAdapterV2.deploy(
    UMA_OO_V3_ADDRESS,
    collateral,
    deployerAddress,
    deployerAddress
  );
  await umaAdapter.waitForDeployment();
  const umaAdapterAddress = await umaAdapter.getAddress();
  console.log("UMAOracleAdapterV2:", umaAdapterAddress);

  // Deploy OffchainBinaryMarket implementation (template)
  const OffchainBinaryMarket = await hre.ethers.getContractFactory("OffchainBinaryMarket");
  const binaryImpl = await OffchainBinaryMarket.deploy();
  await binaryImpl.waitForDeployment();
  const binaryImplAddress = await binaryImpl.getAddress();
  console.log("OffchainBinaryMarket implementation:", binaryImplAddress);

  // Deploy MarketFactory
  const MarketFactoryFactory = await hre.ethers.getContractFactory("MarketFactory");
  const mf = await MarketFactoryFactory.deploy();
  await mf.waitForDeployment();
  await mf.initialize(deployerAddress, umaAdapterAddress);
  const mfAddress = await mf.getAddress();
  console.log("MarketFactory:", mfAddress);

  const protocolFeeTo = env.PROTOCOL_FEE_TO || deployerAddress;
  const totalFeeBps = env.PROTOCOL_TOTAL_FEE_BPS ? Number(env.PROTOCOL_TOTAL_FEE_BPS) : 80;
  const lpFeeBps = env.LP_FEE_BPS ? Number(env.LP_FEE_BPS) : 40;
  if (!Number.isFinite(totalFeeBps) || totalFeeBps < 0 || totalFeeBps > 10000) {
    throw new Error("Invalid PROTOCOL_TOTAL_FEE_BPS");
  }
  if (!Number.isFinite(lpFeeBps) || lpFeeBps < 0 || lpFeeBps > totalFeeBps) {
    throw new Error("Invalid LP_FEE_BPS");
  }

  const Foresight = await hre.ethers.getContractFactory("Foresight");
  const foresight = await Foresight.deploy(deployerAddress);
  await foresight.waitForDeployment();
  const foresightAddress = await foresight.getAddress();
  console.log("Foresight (maker points):", foresightAddress);

  const foresightMinter = env.FORESIGHT_MINTER || deployerAddress;
  const minterRole = await foresight.MINTER_ROLE();
  await (await foresight.grantRole(minterRole, foresightMinter)).wait();
  console.log("Foresight minter:", foresightMinter);

  const LPFeeStaking = await hre.ethers.getContractFactory("LPFeeStaking");
  const lpStaking = await LPFeeStaking.deploy(deployerAddress, foresightAddress, collateral);
  await lpStaking.waitForDeployment();
  const lpStakingAddress = await lpStaking.getAddress();
  console.log("LPFeeStaking:", lpStakingAddress);

  const lpFeeTo = env.LP_FEE_TO || lpStakingAddress;
  await (await mf.setFee(totalFeeBps, protocolFeeTo)).wait();
  await (await mf.setFeeSplit(lpFeeBps, lpFeeTo)).wait();
  console.log("Fee config:", { totalFeeBps, protocolFeeTo, lpFeeBps, lpFeeTo });

  // Register OFFCHAIN_BINARY template
  const templateId = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const txReg = await mf.registerTemplate(templateId, binaryImplAddress, "Offchain Binary v1");
  await txReg.wait();
  console.log("Registered OFFCHAIN_BINARY template");

  const oracle = umaAdapterAddress;
  const feeBps = 0; // use factory default
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = env.MARKET_RESOLUTION_TS
    ? Number(env.MARKET_RESOLUTION_TS)
    : now + 7 * 24 * 3600;

  // template-specific params: outcome1155 address for OffchainBinaryMarket
  const outcome1155Addr = process.env.OUTCOME1155_ADDRESS;
  if (!outcome1155Addr) {
    console.error("Missing OUTCOME1155_ADDRESS env for OffchainBinaryMarket");
    return;
  }
  const data = new hre.ethers.AbiCoder().encode(["address"], [outcome1155Addr]);

  // Create market
  const txCreate = await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
    templateId,
    collateral,
    oracle,
    feeBps,
    resolutionTime,
    data
  );
  const receipt = await txCreate.wait();

  // Parse event
  const iface = mf.interface;
  const log = receipt.logs.find((l: any) => {
    try {
      const desc = iface.parseLog(l) as any;
      return desc?.name === "MarketCreated";
    } catch (_) {
      return false;
    }
  });
  if (log) {
    // Safe parse wrapper to satisfy strict TS and runtime
    const tryParse = () => {
      try {
        return iface.parseLog(log) as any;
      } catch {
        return null as any;
      }
    };
    const parsed = tryParse();
    if (parsed) {
      console.log("MarketCreated:", {
        marketId: parsed.args?.marketId?.toString?.() ?? parsed.args?.[0]?.toString?.(),
        market: parsed.args?.market ?? parsed.args?.[1],
        templateId: parsed.args?.templateId ?? parsed.args?.[2],
        creator: parsed.args?.creator ?? parsed.args?.[3],
        collateralToken: parsed.args?.collateralToken ?? parsed.args?.[4],
        oracle: parsed.args?.oracle ?? parsed.args?.[5],
        feeBps: parsed.args?.feeBps?.toString?.() ?? parsed.args?.[6]?.toString?.(),
        resolutionTime: parsed.args?.resolutionTime?.toString?.() ?? parsed.args?.[7]?.toString?.(),
      });
    } else {
      console.log("Market created (parse fallback). Tx:", receipt.hash);
    }
  } else {
    console.log("Market created. Tx:", receipt.hash);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
