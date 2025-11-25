import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Foresight", function () {
  async function deployForesightFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const Foresight = await ethers.getContractFactory("Foresight");
    const foresight = await Foresight.deploy();

    return { foresight, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { foresight } = await loadFixture(deployForesightFixture);
      expect(await foresight.getAddress()).to.be.properAddress;
    });
  });

  describe("Create Prediction", function () {
    it("Should create a new prediction", async function () {
      const { foresight, owner } = await loadFixture(deployForesightFixture);
      
      const title = "Will BTC reach $100k by end of 2024?";
      const description = "Bitcoin price prediction for 2024";
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      
      await expect(foresight.createPrediction(title, description, deadline))
        .to.emit(foresight, "PredictionCreated")
        .withArgs(0, owner.address, title, deadline);
      
      const prediction = await foresight.getPrediction(0);
      expect(prediction.creator).to.equal(owner.address);
      expect(prediction.title).to.equal(title);
      expect(prediction.description).to.equal(description);
      expect(prediction.deadline).to.equal(deadline);
      expect(prediction.resolved).to.be.false;
    });

    it("Should revert with empty title", async function () {
      const { foresight } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      
      await expect(foresight.createPrediction("", "description", deadline))
        .to.be.revertedWith("Title cannot be empty");
    });

    it("Should revert with past deadline", async function () {
      const { foresight } = await loadFixture(deployForesightFixture);
      
      const pastDeadline = Math.floor(Date.now() / 1000) - 86400;
      
      await expect(foresight.createPrediction("Title", "description", pastDeadline))
        .to.be.revertedWith("Deadline must be in the future");
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake on predictions", async function () {
      const { foresight, user1 } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await foresight.createPrediction("Test Prediction", "Description", deadline);
      
      const stakeAmount = ethers.parseEther("0.1");
      await expect(foresight.connect(user1).stake(0, 0, { value: stakeAmount }))
        .to.emit(foresight, "StakeAdded")
        .withArgs(0, user1.address, 0, stakeAmount);
      
      const userStake = await foresight.getUserStake(0, user1.address, 0);
      expect(userStake).to.equal(stakeAmount);
      
      const optionStake = await foresight.getOptionStake(0, 0);
      expect(optionStake).to.equal(stakeAmount);
      
      const prediction = await foresight.getPrediction(0);
      expect(prediction.totalStake).to.equal(stakeAmount);
    });

    it("Should revert when staking on invalid prediction", async function () {
      const { foresight, user1 } = await loadFixture(deployForesightFixture);
      
      await expect(foresight.connect(user1).stake(999, 0, { value: ethers.parseEther("0.1") }))
        .to.be.revertedWith("Invalid prediction ID");
    });

    it("Should revert when staking after deadline", async function () {
      const { foresight, user1 } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 1; // 1 second from now
      await foresight.createPrediction("Test Prediction", "Description", deadline);
      
      // Wait for deadline to pass
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(foresight.connect(user1).stake(0, 0, { value: ethers.parseEther("0.1") }))
        .to.be.revertedWith("Prediction deadline passed");
    });
  });

  describe("Resolve Prediction", function () {
    it("Should allow creator to resolve prediction", async function () {
      const { foresight, owner } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await foresight.createPrediction("Test Prediction", "Description", deadline);
      
      // Wait for deadline to pass
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      
      await expect(foresight.resolvePrediction(0, 1))
        .to.emit(foresight, "PredictionResolved")
        .withArgs(0, 1);
      
      const prediction = await foresight.getPrediction(0);
      expect(prediction.resolved).to.be.true;
      expect(prediction.winningOption).to.equal(1);
    });

    it("Should revert when non-creator tries to resolve", async function () {
      const { foresight, user1 } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await foresight.createPrediction("Test Prediction", "Description", deadline);
      
      await expect(foresight.connect(user1).resolvePrediction(0, 1))
        .to.be.revertedWith("Only creator can resolve");
    });
  });

  describe("Claim Reward", function () {
    it("Should allow users to claim rewards", async function () {
      const { foresight, owner, user1, user2 } = await loadFixture(deployForesightFixture);
      
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await foresight.createPrediction("Test Prediction", "Description", deadline);
      
      // User1 stakes on option 0
      await foresight.connect(user1).stake(0, 0, { value: ethers.parseEther("0.1") });
      // User2 stakes on option 1
      await foresight.connect(user2).stake(0, 1, { value: ethers.parseEther("0.2") });
      
      // Wait for deadline to pass
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      
      // Resolve with option 1 as winner
      await foresight.resolvePrediction(0, 1);
      
      // Check user2's balance before claiming
      const initialBalance = await ethers.provider.getBalance(user2.address);
      
      // User2 claims reward
      const tx = await foresight.connect(user2).claimReward(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(user2.address);
      
      // User2 should get their stake back plus proportional reward
      // Total stake: 0.3 ETH, User2 stake: 0.2 ETH on winning option
      // Reward = (0.2 / 0.2) * 0.3 = 0.3 ETH
      // Final balance should be initial + 0.3 ETH - gas fees
      const expectedReward = ethers.parseEther("0.3");
      expect(finalBalance).to.equal(initialBalance + expectedReward - gasUsed);
    });
  });
});