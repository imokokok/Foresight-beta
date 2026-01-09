/**
 * @deprecated This script uses legacy CLOBMarket. Use new off-chain orderbook architecture.
 */
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const addr = await signer.getAddress();
  console.log("Trader:", addr);

  const market = process.env.CLOB_MARKET_ADDRESS || '0x8b2aE97451d5773319b9d3480A71b010a544A10b';
  const usdc = process.env.USDC_ADDRESS_AMOY || process.env.NEXT_PUBLIC_USDC_ADDRESS_AMOY || '0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf';
  const outcome1155 = process.env.OUTCOME1155_ADDRESS || '0x11A5daf63ad1d4b59E0aC91D4EA25891B94E5394';

  const erc20 = await hre.ethers.getContractAt("IERC20", usdc);
  const outcome = await hre.ethers.getContractAt("OutcomeToken1155", outcome1155);
  const clob = await hre.ethers.getContractAt("CLOBMarket", market);

  // Approve USDC for market
  const appr = await erc20.approve(market, hre.ethers.MaxUint256);
  await appr.wait();
  console.log("USDC approved");

  // Mint complete set for taker
  const mintTx = await clob.mintCompleteSet(5);
  await mintTx.wait();
  console.log("Minted complete set 5");

  // Approve 1155 to market
  const approved = await outcome.isApprovedForAll(addr, market);
  if (!approved) {
    const tx = await outcome.setApprovalForAll(market, true);
    await tx.wait();
    console.log("Approved 1155 for market");
  }

  // EIP-712 order
  const network = await hre.ethers.provider.getNetwork();
  const domain = { name: 'CLOBMarket', version: '1', chainId: Number(network.chainId), verifyingContract: market };
  const types = {
    OrderRequest: [
      { name: 'maker', type: 'address' },
      { name: 'outcomeIndex', type: 'uint256' },
      { name: 'isBuy', type: 'bool' },
      { name: 'price', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
    ]
  };
  const req = {
    maker: addr,
    outcomeIndex: 0,
    isBuy: true,
    price: 1000000,
    amount: 2,
    expiry: Math.floor(Date.now() / 1000) + 86400,
    salt: Math.floor(Math.random() * 1e9)
  };
  const sig = await signer.signTypedData(domain, types, req);

  const fillTx = await clob.fillOrderSigned(req, sig, 1);
  const rc = await fillTx.wait();
  console.log("Filled signed order fillAmount=1 at price 1 USDC, tx:", rc.hash);
}

main().catch((err) => { console.error(err); process.exit(1); });
