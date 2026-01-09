const { expect } = require("chai");

describe.skip("CLOBMarket end-to-end (CJS)", function () {
  it("FIFO per price and signed order", async function () {
    const [deployer, buyer, seller1, seller2] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      30,
      now + 3600,
      data
    );

    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    const tokenId = await outcome1155.computeTokenId(await market.getAddress(), 0);
    await outcome1155.mint(await seller1.getAddress(), tokenId, 100);
    await outcome1155.mint(await seller2.getAddress(), tokenId, 100);
    await outcome1155.connect(seller1).setApprovalForAll(await market.getAddress(), true);
    await outcome1155.connect(seller2).setApprovalForAll(await market.getAddress(), true);

    await market.startTrading();

    await collateral.mint(await buyer.getAddress(), 1000000);
    await collateral.connect(buyer).approve(await market.getAddress(), 1000000);

    const tx1 = await market.connect(seller1).placeOrder(0, false, 10, 20);
    const r1 = await tx1.wait();
    const placed1 = r1.logs.find(l => {
      try { return market.interface.parseLog(l).name === "OrderPlaced" } catch { return false }
    });
    const id1 = placed1 ? Number((market.interface.parseLog(placed1)).args.id) : 1;

    const tx2 = await market.connect(seller2).placeOrder(0, false, 10, 15);
    await tx2.wait();

    await market.connect(buyer).placeOrder(0, true, 10, 30);

    const mtx = await market.matchOrders(0, 2);
    const mr = await mtx.wait();
    const trades = mr.logs
      .map(l => { try { return market.interface.parseLog(l) } catch { return null } })
      .filter(x => x && x.name === "Trade");
    expect(trades.length).to.be.greaterThan(0);
    const firstSellId = trades[0].args.sellId.toString();
    expect(Number(firstSellId)).to.equal(id1);

    const buyer2 = ethers.Wallet.createRandom();
    const buyer2C = buyer2.connect(ethers.provider);
    await deployer.sendTransaction({ to: await buyer2.getAddress(), value: ethers.parseEther("1") });
    await collateral.mint(await buyer2.getAddress(), 500000);
    await collateral.connect(buyer2C).approve(await market.getAddress(), 500000);

    const order = {
      maker: await buyer2.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 12,
      amount: 10,
      expiry: 0,
      salt: 12345
    };
    const domain = {
      name: "CLOBMarket",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await market.getAddress()
    };
    const types = {
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

    const signature = await buyer2.signTypedData(domain, types, order);
    const txSigned = await market.placeOrderSigned(order, signature);
    const rs = await txSigned.wait();
    const placedSigned = rs.logs.map(l => { try { return market.interface.parseLog(l) } catch { return null } })
      .find(x => x && x.name === "OrderPlacedSigned");
    expect(placedSigned.args.maker).to.equal(order.maker);

    const placedEvent = rs.logs.find(l => { try { return market.interface.parseLog(l).name === "OrderPlaced" } catch { return false } });
    const placedParsed = market.interface.parseLog(placedEvent);
    const cancelReq = {
      maker: order.maker,
      id: Number(placedParsed.args.id),
      salt: 99999
    };
    const typesCancel = {
      CancelRequest: [
        { name: "maker", type: "address" },
        { name: "id", type: "uint256" },
        { name: "salt", type: "uint256" }
      ]
    };
    const sigCancel = await buyer2.signTypedData(domain, typesCancel, cancelReq);
    await expect(market.cancelOrderSigned(cancelReq, sigCancel))
      .to.emit(market, "OrderCanceledSigned");

    const depth = await market.getOrderbookDepth(0, false, [10]);
    expect(depth[0]).to.be.greaterThan(0);

    const ids = await market.getUserOrders(await seller1.getAddress(), 0, 10);
    expect(ids.length).to.be.greaterThan(0);

    const full = await market.getOrderFull(ids[0]);
    expect(full.trader).to.equal(await seller1.getAddress());
  });

  it("mint complete set and verify balances", async function () {
    const [deployer, user] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      0,
      now + 3600,
      data
    );

    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    await market.startTrading();

    await collateral.mint(await user.getAddress(), 10000);
    await collateral.connect(user).approve(await market.getAddress(), 5000);

    await market.connect(user).mintCompleteSet(2000);

    const idNo = await outcome1155.computeTokenId(await market.getAddress(), 0);
    const idYes = await outcome1155.computeTokenId(await market.getAddress(), 1);
    const balNo = await outcome1155.balanceOf(await user.getAddress(), idNo);
    const balYes = await outcome1155.balanceOf(await user.getAddress(), idYes);
    expect(Number(balNo)).to.equal(2000);
    expect(Number(balYes)).to.equal(2000);
  });

  it("top-of-book levels and queue at price", async function () {
    const [deployer, sellerA, sellerB, sellerC] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      0,
      now + 3600,
      data
    );

    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    await market.startTrading();

    const idSell = await outcome1155.computeTokenId(await market.getAddress(), 0);
    await outcome1155.mint(await sellerA.getAddress(), idSell, 100);
    await outcome1155.mint(await sellerB.getAddress(), idSell, 100);
    await outcome1155.mint(await sellerC.getAddress(), idSell, 100);
    await outcome1155.connect(sellerA).setApprovalForAll(await market.getAddress(), true);
    await outcome1155.connect(sellerB).setApprovalForAll(await market.getAddress(), true);
    await outcome1155.connect(sellerC).setApprovalForAll(await market.getAddress(), true);

    await market.connect(sellerA).placeOrder(0, false, 10, 20);
    const rB = await (await market.connect(sellerB).placeOrder(0, false, 10, 15)).wait();
    await market.connect(sellerC).placeOrder(0, false, 12, 5);

    const top = await market.getTopOfBook(0, false, 2);
    expect(Number(top[0][0])).to.equal(10);
    expect(Number(top[1][0])).to.equal(35);
    expect(Number(top[0][1])).to.equal(12);
    expect(Number(top[1][1])).to.equal(5);

    const parsedB = rB.logs.find(l => { try { return market.interface.parseLog(l).name === "OrderPlaced" } catch { return false } });
    const idB = Number((market.interface.parseLog(parsedB)).args.id);
    const q10 = await market.getQueueAtPrice(0, false, 10, 0, 10);
    expect(Number(q10[0])).to.be.lessThan(Number(q10[1]));
    expect(q10.includes(BigInt(idB))).to.equal(true);
  });

  it("admin adjusts tick size and resolution time", async function () {
    const [deployer, user] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      0,
      now + 3600,
      data
    );

    await market.startTrading();
    await market.setTickSize(5);
    const ts = await market.tickSize();
    expect(Number(ts)).to.equal(5);

    const newRes = now + 7200;
    await market.updateResolutionTime(newRes);
    const rtime = await market.resolutionTime();
    expect(Number(rtime)).to.equal(newRes);

    const OutcomeFactory2 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155b = await OutcomeFactory2.deploy();
    await outcome1155b.waitForDeployment();
    await outcome1155b.initialize("");
    await outcome1155b.grantMinter(await market.getAddress());
    await outcome1155b.grantMinter(await deployer.getAddress());
    const idSell2 = await outcome1155b.computeTokenId(await market.getAddress(), 0);
    await outcome1155b.mint(await user.getAddress(), idSell2, 10);
    await outcome1155b.connect(user).setApprovalForAll(await market.getAddress(), true);
    await expect(market.connect(user).placeOrder(0, false, 7, 1)).to.be.reverted;
  });

  it("admin can pause trading: blocks place/match, allows cancel, resume restores", async function () {
    const [deployer, buyer, seller] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      0,
      now + 3600,
      data
    );

    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    await market.startTrading();

    const idSell = await outcome1155.computeTokenId(await market.getAddress(), 0);
    await outcome1155.mint(await seller.getAddress(), idSell, 100);
    await outcome1155.connect(seller).setApprovalForAll(await market.getAddress(), true);

    await collateral.mint(await buyer.getAddress(), 1000000);
    await collateral.connect(buyer).approve(await market.getAddress(), 1000000);

    const placedTx = await market.connect(seller).placeOrder(0, false, 10, 20);
    const placedRc = await placedTx.wait();
    const placedEv = placedRc.logs.find(l => { try { return market.interface.parseLog(l).name === "OrderPlaced" } catch { return false } });
    const placedId = Number((market.interface.parseLog(placedEv)).args.id);

    await market.pauseTrading();

    await expect(market.connect(buyer).placeOrder(0, true, 10, 5)).to.be.reverted;
    await expect(market.matchOrders(0, 1)).to.be.reverted;

    await expect(market.connect(seller).cancelOrder(placedId)).to.emit(market, "OrderCanceled");

    await market.resumeTrading();
    await market.connect(buyer).placeOrder(0, true, 10, 5);
    const m2 = await market.matchOrders(0, 1);
    await m2.wait();
  });

  it("off-chain style: fill signed BUY and SELL orders with partial fills and cancellation", async function () {
    const [deployer, buyer, seller] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    const collateral = await ERC20Factory.deploy("MockUSD", "mUSD");
    await collateral.waitForDeployment();

    const OutcomeFactory = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeFactory.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const MarketFactory = await ethers.getContractFactory("CLOBMarket");
    const market = await MarketFactory.deploy();
    await market.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    await market.initialize(
      ethers.ZeroHash,
      await deployer.getAddress(),
      await deployer.getAddress(),
      await collateral.getAddress(),
      await deployer.getAddress(),
      30,
      now + 3600,
      data
    );

    await market.startTrading();

    await outcome1155.grantMinter(await market.getAddress());
    await outcome1155.grantMinter(await deployer.getAddress());

    const tokenId = await outcome1155.computeTokenId(await market.getAddress(), 0);
    await outcome1155.mint(await seller.getAddress(), tokenId, 100);
    await outcome1155.connect(seller).setApprovalForAll(await market.getAddress(), true);

    await collateral.mint(await buyer.getAddress(), 1000000);
    await collateral.connect(buyer).approve(await market.getAddress(), 1000000);

    const buyOrder = {
      maker: await buyer.getAddress(),
      outcomeIndex: 0,
      isBuy: true,
      price: 10,
      amount: 30,
      expiry: 0,
      salt: 111
    };
    const domain = {
      name: "CLOBMarket",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await market.getAddress()
    };
    const types = {
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
    const sigBuy = await buyer.signTypedData(domain, types, buyOrder);

    await market.connect(seller).fillOrderSigned(buyOrder, sigBuy, 10);
    const f1 = await market.getFilledBySalt(await buyer.getAddress(), 111);
    expect(Number(f1)).to.equal(10);

    await market.connect(seller).fillOrderSigned(buyOrder, sigBuy, 10);
    const f2 = await market.getFilledBySalt(await buyer.getAddress(), 111);
    expect(Number(f2)).to.equal(20);

    const sellOrder = {
      maker: await seller.getAddress(),
      outcomeIndex: 0,
      isBuy: false,
      price: 12,
      amount: 10,
      expiry: 0,
      salt: 222
    };
    const sigSell = await seller.signTypedData(domain, types, sellOrder);

    await market.connect(buyer).fillOrderSigned(sellOrder, sigSell, 5);
    const f3 = await market.getFilledBySalt(await seller.getAddress(), 222);
    expect(Number(f3)).to.equal(5);

    const typesCancelSalt = {
      CancelSaltRequest: [
        { name: "maker", type: "address" },
        { name: "salt", type: "uint256" }
      ]
    };
    const cancelReq = { maker: await buyer.getAddress(), salt: 111 };
    const sigCancel = await buyer.signTypedData(domain, typesCancelSalt, cancelReq);
    await market.cancelOrderSaltSigned(cancelReq, sigCancel);
    await expect(market.connect(seller).fillOrderSigned(buyOrder, sigBuy, 5)).to.be.reverted;
  });
});

