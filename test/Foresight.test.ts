import { expect } from "chai";
import pkg from "hardhat";

const { ethers } = pkg;

describe("Foresight", function () {
  it("deploys and sets admin role", async function () {
    const [admin] = await ethers.getSigners();

    const Foresight = await ethers.getContractFactory("Foresight");
    const token: any = await Foresight.deploy(await admin.getAddress());
    await token.waitForDeployment();

    expect(
      await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), await admin.getAddress())
    ).to.equal(true);
  });

  it("only MINTER_ROLE can mint", async function () {
    const [admin, user] = await ethers.getSigners();

    const Foresight = await ethers.getContractFactory("Foresight");
    const token: any = await Foresight.deploy(await admin.getAddress());
    await token.waitForDeployment();

    await (expect(token.connect(user).mint(await user.getAddress(), 1)) as any).to.be.reverted;

    await token.grantRole(await token.MINTER_ROLE(), await admin.getAddress());
    await token.mint(await user.getAddress(), 123);

    expect(await token.balanceOf(await user.getAddress())).to.equal(123);
  });
});
