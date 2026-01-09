// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPFeeStaking is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public accountedRewardBalance;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event Recovered(address indexed token, address indexed to, uint256 amount);

    constructor(address admin, IERC20 _stakingToken, IERC20 _rewardToken) {
        _grantRole(ADMIN_ROLE, admin);
        stakingToken = _stakingToken;
        rewardToken = _rewardToken;
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) return;
        _updateReward(msg.sender);
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant {
        if (amount == 0) return;
        _updateReward(msg.sender);
        uint256 bal = balanceOf[msg.sender];
        if (amount > bal) amount = bal;
        totalSupply -= amount;
        balanceOf[msg.sender] = bal - amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = rewards[msg.sender];
        if (reward == 0) return;
        rewards[msg.sender] = 0;
        accountedRewardBalance -= reward;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    function exit() external {
        withdraw(balanceOf[msg.sender]);
        getReward();
    }

    function sync() external nonReentrant {
        _syncRewards();
    }

    function earned(address account) external view returns (uint256) {
        uint256 rpt = _previewRewardPerToken();
        uint256 pending = rewards[account];
        uint256 paid = userRewardPerTokenPaid[account];
        uint256 bal = balanceOf[account];
        return pending + Math.mulDiv(bal, rpt - paid, 1e18);
    }

    function recoverERC20(IERC20 token, address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (address(token) == address(stakingToken) || address(token) == address(rewardToken)) revert();
        token.safeTransfer(to, amount);
        emit Recovered(address(token), to, amount);
    }

    function _updateReward(address account) internal {
        _syncRewards();
        uint256 rpt = rewardPerTokenStored;
        uint256 paid = userRewardPerTokenPaid[account];
        if (rpt != paid) {
            uint256 bal = balanceOf[account];
            uint256 pending = rewards[account];
            rewards[account] = pending + Math.mulDiv(bal, rpt - paid, 1e18);
            userRewardPerTokenPaid[account] = rpt;
        }
    }

    function _previewRewardPerToken() internal view returns (uint256) {
        uint256 supply = totalSupply;
        if (supply == 0) return rewardPerTokenStored;
        uint256 current = rewardToken.balanceOf(address(this));
        uint256 base = accountedRewardBalance;
        if (current <= base) return rewardPerTokenStored;
        uint256 diff = current - base;
        uint256 increment = Math.mulDiv(diff, 1e18, supply);
        return rewardPerTokenStored + increment;
    }

    function _syncRewards() internal {
        uint256 supply = totalSupply;
        uint256 current = rewardToken.balanceOf(address(this));
        uint256 base = accountedRewardBalance;

        if (current <= base) {
            accountedRewardBalance = current;
            return;
        }

        if (supply == 0) return;

        uint256 diff = current - base;
        uint256 increment = Math.mulDiv(diff, 1e18, supply);
        if (increment == 0) return;

        rewardPerTokenStored += increment;
        uint256 distributed = Math.mulDiv(increment, supply, 1e18);
        accountedRewardBalance = base + distributed;
    }
}
