/**
 * @deprecated This script uses legacy CLOBMarket. Use new off-chain orderbook architecture.
 */
const { ethers } = require('ethers');

async function main() {
  const pk = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : ('0x' + process.env.PRIVATE_KEY);
  const rpc = process.env.AMOY_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpc);
  const w = new ethers.Wallet(pk, provider);
  const market = process.env.CLOB_MARKET_ADDRESS || '0x8b2aE97451d5773319b9d3480A71b010a544A10b';
  const usdt = process.env.USDT_ADDRESS_AMOY || process.env.NEXT_PUBLIC_USDT_ADDRESS_AMOY || '0xdc85e8303CD81e8E78f432bC2c0D673Abccd7Daf';
  const outcome1155 = process.env.OUTCOME1155_ADDRESS || '0x11A5daf63ad1d4b59E0aC91D4EA25891B94E5394';

  const erc20 = new ethers.Contract(usdt, [
    'function approve(address spender,uint256 amount) external returns (bool)',
    'function balanceOf(address) view returns (uint256)'
  ], w);
  const erc1155 = new ethers.Contract(outcome1155, [
    'function setApprovalForAll(address operator,bool approved) external',
    'function isApprovedForAll(address account,address operator) view returns (bool)'
  ], w);
  const clob = new ethers.Contract(market, [
    'function mintCompleteSet(uint256 amount) external',
    'function fillOrderSigned(tuple(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 expiry,uint256 salt) req, bytes signature, uint256 fillAmount) external'
  ], w);

  const bal = await erc20.balanceOf(w.address);
  console.log('USDT balance', bal.toString());
  const appr = await erc20.approve(market, ethers.MaxUint256);
  await appr.wait();
  console.log('USDT approved');

  const mintTx = await clob.mintCompleteSet(5);
  await mintTx.wait();
  console.log('Minted complete set 5');

  const approved = await erc1155.isApprovedForAll(w.address, market);
  if (!approved) {
    const tx = await erc1155.setApprovalForAll(market, true);
    await tx.wait();
    console.log('Approved 1155 for market');
  }

  const chain = await provider.getNetwork();
  const domain = { name: 'CLOBMarket', version: '1', chainId: Number(chain.chainId), verifyingContract: market };
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
    maker: w.address,
    outcomeIndex: 0,
    isBuy: true,
    price: 1000000,
    amount: 2,
    expiry: Math.floor(Date.now() / 1000) + 86400,
    salt: Math.floor(Math.random() * 1e9)
  };
  const sig = await w.signTypedData(domain, types, req);
  const fillTx = await clob.fillOrderSigned(req, sig, 1);
  const rc = await fillTx.wait();
  console.log('Filled signed order fillAmount=1 at price 1 USDT, tx:', rc.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
