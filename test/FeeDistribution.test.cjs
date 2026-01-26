const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Fee Distribution Test", function () {
    let factory, market, collateral, outcome1155, manualOracle;
    let owner, creator, user1, lpRecipient, protocolRecipient;

    beforeEach(async function () {
        [owner, creator, user1, lpRecipient, protocolRecipient] = await ethers.getSigners();

        // Deploy collateral token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        collateral = await MockERC20.deploy("USDC", "USDC");
        await collateral.waitForDeployment();
        
        // Mint initial balance to owner and user1
        await collateral.mint(owner.address, ethers.parseUnits("1000000", 6));
        await collateral.mint(user1.address, ethers.parseUnits("10000", 6));

        // Deploy ManualOracle
        const ManualOracle = await ethers.getContractFactory("ManualOracle");
        manualOracle = await ManualOracle.deploy(owner.address);
        await manualOracle.waitForDeployment();

        // Deploy outcome token 1155
        const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
        outcome1155 = await OutcomeToken1155.deploy();
        await outcome1155.waitForDeployment();
        await outcome1155.initialize("");

        // Deploy market factory
        const MarketFactory = await ethers.getContractFactory("MarketFactory");
        factory = await MarketFactory.deploy();
        await factory.waitForDeployment();

        // Initialize factory with admin role for owner
        await factory.initialize(owner.address, await manualOracle.getAddress());

        // Deploy binary market template
        const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
        const binaryTemplate = await OffchainBinaryMarket.deploy();
        await binaryTemplate.waitForDeployment();

        // Register template
        await factory.registerTemplate(
            ethers.id("binary"),
            await binaryTemplate.getAddress(),
            "OffchainBinaryMarket"
        );

        // Set fee configuration: 0.8% total fee, 0.4% to LP, 0.4% to protocol
        await factory.setFee(80, protocolRecipient.address); // 0.8% total fee
        await factory.setFeeSplit(40, lpRecipient.address); // 0.4% to LP
    });

    it("should distribute fees correctly during redemption", async function () {
        // Create market
        const resolutionTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
        
        const createTx = await factory["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
            ethers.id("binary"),
            await collateral.getAddress(),
            await manualOracle.getAddress(),
            80, // 0.8% fee
            resolutionTime,
            data
        );
        const createReceipt = await createTx.wait();
        
        // Get market address from event
        const marketCreatedEvent = createReceipt.logs.find(log => 
            log.fragment && log.fragment.name === "MarketCreated"
        );
        const marketAddress = marketCreatedEvent.args.market;
        market = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

        // Grant minter role to market
        await outcome1155.grantMinter(marketAddress);

        // User1 already has collateral from initial mint

        // Approve and mint complete set
        await collateral.connect(user1).approve(marketAddress, ethers.parseUnits("100", 6));
        await market.connect(user1).mintCompleteSet(ethers.parseUnits("100", 18));

        // Fast forward to resolution time
        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");

        // Set oracle outcome to 0 (YES wins)
        await manualOracle.setOutcome(0);

        // Resolve market (outcome 0 wins)
        await market.resolve();

        // Get balances before redemption
        const user1InitialBalance = await collateral.balanceOf(user1.address);
        const lpInitialBalance = await collateral.balanceOf(lpRecipient.address);
        const protocolInitialBalance = await collateral.balanceOf(protocolRecipient.address);

        // Redeem outcome tokens
        await outcome1155.connect(user1).setApprovalForAll(marketAddress, true);
        await market.connect(user1).redeem(ethers.parseUnits("100", 18));

        // Get balances after redemption
        const user1FinalBalance = await collateral.balanceOf(user1.address);
        const lpFinalBalance = await collateral.balanceOf(lpRecipient.address);
        const protocolFinalBalance = await collateral.balanceOf(protocolRecipient.address);

        // Calculate expected fees
        const totalRedeemAmount = ethers.parseUnits("100", 6); // 100 USDC
        const expectedTotalFee = ethers.parseUnits("0.8", 6); // 0.8% of 100 USDC
        const expectedLpFee = ethers.parseUnits("0.4", 6); // 0.4% to LP
        const expectedProtocolFee = ethers.parseUnits("0.4", 6); // 0.4% to protocol

        // Verify fees were distributed correctly
        expect(lpFinalBalance).to.equal(lpInitialBalance + expectedLpFee);
        expect(protocolFinalBalance).to.equal(protocolInitialBalance + expectedProtocolFee);
        expect(user1FinalBalance).to.equal(user1InitialBalance + totalRedeemAmount - expectedTotalFee);

        console.log("\nFee Distribution Test Results:");
        console.log(`Total Redeem Amount: ${ethers.formatUnits(totalRedeemAmount, 6)} USDC`);
        console.log(`Total Fee: ${ethers.formatUnits(expectedTotalFee, 6)} USDC (0.8%)`);
        console.log(`LP Fee: ${ethers.formatUnits(expectedLpFee, 6)} USDC (0.4%)`);
        console.log(`Protocol Fee: ${ethers.formatUnits(expectedProtocolFee, 6)} USDC (0.4%)`);
        console.log("\n✅ Fee distribution is working correctly!");
    });
});