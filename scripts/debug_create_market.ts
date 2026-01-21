/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  // 已部署的合约地址
  const outcome1155Address = "0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087";
  const umaAdapterAddress = "0x5e42fce766Ad623cE175002B7b2528411C47cc92";
  const mfAddress = "0x0762A2EeFEB20f03ceA60A542FfC8CEC85FE8A30";
  const usdc = "0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf";

  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
  const mf = MarketFactory.attach(mfAddress);

  const templateBinary = hre.ethers.id("OFFCHAIN_BINARY_V1");
  const now = Math.floor(Date.now() / 1000);
  const resolutionTime = now + 7 * 24 * 3600;
  const feeBps = 0;
  const dataBin = new hre.ethers.AbiCoder().encode(["address"], [outcome1155Address]);

  console.log("\n=== Create Market Parameters ===");
  console.log("templateId:", templateBinary);
  console.log("collateral:", usdc);
  console.log("oracle:", umaAdapterAddress);
  console.log("feeBps:", feeBps);
  console.log("resolutionTime:", resolutionTime, "(now +7 days)");
  console.log("data (outcome1155):", outcome1155Address);

  try {
    // 尝试静态调用以获取更详细的错误
    console.log("\n=== Trying static call ===");
    const result = await mf[
      "createMarket(bytes32,address,address,uint256,uint256,bytes)"
    ].staticCall(templateBinary, usdc, umaAdapterAddress, feeBps, resolutionTime, dataBin);
    console.log("Static call succeeded:", result);
  } catch (err: any) {
    console.log("Static call failed:", err.message);

    // 尝试使用 callStatic 获取回滚原因
    if (err.data) {
      console.log("Error data:", err.data);
    }
    if (err.reason) {
      console.log("Revert reason:", err.reason);
    }
  }

  // 检查 UMA adapter 更多状态
  const UMAOracleAdapterV2 = await hre.ethers.getContractFactory("UMAOracleAdapterV2");
  const umaAdapter = UMAOracleAdapterV2.attach(umaAdapterAddress);

  console.log("\n=== UMA Adapter Config ===");
  console.log("UMA OO address:", await umaAdapter.uma());
  console.log("Bond currency:", await umaAdapter.bondCurrency());
  console.log("Default bond:", await umaAdapter.defaultBond());

  const REGISTRAR_ROLE = await umaAdapter.REGISTRAR_ROLE();
  console.log("Factory REGISTRAR_ROLE:", await umaAdapter.hasRole(REGISTRAR_ROLE, mfAddress));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
