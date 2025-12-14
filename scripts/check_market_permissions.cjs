const hre = require("hardhat");

async function main() {
  const marketAddr = "0xBec1Fd7e69346aCBa7C15d6E380FcCA993Ea6b02";
  const [signer] = await hre.ethers.getSigners();
  const signerAddr = await signer.getAddress();
  console.log("Checking permissions for market:", marketAddr);
  console.log("Signer:", signerAddr);

  // 1. Get Market Contract to find OutcomeToken
  const market = await hre.ethers.getContractAt("CLOBMarket", marketAddr);
  
  let outcomeTokenAddr;
  try {
      outcomeTokenAddr = await market.outcomeToken();
      console.log("OutcomeToken address:", outcomeTokenAddr);
  } catch (e) {
      console.error("Failed to get outcomeToken from market. Is this a valid market contract?", e);
      return;
  }

  // 2. Check MINTER_ROLE on OutcomeToken
  const outcomeToken = await hre.ethers.getContractAt("OutcomeToken1155", outcomeTokenAddr);
  const MINTER_ROLE = await outcomeToken.MINTER_ROLE();
  
  const hasRole = await outcomeToken.hasRole(MINTER_ROLE, marketAddr);
  console.log(`Market ${marketAddr} has MINTER_ROLE? ${hasRole}`);

  if (!hasRole) {
      console.log("Attempting to grant MINTER_ROLE...");
      try {
          const tx = await outcomeToken.grantMinter(marketAddr);
          console.log("Grant transaction sent:", tx.hash);
          await tx.wait();
          console.log("MINTER_ROLE granted successfully!");
      } catch (e) {
          console.error("Failed to grant role:", e.message);
          console.log("Ensure the signer has DEFAULT_ADMIN_ROLE on OutcomeToken.");
      }
  } else {
      console.log("Permissions look correct.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
