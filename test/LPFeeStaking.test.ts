import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

describe("LPFeeStaking", function () {
  it("distributes transferred rewards pro-rata", async function () {
    const [admin, alice, bob] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await ERC20.deploy("MockUSD", "mUSD");

    const Foresight = await ethers.getContractFactory("Foresight");
    const lp: any = await Foresight.deploy(await admin.getAddress());
    await lp.grantRole(await lp.MINTER_ROLE(), await admin.getAddress());

    const Staking = await ethers.getContractFactory("LPFeeStaking");
    const staking: any = await Staking.deploy(
      await admin.getAddress(),
      await lp.getAddress(),
      await usdc.getAddress()
    );

    await lp.mint(await alice.getAddress(), 1000);
    await lp.mint(await bob.getAddress(), 3000);

    await lp.connect(alice).approve(await staking.getAddress(), 1000);
    await lp.connect(bob).approve(await staking.getAddress(), 3000);

    await staking.connect(alice).stake(1000);
    await staking.connect(bob).stake(3000);

    await usdc.mint(await staking.getAddress(), 400);

    expect(await staking.earned(await alice.getAddress())).to.equal(100);
    expect(await staking.earned(await bob.getAddress())).to.equal(300);

    const beforeA = await usdc.balanceOf(await alice.getAddress());
    const beforeB = await usdc.balanceOf(await bob.getAddress());

    await staking.connect(alice).getReward();
    await staking.connect(bob).getReward();

    const afterA = await usdc.balanceOf(await alice.getAddress());
    const afterB = await usdc.balanceOf(await bob.getAddress());

    expect(afterA - beforeA).to.equal(100);
    expect(afterB - beforeB).to.equal(300);
  });

  it("handles reward sync across multiple transfers and withdrawals", async function () {
    const [admin, alice, bob] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("MockERC20");
    const usdc: any = await ERC20.deploy("MockUSD", "mUSD");

    const Foresight = await ethers.getContractFactory("Foresight");
    const lp: any = await Foresight.deploy(await admin.getAddress());
    await lp.grantRole(await lp.MINTER_ROLE(), await admin.getAddress());

    const Staking = await ethers.getContractFactory("LPFeeStaking");
    const staking: any = await Staking.deploy(
      await admin.getAddress(),
      await lp.getAddress(),
      await usdc.getAddress()
    );

    await lp.mint(await alice.getAddress(), 1000);
    await lp.mint(await bob.getAddress(), 1000);
    await lp.connect(alice).approve(await staking.getAddress(), 1000);
    await lp.connect(bob).approve(await staking.getAddress(), 1000);

    await staking.connect(alice).stake(1000);
    await usdc.mint(await staking.getAddress(), 100);
    await staking.connect(alice).getReward();

    await staking.connect(bob).stake(1000);
    await usdc.mint(await staking.getAddress(), 200);

    await staking.connect(alice).withdraw(500);

    const earnedA = await staking.earned(await alice.getAddress());
    const earnedB = await staking.earned(await bob.getAddress());
    expect(earnedA + earnedB).to.equal(200);

    await staking.connect(alice).getReward();
    await staking.connect(bob).getReward();

    const balA = await usdc.balanceOf(await alice.getAddress());
    const balB = await usdc.balanceOf(await bob.getAddress());
    expect(balA + balB).to.equal(300);
  });
});