describe("OffchainBinaryMarket batchFill (CJS)", function () {
  it("rejects feeBps>0 when factory feeTo is unset", async function () {
    const [admin] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("MockUSD", "mUSD");
    await usdc.waitForDeployment();

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle = await ManualOracle.deploy(await admin.getAddress());
    await oracle.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl = await OffchainBinaryMarket.deploy();
    await impl.waitForDeployment();

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")).wait();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const resolutionTime = now + 3600;
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);

    await expect(
      mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
        templateId,
        await usdc.getAddress(),
        await oracle.getAddress(),
        80,
        resolutionTime,
        data
      )
    ).to.be.revertedWithCustomError(impl, "FeeRecipientZero");
  });

  it("reverts without taker approval and succeeds after approval", async function () {
    const [admin, maker, taker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("MockUSD", "mUSD");
    await usdc.waitForDeployment();

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle = await ManualOracle.deploy(await admin.getAddress());
    await oracle.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl = await OffchainBinaryMarket.deploy();
    await impl.waitForDeployment();

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")).wait();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const resolutionTime = now + 3600;
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    const txCreate = await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateId,
      await usdc.getAddress(),
      await oracle.getAddress(),
      0,
      resolutionTime,
      data
    );
    const receipt = await txCreate.wait();
    const created = receipt.logs
      .map((l) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "MarketCreated");
    const marketAddress = created.args.market;
    const market = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    await (await outcome1155.grantMinter(marketAddress)).wait();

    const fillAmount18 = ethers.parseEther("1");
    const takerMintAmount18 = ethers.parseEther("2");
    const takerDeposit6 = 2000000n;
    await (await usdc.mint(await taker.getAddress(), takerDeposit6)).wait();
    await (await usdc.connect(taker).approve(await market.getAddress(), takerDeposit6)).wait();
    await (await market.connect(taker).mintCompleteSet(takerMintAmount18)).wait();

    const makerDeposit6 = 1000000n;
    await (await usdc.mint(await maker.getAddress(), makerDeposit6)).wait();
    await (await usdc.connect(maker).approve(await market.getAddress(), makerDeposit6)).wait();

    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      verifyingContract: marketAddress
    };
    const types = {
      Order: [
        { name: "maker", type: "address" },
        { name: "outcomeIndex", type: "uint256" },
        { name: "isBuy", type: "bool" },
        { name: "price", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "salt", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    const m = await maker.getAddress();
    const order1 = {
      maker: m,
      outcomeIndex: "0",
      isBuy: true,
      price: "500000",
      amount: fillAmount18,
      salt: "9001",
      expiry: String(now + 3600)
    };
    const order2 = {
      maker: m,
      outcomeIndex: "0",
      isBuy: true,
      price: "500000",
      amount: fillAmount18,
      salt: "9002",
      expiry: String(now + 3600)
    };
    const sig1 = await maker.signTypedData(domain, types, order1);
    const sig2 = await maker.signTypedData(domain, types, order2);

    await expect(
      market.connect(taker).batchFill([order1, order2], [sig1, sig2], [fillAmount18, fillAmount18])
    ).to.be.revertedWithCustomError(market, "NotApproved1155");

    await (await outcome1155.connect(taker).setApprovalForAll(marketAddress, true)).wait();

    await (await market.connect(taker).batchFill([order1, order2], [sig1, sig2], [fillAmount18, fillAmount18])).wait();

    expect(await market.filledBySalt(m, 9001)).to.equal(fillAmount18);
    expect(await market.filledBySalt(m, 9002)).to.equal(fillAmount18);
  });
});

