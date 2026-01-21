/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  // 已部署的合约地址
  const outcome1155Address = "0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087";
  const umaAdapterAddress = "0x5e42fce766Ad623cE175002B7b2528411C47cc92";
  const mfAddress = "0x0762A2EeFEB20f03ceA60A542FfC8CEC85FE8A30";
  const binImplAddress = "0x65E67c0D6D51Fd163C9E6d66A015807D7e494Fc9";

  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
  const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");

  const mf = MarketFactory.attach(mfAddress);
  const umaAdapter = UMAOracleAdapterV2.attach(umaAdapterAddress);
  const outcome1155 = OutcomeToken1155.attach(outcome1155Address);

  // 检查 MarketFactory
  console.log("\n=== MarketFactory ===");
  console.log("Default Oracle:", await mf.umaOracle());
  console.log("Market Count:", await mf.marketCount());

  // 检查模板
  const templateBinary = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const templateMulti = hre.ethers.id("OFFCHAIN_MULTI8_V1");

  console.log("\n=== Templates ===");
  const binTemplate = await mf.getTemplate(templateBinary);
  console.log("Binary template exists:", binTemplate.exists);
  console.log("Binary template impl:", binTemplate.implementation);

  const multiTemplate = await mf.getTemplate(templateMulti);
  console.log("Multi template exists:", multiTemplate.exists);
  console.log("Multi template impl:", multiTemplate.implementation);

  // 检查 UMA Adapter 权限
  console.log("\n=== UMA Adapter ===");
  const REGISTRAR_ROLE = await umaAdapter.REGISTRAR_ROLE();
  const hasRegistrar = await umaAdapter.hasRole(REGISTRAR_ROLE, mfAddress);
  console.log("Factory has REGISTRAR_ROLE:", hasRegistrar);

  const deployerAddr = await deployer.getAddress();
  const deployerHasRegistrar = await umaAdapter.hasRole(REGISTRAR_ROLE, deployerAddr);
  console.log("Deployer has REGISTRAR_ROLE:", deployerHasRegistrar);

  // 检查 OutcomeToken1155
  console.log("\n=== OutcomeToken1155 ===");
  const MINTER_ROLE = await outcome1155.MINTER_ROLE();
  const DEFAULT_ADMIN = await outcome1155.DEFAULT_ADMIN_ROLE();
  const deployerIsAdmin = await outcome1155.hasRole(DEFAULT_ADMIN, deployerAddr);
  console.log("Deployer is admin:", deployerIsAdmin);

  // 如果模板没注册，注册它们
  if (!binTemplate.exists) {
    console.log("\n--- Registering binary template ---");
    await (await mf.registerTemplate(templateBinary, binImplAddress, "Offchain Binary v1")).wait();
    console.log("Binary template registered!");
  }

  if (!multiTemplate.exists) {
    console.log("\n--- Registering multi template ---");
    const multiImplAddress = "0xffA5179B3A9422c68C758518dA6e815067587170";
    await (
      await mf.registerTemplate(templateMulti, multiImplAddress, "Offchain Multi(<=8) v1")
    ).wait();
    console.log("Multi template registered!");
  }

  // 如果 Factory 没有 REGISTRAR_ROLE，授予它
  if (!hasRegistrar) {
    console.log("\n--- Granting REGISTRAR_ROLE to MarketFactory ---");
    await (await umaAdapter.grantRole(REGISTRAR_ROLE, mfAddress)).wait();
    console.log("REGISTRAR_ROLE granted to MarketFactory!");
  }

  console.log("\n=== Setup Complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
