export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
] as const;

export const lpFeeStakingAbi = [
  "function stakingToken() view returns (address)",
  "function rewardToken() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address user) view returns (uint256)",
  "function earned(address user) view returns (uint256)",
  "function stake(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getReward() external",
  "function exit() external",
] as const;

export const marketAbi = [
  "function mintCompleteSet(uint256 amount18) external",
  "function redeem(uint256 amount18) external",
  "function redeemCompleteSetOnInvalid(uint256 amount18PerOutcome) external",
  "function state() view returns (uint8)",
  "function outcomeToken() view returns (address)",
  "function fillOrderSigned(tuple(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 salt,uint256 expiry) order, bytes signature, uint256 fillAmount) external",
  "function batchFill(tuple(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 salt,uint256 expiry)[] orders, bytes[] signatures, uint256[] fillAmounts) external",
] as const;

export const erc1155Abi = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
] as const;
