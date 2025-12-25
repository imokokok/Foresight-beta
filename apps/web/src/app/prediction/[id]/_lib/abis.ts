export const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
] as const;

export const marketAbi = [
  "function mintCompleteSet(uint256 amount) external",
  "function depositCompleteSet(uint256 amount) external",
  "function outcomeToken() view returns (address)",
  "function fillOrderSigned(tuple(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 expiry,uint256 salt) req, bytes signature, uint256 fillAmount) external",
] as const;

export const erc1155Abi = [
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
] as const;
