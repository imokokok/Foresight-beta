require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const {
  PRIVATE_KEY,
  SEPOLIA_RPC_URL,
  MAINNET_RPC_URL,
  POLYGON_RPC_URL,
  AMOY_RPC_URL,
  ETHERSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  REPORT_GAS
} = process.env;

function validPK(pk) {
  return typeof pk === "string" && /^0x[0-9a-fA-F]{64}$/.test(pk);
}
const accounts = validPK(PRIVATE_KEY) ? [PRIVATE_KEY] : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 1 }
    }
  },
  paths: {
    // 将合约源码路径指向工作区 packages/contracts/contracts
    sources: "packages/contracts/contracts"
  },
  networks: {
    hardhat: { chainId: 1337, allowUnlimitedContractSize: true },
    localhost: { url: "http://127.0.0.1:8545", chainId: 1337 },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      ...(accounts ? { accounts } : {}),
      chainId: 11155111
    },
    mainnet: {
      url: MAINNET_RPC_URL || "",
      ...(accounts ? { accounts } : {}),
      chainId: 1
    },
    polygon: {
      url: POLYGON_RPC_URL || "",
      ...(accounts ? { accounts } : {}),
      chainId: 137
    },
    polygonAmoy: {
      url: AMOY_RPC_URL || "",
      ...(accounts ? { accounts } : {}),
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY || "",
      mainnet: ETHERSCAN_API_KEY || "",
      polygon: POLYGONSCAN_API_KEY || "",
      polygonAmoy: POLYGONSCAN_API_KEY || ""
    }
  },
  gasReporter: {
    enabled: REPORT_GAS !== undefined,
    currency: "USD"
  }
};