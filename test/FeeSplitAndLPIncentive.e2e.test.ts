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
});
