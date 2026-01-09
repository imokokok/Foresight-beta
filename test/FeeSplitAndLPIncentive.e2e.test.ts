import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

describe("Fee split + LP incentive end-to-end", function () {
  it("routes redeem fees to protocol and LP staking, and LP can claim", async function () {
    const [admin, user, lp] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await MockERC20.deploy("MockUSD", "mUSD");

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155: any = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle: any = await ManualOracle.deploy(await admin.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const binaryImpl: any = await OffchainBinaryMarket.deploy();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf: any = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (
      await mf.registerTemplate(templateId, await binaryImpl.getAddress(), "Offchain Binary v1")
    ).wait();

    const Foresight = await ethers.getContractFactory("Foresight");
    const foresight: any = await Foresight.deploy(await admin.getAddress());
    await (
      await foresight.grantRole(await foresight.MINTER_ROLE(), await admin.getAddress())
    ).wait();

    const LPFeeStaking = await ethers.getContractFactory("LPFeeStaking");
    const staking: any = await LPFeeStaking.deploy(
      await admin.getAddress(),
      await foresight.getAddress(),
      await usdc.getAddress()
    );

    const protocolTreasury = await admin.getAddress();
    await (await mf.setFee(80, protocolTreasury)).wait();
    await (await mf.setFeeSplit(40, await staking.getAddress())).wait();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const resolutionTime = now + 10;
    const data = new ethers.AbiCoder().encode(["address"], [await outcome1155.getAddress()]);

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
      .map((l: any) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x: any) => x && x.name === "MarketCreated");
    expect(created).to.not.equal(undefined);
    const marketAddress = created.args.market;

    const market: any = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    await (await outcome1155.grantMinter(marketAddress)).wait();

    const amount18 = ethers.parseEther("100");
    const deposit6 = BigInt(100_000_000);
    await usdc.mint(await user.getAddress(), deposit6);
    await usdc.connect(user).approve(marketAddress, deposit6);
    await market.connect(user).mintCompleteSet(amount18);
    await outcome1155.connect(user).setApprovalForAll(marketAddress, true);

    await foresight.mint(await lp.getAddress(), ethers.parseEther("1000"));
    await foresight.connect(lp).approve(await staking.getAddress(), ethers.parseEther("1000"));
    await staking.connect(lp).stake(ethers.parseEther("1000"));

    await ethers.provider.send("evm_increaseTime", [20]);
    await ethers.provider.send("evm_mine", []);
    await oracle.setOutcome(1);
    await market.resolve();

    const userBefore = await usdc.balanceOf(await user.getAddress());
    const protocolBefore = await usdc.balanceOf(protocolTreasury);
    const lpBefore = await usdc.balanceOf(await lp.getAddress());

    await market.connect(user).redeem(amount18);

    const userAfter = await usdc.balanceOf(await user.getAddress());
    const protocolAfter = await usdc.balanceOf(protocolTreasury);

    expect(userAfter - userBefore).to.equal(BigInt(99_200_000));
    expect(protocolAfter - protocolBefore).to.equal(BigInt(400_000));

    await staking.connect(lp).getReward();
    const lpAfter = await usdc.balanceOf(await lp.getAddress());
    expect(lpAfter - lpBefore).to.equal(BigInt(400_000));
  });

  it("rejects high-s EIP712 signatures", async function () {
    const [admin, maker, taker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await MockERC20.deploy("MockUSD", "mUSD");

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155: any = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle: any = await ManualOracle.deploy(await admin.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl: any = await OffchainBinaryMarket.deploy();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf: any = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (
      await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")
    ).wait();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const resolutionTime = now + 3600;
    const data = new ethers.AbiCoder().encode(["address"], [await outcome1155.getAddress()]);

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
      .map((l: any) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x: any) => x && x.name === "MarketCreated");
    const marketAddress = created.args.market;
    const market: any = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    await (await outcome1155.grantMinter(marketAddress)).wait();

    const makerOrderAmount18 = ethers.parseEther("1");
    const deposit6 = BigInt(1_000_000);
    await usdc.mint(await maker.getAddress(), deposit6);
    await usdc.connect(maker).approve(marketAddress, deposit6);
    await market.connect(maker).mintCompleteSet(makerOrderAmount18);

    await outcome1155.connect(maker).setApprovalForAll(marketAddress, true);
    await usdc.mint(await taker.getAddress(), deposit6);
    await usdc.connect(taker).approve(marketAddress, deposit6);

    const order = {
      maker: await maker.getAddress(),
      outcomeIndex: "0",
      isBuy: true,
      price: "500000",
      amount: makerOrderAmount18,
      salt: "123",
      expiry: String(now + 3600),
    };

    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      verifyingContract: marketAddress,
    };
    const types = {
      Order: [
        { name: "maker", type: "address" },
        { name: "outcomeIndex", type: "uint256" },
        { name: "isBuy", type: "bool" },
        { name: "price", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "salt", type: "uint256" },
        { name: "expiry", type: "uint256" },
      ],
    };

    const sig = await maker.signTypedData(domain as any, types as any, order as any);
    const parsed = ethers.Signature.from(sig);
    const n = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
    const highS = n - BigInt(parsed.s);
    const rHex = parsed.r.slice(2).padStart(64, "0");
    const sHex = ethers.toBeHex(highS, 32).slice(2).padStart(64, "0");
    const newYParity = parsed.yParity ? 0 : 1;
    const vHex = (27 + newYParity).toString(16).padStart(2, "0");
    const highSig = ("0x" + rHex + sHex + vHex) as `0x${string}`;

    await (
      expect(market.connect(taker).fillOrderSigned(order, highSig, makerOrderAmount18)) as any
    ).to.be.revertedWithCustomError(market, "InvalidSignatureS");
  });

  it("rejects too-soon expiry and invalid signatures with InvalidSignedRequest", async function () {
    const [admin, maker, taker] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await MockERC20.deploy("MockUSD", "mUSD");

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155: any = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle: any = await ManualOracle.deploy(await admin.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl: any = await OffchainBinaryMarket.deploy();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf: any = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (
      await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")
    ).wait();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const resolutionTime = now + 3600;
    const data = new ethers.AbiCoder().encode(["address"], [await outcome1155.getAddress()]);

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
      .map((l: any) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x: any) => x && x.name === "MarketCreated");
    const marketAddress = created.args.market;
    const market: any = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    await (await outcome1155.grantMinter(marketAddress)).wait();

    const amount18 = ethers.parseEther("1");
    const deposit6 = BigInt(1_000_000);
    await usdc.mint(await maker.getAddress(), deposit6);
    await usdc.connect(maker).approve(marketAddress, deposit6);
    await market.connect(maker).mintCompleteSet(amount18);
    await outcome1155.connect(maker).setApprovalForAll(marketAddress, true);

    await usdc.mint(await taker.getAddress(), deposit6);
    await usdc.connect(taker).approve(marketAddress, deposit6);

    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      verifyingContract: marketAddress,
    };
    const types = {
      Order: [
        { name: "maker", type: "address" },
        { name: "outcomeIndex", type: "uint256" },
        { name: "isBuy", type: "bool" },
        { name: "price", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "salt", type: "uint256" },
        { name: "expiry", type: "uint256" },
      ],
    };

    const shortExpiryOrder = {
      maker: await maker.getAddress(),
      outcomeIndex: "0",
      isBuy: true,
      price: "500000",
      amount: amount18,
      salt: "1",
      expiry: String(now + 10),
    };
    const shortSig = await maker.signTypedData(
      domain as any,
      types as any,
      shortExpiryOrder as any
    );
    await (
      expect(market.connect(taker).fillOrderSigned(shortExpiryOrder, shortSig, amount18)) as any
    ).to.be.revertedWithCustomError(market, "OrderLifetimeTooShort");

    const okOrder = {
      maker: await maker.getAddress(),
      outcomeIndex: "0",
      isBuy: true,
      price: "500000",
      amount: amount18,
      salt: "2",
      expiry: String(now + 3600),
    };
    const okSig = await maker.signTypedData(domain as any, types as any, okOrder as any);
    const badSig = (okSig.slice(0, okSig.length - 2) + "00") as `0x${string}`;
    await (
      expect(market.connect(taker).fillOrderSigned(okOrder, badSig, amount18)) as any
    ).to.be.revertedWithCustomError(market, "InvalidSignedRequest");
  });

  it("strict batch cancel reverts on any invalid item and cancels all-or-nothing", async function () {
    const [admin, maker1, maker2, relayer] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await MockERC20.deploy("MockUSD", "mUSD");

    const OutcomeToken1155 = await ethers.getContractFactory("OutcomeToken1155");
    const outcome1155: any = await OutcomeToken1155.deploy();
    await outcome1155.waitForDeployment();
    await outcome1155.initialize("");

    const ManualOracle = await ethers.getContractFactory("ManualOracle");
    const oracle: any = await ManualOracle.deploy(await admin.getAddress());

    const OffchainBinaryMarket = await ethers.getContractFactory("OffchainBinaryMarket");
    const impl: any = await OffchainBinaryMarket.deploy();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const mf: any = await MarketFactory.deploy();
    await mf.waitForDeployment();
    await mf.initialize(await admin.getAddress(), await oracle.getAddress());

    const templateId = ethers.id("OFFCHAIN_BINARY_V1");
    await (
      await mf.registerTemplate(templateId, await impl.getAddress(), "Offchain Binary v1")
    ).wait();

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const resolutionTime = now + 3600;
    const data = new ethers.AbiCoder().encode(["address"], [await outcome1155.getAddress()]);

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
      .map((l: any) => {
        try {
          return mf.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x: any) => x && x.name === "MarketCreated");
    const marketAddress = created.args.market;
    const market: any = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    const domain = {
      name: "Foresight Market",
      version: "1",
      chainId: Number((await ethers.provider.getNetwork()).chainId),
      verifyingContract: marketAddress,
    };
    const types = {
      CancelSaltRequest: [
        { name: "maker", type: "address" },
        { name: "salt", type: "uint256" },
      ],
    };

    const maker1Addr = await maker1.getAddress();
    const maker2Addr = await maker2.getAddress();

    const okReq1 = { maker: maker1Addr, salt: "11" };
    const okReq2 = { maker: maker2Addr, salt: "22" };
    const okSig1 = await maker1.signTypedData(domain as any, types as any, okReq1 as any);
    const okSig2 = await maker2.signTypedData(domain as any, types as any, okReq2 as any);

    await market
      .connect(relayer)
      .cancelSaltsBatchStrict([maker1Addr, maker2Addr], [11, 22], [okSig1, okSig2]);
    expect(await market.canceledSalt(maker1Addr, 11)).to.equal(true);
    expect(await market.canceledSalt(maker2Addr, 22)).to.equal(true);

    const req3 = { maker: maker1Addr, salt: "33" };
    const req4 = { maker: maker2Addr, salt: "44" };
    const sig3 = await maker1.signTypedData(domain as any, types as any, req3 as any);
    const sig4 = await maker2.signTypedData(domain as any, types as any, req4 as any);
    const badSig4 = (sig4.slice(0, sig4.length - 2) + "00") as `0x${string}`;

    await (
      expect(
        market
          .connect(relayer)
          .cancelSaltsBatchStrict([maker1Addr, maker2Addr], [33, 44], [sig3, badSig4])
      ) as any
    ).to.be.revertedWithCustomError(market, "InvalidSignedRequest");
    expect(await market.canceledSalt(maker1Addr, 33)).to.equal(false);
    expect(await market.canceledSalt(maker2Addr, 44)).to.equal(false);

    const sig5 = await maker1.signTypedData(domain as any, types as any, okReq1 as any);
    await (
      expect(market.connect(relayer).cancelSaltsBatchStrict([maker1Addr], [11], [sig5])) as any
    ).to.be.revertedWithCustomError(market, "OrderCanceled");
  });
});
