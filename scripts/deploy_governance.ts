/// <reference types="@nomicfoundation/hardhat-ethers" />
/**
 * @title Governance Deployment Script
 * @notice Deploys Timelock and configures multi-sig governance (Polymarket-style)
 * 
 * Architecture:
 * 
 *   Gnosis Safe (3/5 multisig)
 *           │
 *           ▼
 *   ForesightTimelock (24h delay)
 *           │
 *           ▼
 *   ┌───────┴───────┐
 *   │               │
 *   ▼               ▼
 * MarketFactory   UMAOracleAdapterV2
 * 
 * Usage:
 *   SAFE_ADDRESS=0x... TIMELOCK_DELAY=86400 npx hardhat run scripts/deploy_governance.ts --network amoy
 * 
 * Environment variables:
 *   - SAFE_ADDRESS: Pre-created Gnosis Safe address (create at https://safe.global)
 *   - TIMELOCK_DELAY: Delay in seconds (default: 86400 = 24 hours)
 *   - MARKET_FACTORY_ADDRESS: Existing MarketFactory to configure
 *   - UMA_ADAPTER_ADDRESS: Existing UMAOracleAdapterV2 to configure
 */
import hre from "hardhat";
import fs from "fs";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  const env = process.env;

  // --- Configuration ---
  const safeAddress = env.SAFE_ADDRESS;
  if (!safeAddress) {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    GNOSIS SAFE SETUP REQUIRED                      ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Before running this script, create a Gnosis Safe:                 ║
║                                                                    ║
║  1. Go to https://app.safe.global                                  ║
║  2. Connect wallet and select your network                         ║
║  3. Click "Create Safe"                                            ║
║  4. Add signers (recommended: 5 addresses)                         ║
║  5. Set threshold (recommended: 3 of 5)                            ║
║  6. Deploy the Safe                                                ║
║  7. Copy the Safe address                                          ║
║                                                                    ║
║  Then run:                                                         ║
║  SAFE_ADDRESS=0x... npx hardhat run scripts/deploy_governance.ts   ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const timelockDelay = env.TIMELOCK_DELAY ? parseInt(env.TIMELOCK_DELAY) : 86400; // 24 hours default
  console.log(`Timelock delay: ${timelockDelay} seconds (${timelockDelay / 3600} hours)`);

  // --- Deploy Timelock ---
  console.log("\n--- Deploying ForesightTimelock ---");
  const ForesightTimelock = await hre.ethers.getContractFactory("ForesightTimelock");
  
  // Proposers: Only the Safe can propose
  const proposers = [safeAddress];
  // Executors: Anyone can execute after delay (address(0) means open)
  const executors = [hre.ethers.ZeroAddress];
  // Admin: Renounce admin role for decentralization (address(0))
  const admin = hre.ethers.ZeroAddress;

  const timelock = await ForesightTimelock.deploy(timelockDelay, proposers, executors, admin);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("ForesightTimelock deployed:", timelockAddress);

  // --- Configure existing contracts (if provided) ---
  const factoryAddress = env.MARKET_FACTORY_ADDRESS;
  const umaAdapterAddress = env.UMA_ADAPTER_ADDRESS;

  if (factoryAddress) {
    console.log("\n--- Configuring MarketFactory ---");
    const factory = await hre.ethers.getContractAt("MarketFactory", factoryAddress);
    
    // Grant ADMIN_ROLE to Timelock
    const ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
    const hasRole = await factory.hasRole(ADMIN_ROLE, timelockAddress);
    if (!hasRole) {
      const tx = await factory.grantRole(ADMIN_ROLE, timelockAddress);
      await tx.wait();
      console.log("Granted ADMIN_ROLE to Timelock on MarketFactory");
    }

    // Note: Don't revoke deployer's role yet - do this manually after verifying everything works
    console.log("⚠️  Remember to revoke deployer's ADMIN_ROLE after verification:");
    console.log(`   factory.revokeRole(ADMIN_ROLE, "${deployerAddress}")`);
  }

  if (umaAdapterAddress) {
    console.log("\n--- Configuring UMAOracleAdapterV2 ---");
    const umaAdapter = await hre.ethers.getContractAt("UMAOracleAdapterV2", umaAdapterAddress);
    
    // Grant roles to Timelock/Safe
    const DEFAULT_ADMIN_ROLE = await umaAdapter.DEFAULT_ADMIN_ROLE();
    const REPORTER_ROLE = await umaAdapter.REPORTER_ROLE();
    const REGISTRAR_ROLE = await umaAdapter.REGISTRAR_ROLE();

    // Timelock gets admin control
    if (!(await umaAdapter.hasRole(DEFAULT_ADMIN_ROLE, timelockAddress))) {
      await (await umaAdapter.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress)).wait();
      console.log("Granted DEFAULT_ADMIN_ROLE to Timelock on UMAOracleAdapterV2");
    }

    // Safe gets REPORTER_ROLE directly (no timelock for assertions - they have UMA's liveness period)
    if (!(await umaAdapter.hasRole(REPORTER_ROLE, safeAddress))) {
      await (await umaAdapter.grantRole(REPORTER_ROLE, safeAddress)).wait();
      console.log("Granted REPORTER_ROLE to Safe on UMAOracleAdapterV2");
    }

    // Timelock gets REGISTRAR_ROLE
    if (!(await umaAdapter.hasRole(REGISTRAR_ROLE, timelockAddress))) {
      await (await umaAdapter.grantRole(REGISTRAR_ROLE, timelockAddress)).wait();
      console.log("Granted REGISTRAR_ROLE to Timelock on UMAOracleAdapterV2");
    }

    console.log("⚠️  Remember to revoke deployer's roles after verification:");
    console.log(`   umaAdapter.revokeRole(DEFAULT_ADMIN_ROLE, "${deployerAddress}")`);
    console.log(`   umaAdapter.revokeRole(REPORTER_ROLE, "${deployerAddress}")`);
  }

  // --- Save deployment info ---
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployerAddress,
    governance: {
      gnosisSafe: safeAddress,
      timelock: timelockAddress,
      timelockDelaySeconds: timelockDelay,
    },
    configured: {
      marketFactory: factoryAddress || null,
      umaAdapter: umaAdapterAddress || null,
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync("deployment_governance.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✅ Saved deployment_governance.json");

  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                    GOVERNANCE SETUP COMPLETE                       ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  Gnosis Safe:     ${safeAddress}      ║
║  Timelock:        ${timelockAddress}      ║
║  Delay:           ${timelockDelay} seconds (${timelockDelay / 3600} hours)                        ║
║                                                                    ║
║  NEXT STEPS:                                                       ║
║                                                                    ║
║  1. Verify Timelock on block explorer                              ║
║  2. Test a transaction through Safe → Timelock → Contract          ║
║  3. After verification, revoke deployer's admin roles              ║
║  4. Add Timelock to Safe's Apps for easier management              ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

