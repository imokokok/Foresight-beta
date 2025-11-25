/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("Deploying Foresight contract...");

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // 读取抵押代币地址
  const explicit = process.env.COLLATERAL_TOKEN_ADDRESS || "";
  const polygonUSDT = process.env.USDT_ADDRESS_POLYGON || "";
  const amoyUSDT = process.env.USDT_ADDRESS_AMOY || "";

  let tokenAddress = explicit;
  if (!tokenAddress) {
    if (chainId === 137) tokenAddress = polygonUSDT;
    else if (chainId === 80002) tokenAddress = amoyUSDT;
  }
  if (!tokenAddress) {
    throw new Error(
      `Missing collateral token address for chainId ${chainId}. Set COLLATERAL_TOKEN_ADDRESS or USDT_ADDRESS_POLYGON/USDT_ADDRESS_AMOY.`
    );
  }

  const Foresight = await hre.ethers.getContractFactory("Foresight");
  const foresight = await Foresight.deploy(tokenAddress);

  await foresight.waitForDeployment();

  const address = await foresight.getAddress();
  console.log(`Foresight deployed to: ${address}`);

  // 保存部署信息到文件
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const deploymentInfo = {
    network: chainId,
    contract: "Foresight",
    address: address,
    collateralToken: tokenAddress,
    deployer: deployerAddress,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment information saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});