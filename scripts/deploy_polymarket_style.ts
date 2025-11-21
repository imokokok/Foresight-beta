/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";
import fs from "fs";

async function main() {
    console.log("Deploying Polymarket-style prediction market system...");

    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer: ${deployerAddress}`);

    // --- UMA Specific Configuration ---
    // IMPORTANT: Replace with the actual UMA Optimistic Oracle address for your target network.
    const UMA_OPTIMISTIC_ORACLE_ADDRESS = "0x9923D42eF695B5dd9911D05Ac944d4cA18D32A73"; // Example for Sepolia

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

    // 3. Deploy UMAOracleAdapter
    const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter");
    const umaOracleAdapter = await UMAOracleAdapter.deploy(UMA_OPTIMISTIC_ORACLE_ADDRESS);
    await umaOracleAdapter.waitForDeployment();
    const umaOracleAdapterAddress = await umaOracleAdapter.getAddress();
    console.log(`UMAOracleAdapter deployed to: ${umaOracleAdapterAddress}`);

    // 4. Deploy CLOBMarket template
    const CLOBMarket = await hre.ethers.getContractFactory("CLOBMarket");
    const clobMarketTemplate = await CLOBMarket.deploy();
    await clobMarketTemplate.waitForDeployment();
    const clobMarketTemplateAddress = await clobMarketTemplate.getAddress();
    console.log(`CLOBMarket template deployed to: ${clobMarketTemplateAddress}`);

    // 5. Register CLOBMarket template
    const templateId = hre.ethers.id("CLOB_MARKET_V1");
    await marketFactory.registerTemplate(templateId, clobMarketTemplateAddress, "CLOB Market v1");
    console.log(`CLOBMarket template registered with ID: ${templateId}`);

    // 6. Create a new CLOBMarket instance using the UMA adapter
    const collateralTokenAddress = process.env.COLLATERAL_TOKEN_ADDRESS || "0x..."; // Replace with actual ERC20 address
    const feeBps = 30; // 0.3%
    const resolutionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const initData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"],[outcomeToken1155Address]);

    const tx = await marketFactory.createMarket(
        templateId,
        collateralTokenAddress,
        umaOracleAdapterAddress, // Using UMA Oracle Adapter
        feeBps,
        resolutionTime,
        initData
    );
    const receipt = await tx.wait();
    const marketCreatedEvent = receipt.events.find(event => event.event === 'MarketCreated');
    const clobMarketAddress = marketCreatedEvent.args.market;
    console.log(`New CLOBMarket created at: ${clobMarketAddress}`);

    // Grant MINTER_ROLE to the new CPMM market
    await outcomeToken1155.grantRole(await outcomeToken1155.MINTER_ROLE(), clobMarketAddress);
    console.log(`MINTER_ROLE granted to market: ${clobMarketAddress}`);

    // Skip LMSR second market; CLOB is the only model now

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployerAddress,
        outcomeToken1155: outcomeToken1155Address,
        marketFactory: marketFactoryAddress,
        umaOracleAdapter: umaOracleAdapterAddress,
        clobMarketTemplate: clobMarketTemplateAddress,
        createdClobMarket: clobMarketAddress,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        "deployment_polymarket_style.json",
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Polymarket-style deployment information saved to deployment_polymarket_style.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});