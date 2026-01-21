/// <reference types="@nomicfoundation/hardhat-ethers" />
import hre from "hardhat";

async function main() {
  const binImplAddress = "0x65E67c0D6D51Fd163C9E6d66A015807D7e494Fc9";

  // 检查实现合约的存储槽
  // OpenZeppelin Initializable 使用 slot 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00
  const initSlot = "0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00";

  const storage = await hre.ethers.provider.getStorage(binImplAddress, initSlot);
  console.log("Binary impl initialization storage:", storage);

  // 解析初始化状态
  // bit 0-63: _initialized (version)
  // bit 64: _initializing
  const value = BigInt(storage);
  const initialized = value & BigInt("0xFFFFFFFFFFFFFFFF");
  const initializing = (value >> BigInt(64)) & BigInt(1);

  console.log("_initialized version:", initialized.toString());
  console.log("_initializing:", initializing.toString());

  // 如果已经初始化，需要重新部署模板
  if (initialized > 0n) {
    console.log("\n⚠️ Implementation is already initialized!");
    console.log("We need to redeploy the template implementations.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
