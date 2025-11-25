// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @title IOracle Interface
/// @notice Interface for oracle contracts that can resolve markets.
interface IOracle {
    /// @notice Returns the outcome of the market.
    /// @dev Should revert if the outcome is not yet available.
    /// @return The outcome of the market. -1 for invalid/undecided, 0 for NO, 1 for YES.
    function getOutcome(bytes32 marketId) external view returns (uint256);
}