const { expect } = require("chai");

describe.skip("User Verification: On-Chain Transaction Flow", function () {
  let deployer, buyer, seller, malicious;
  let collateral, outcome1155, market;
  let domain, types;

  beforeEach(async function () {
    [deployer, buyer, seller, malicious] = await ethers.getSigners();

    // 1. Deploy Mock ERC20 (Collateral)
    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    // 2. Deploy Outcome Token
    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    // 3. Deploy Market
    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    market = await MarketFactory.deploy();
    await market.waitForDeployment();

    // 4. Initialize Market
    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      30, // fee
      now + 3600, // resolution time
      data
    );

    await market.startTrading();

    // 5. Setup Permissions & Mint Tokens
    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    // Mint Outcome Tokens to Seller (for selling)
    const tokenId = await outcome1155.computeTokenId(await market.getAddress(), 0);
    await outcome1155.mint(await seller.getAddress(), tokenId, 1000);
    await outcome1155.connect(seller).setApprovalForAll(await market.getAddress(), true);

    // Mint Collateral to Buyer (for buying)
    await collateral.mint(await buyer.getAddress(), 1000000);
    await collateral.connect(buyer).approve(await market.getAddress(), 1000000);

    // EIP-712 Domain Setup
    domain = {
      name: "CLOBMarket",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await market.getAddress()
    };
    types = {
      OrderRequest: [
        { name: "maker", type: "address" },
        { name: "outcomeIndex", type: "uint256" },
        { name: "isBuy", type: "bool" },
        { name: "price", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "salt", type: "uint256" }
      ]
    };
  });

  it("1. Normal Flow: Create, Sign, and Fill Order", async function () {
    console.log("   [Test] Starting Normal Flow...");
    const buyOrder = {
      maker: await buyer.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 10,
      amount: 50,
      expiry: 0,
      salt: 1001
    };
    
    // Step 1: Sign
    const signature = await buyer.signTypedData(domain, types, buyOrder);
    console.log("   [Info] Order Signed by Buyer");

    // Step 2: Fill (On-Chain Transaction)
    // Seller fills the buyer's order
    const tx = await market.connect(seller).fillOrderSigned(buyOrder, signature, 50);
    console.log("   [Info] Transaction Sent: fillOrderSigned");
    
    const receipt = await tx.wait();
    console.log("   [Info] Transaction Confirmed. Hash:", receipt.hash);
    console.log("   [Info] Gas Used:", receipt.gasUsed.toString());

    // Step 3: Verify State
    const filled = await market.getFilledBySalt(await buyer.getAddress(), 1001);
    expect(Number(filled)).to.equal(50);
    console.log("   [Success] Order Filled Amount Verified");
  });

  it("2. Abnormal Scenario: Insufficient Balance", async function () {
    console.log("   [Test] Starting Insufficient Balance Test...");
    // Malicious user has NO tokens
    const buyOrder = {
      maker: await malicious.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 10,
      amount: 50,
      expiry: 0,
      salt: 1002
    };

    const signature = await malicious.signTypedData(domain, types, buyOrder);
    
    // Try to fill - should fail because Maker (Malicious) has no Collateral to pay
    await expect(
      market.connect(seller).fillOrderSigned(buyOrder, signature, 50)
    ).to.be.reverted; 
    // Note: The revert reason might be "ERC20: transfer amount exceeds balance" or generic depending on mock
    console.log("   [Success] Transaction Reverted as expected due to insufficient balance");
  });

  it("3. Abnormal Scenario: Order Expired", async function () {
    console.log("   [Test] Starting Expired Order Test...");
    const now = Math.floor(Date.now() / 1000);
    const buyOrder = {
      maker: await buyer.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 10,
      amount: 50,
      expiry: now - 3600, // Expired 1 hour ago
      salt: 1003
    };

    const signature = await buyer.signTypedData(domain, types, buyOrder);

    await expect(
      market.connect(seller).fillOrderSigned(buyOrder, signature, 50)
    ).to.be.revertedWithCustomError(market, "InvalidExpiry");
    console.log("   [Success] Transaction Reverted as expected due to expiry");
  });

  it("4. Data Consistency: Event Emission", async function () {
    console.log("   [Test] Starting Data Consistency Test...");
    const buyOrder = {
      maker: await buyer.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 10,
      amount: 50,
      expiry: 0,
      salt: 1004
    };
    const signature = await buyer.signTypedData(domain, types, buyOrder);

    const tx = await market.connect(seller).fillOrderSigned(buyOrder, signature, 50);
    const receipt = await tx.wait();

    // Check for OrderFilledSigned event
    const tradeEvent = receipt.logs.find(l => {
      try { return market.interface.parseLog(l).name === "OrderFilledSigned" } catch { return false }
    });
    
    expect(tradeEvent).to.not.be.undefined;
    const args = market.interface.parseLog(tradeEvent).args;
    expect(args.maker).to.equal(await buyer.getAddress());
    expect(args.taker).to.equal(await seller.getAddress());
    expect(args.amount).to.equal(50);
    expect(args.price).to.equal(10);
    
    console.log("   [Success] On-Chain Event Data Matches Input");
  });

  it("5. Performance: Concurrency Simulation (Batch Fills)", async function () {
    console.log("   [Test] Starting Performance/Concurrency Test...");
    // Simulate multiple fills in sequence (closest to concurrency in serial test environment)
    const startTime = Date.now();
    const iterations = 10;
    
    for(let i=0; i<iterations; i++) {
        const order = {
            maker: await buyer.getAddress(),
            outcomeIndex: 0,
            isBuy: true,
            price: 10,
            amount: 1,
            expiry: 0,
            salt: 2000 + i
        };
        const sig = await buyer.signTypedData(domain, types, order);
        await (await market.connect(seller).fillOrderSigned(order, sig, 1)).wait();
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    console.log(`   [Info] Processed ${iterations} transactions. Avg Time: ${avgTime}ms (includes local mining time)`);
  });

});