describe("MarketFactory allowlist (CJS)", function () {
  it("blocks createMarket when oracle/collateral not allowed", async function () {
    const [admin] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("MockUSD", "mUSD");
    await usdc.waitForDeployment();

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle = await ManualOracle.deploy(await admin.getAddress());
    await oracle.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl = await OffchainBinaryMarket.deploy();
    await impl.waitForDeployment();

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")).wait();

    await (await mf.setAllowlistEnforcement(true, true)).wait();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const resolutionTime = now + 3600;
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);

    await expect(
      mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
        templateId,
        await usdc.getAddress(),
        await oracle.getAddress(),
        0,
        resolutionTime,
        data
      )
    ).to.be.revertedWithCustomError(mf, "CollateralNotAllowed");

    await (await mf.setCollateralAllowed(await usdc.getAddress(), true)).wait();

    await expect(
      mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
        templateId,
        await usdc.getAddress(),
        await oracle.getAddress(),
        0,
        resolutionTime,
        data
      )
    ).to.be.revertedWithCustomError(mf, "OracleNotAllowed");

    await (await mf.setOracleAllowed(await oracle.getAddress(), true)).wait();

    await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateId,
      await usdc.getAddress(),
      await oracle.getAddress(),
      0,
      resolutionTime,
      data
    );
  });
});

