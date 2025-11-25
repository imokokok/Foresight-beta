/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

async function main() {
    console.log("Deploying optimized prediction market system...");

    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer: ${deployerAddress}`);

    // 1. Deploy OutcomeToken1155
    const OutcomeToken1155 = await hre.ethers.getContractFactory("OutcomeToken1155");
    const outcomeToken1155 = await OutcomeToken1155.deploy();
    await outcomeToken1155.waitForDeployment();
    const outcomeToken1155Address = await outcomeToken1155.getAddress();
    console.log(`OutcomeToken1155 deployed to: ${outcomeToken1155Address}`);

    // 2. Deploy MarketFactory
    const MarketFactory = await hre.ethers.getContractFactory("MarketFactory");
    const marketFactory = await MarketFactory.deploy(deployerAddress); // admin is deployer
    await marketFactory.waitForDeployment();
    const marketFactoryAddress = await marketFactory.getAddress();
    console.log(`MarketFactory deployed to: ${marketFactoryAddress}`);

    // 3. Deploy ManualOracle
    const ManualOracle = await hre.ethers.getContractFactory("ManualOracle");
    const manualOracle = await ManualOracle.deploy(deployerAddress); // reporter is deployer
    await manualOracle.waitForDeployment();
    const manualOracleAddress = await manualOracle.getAddress();
    console.log(`ManualOracle deployed to: ${manualOracleAddress}`);

    // 4. Deploy BinaryMarket template
    const BinaryMarket = await hre.ethers.getContractFactory("BinaryMarket");
    const binaryMarketTemplate = await BinaryMarket.deploy();
    await binaryMarketTemplate.waitForDeployment();
    const binaryMarketTemplateAddress = await binaryMarketTemplate.getAddress();
    console.log(`BinaryMarket template deployed to: ${binaryMarketTemplateAddress}`);

    // 5. Register BinaryMarket template
    const templateId = hre.ethers.id("BINARY_MARKET_V1");
    await marketFactory.registerTemplate(templateId, binaryMarketTemplateAddress, "Binary Market v1");
    console.log(`BinaryMarket template registered with ID: ${templateId}`);

    // 6. Create a new BinaryMarket instance
    const collateralTokenAddress = "0x..."; // Replace with actual ERC20 address
    const feeBps = 30; // 0.3%
    const resolutionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const data = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [outcomeToken1155Address]);

    const tx = await marketFactory.createMarket(
        templateId,
        collateralTokenAddress,
        manualOracleAddress,
        feeBps,
        resolutionTime,
        data
    );
    const receipt = await tx.wait();
    const marketCreatedEvent = receipt.events.find(event => event.event === 'MarketCreated');
    const marketAddress = marketCreatedEvent.args.market;
    console.log(`New BinaryMarket created at: ${marketAddress}`);

    // 7. Grant MINTER_ROLE to the new market
    await outcomeToken1155.grantRole(await outcomeToken1155.MINTER_ROLE(), marketAddress);
    console.log(`MINTER_ROLE granted to market: ${marketAddress}`);

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployerAddress,
        outcomeToken1155: outcomeToken1155Address,
        marketFactory: marketFactoryAddress,
        manualOracle: manualOracleAddress,
        binaryMarketTemplate: binaryMarketTemplateAddress,
        createdMarket: marketAddress,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment_optimized.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Optimized deployment information saved to deployment_optimized.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});