describe("OffchainBinaryMarket resolution safety (CJS)", function () {
  it("allows creator to invalidate if oracle revert blocks resolve", async function () {
    const [admin, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("MockUSD", "mUSD");
    await usdc.waitForDeployment();

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155 = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const RevertingOracle = await ethers.getContractFactory("RevertingOracle");
    const oracle = await RevertingOracle.deploy();
    await oracle.waitForDeployment();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl = await OffchainBinaryMarket.deploy();
    await impl.waitForDeployment();

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")).wait();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const resolutionTime = now + 2;
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await outcome1155.getAddress()]);
    const txCreate = await mf["createMarket(bytes32,address,address,uint256,uint256,bytes)"](
      templateId,
      await usdc.getAddress(),
      await oracle.getAddress(),
      0,
      resolutionTime,
      data
    );
    const receipt = await txCreate.wait();
    const created = receipt.logs
      .map((l) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "MarketCreated");
    const marketAddress = created.args.market;
    const market = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    await (await outcome1155.grantMinter(marketAddress)).wait();

    const amount18 = ethers.parseEther("1");
    const deposit6 = 1000000n;
    await (await usdc.mint(await user.getAddress(), deposit6)).wait();
    await (await usdc.connect(user).approve(marketAddress, deposit6)).wait();
    await (await market.connect(user).mintCompleteSet(amount18)).wait();

    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);

    await expect(market.resolve()).to.be.revertedWithCustomError(market, "OracleQueryFailed");

    await (await market.connect(admin).invalidate()).wait();

    await (await market.connect(user).redeemCompleteSetOnInvalid(amount18)).wait();
  });
});
