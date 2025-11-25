// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IMarket {
    enum Stages {
        TRADING,
        RESOLVED
    }

    /// @notice Initialize the market instance cloned by the factory
    /// @param factory The factory address that created this market
    /// @param creator The EOA or contract that requested market creation
    /// @param collateralToken ERC20 used as collateral for trading/redemptions
    /// @param oracle Address responsible for resolving the final outcome
    /// @param feeBps Fee in basis points charged by the market (e.g., 30 = 0.30%)
    /// @param resolutionTime Unix timestamp after which the market can be finalized
    /// @param data Template-specific encoded params (e.g., outcome set, AMM config)
    function initialize(
        bytes32 marketId,
        address factory,
        address creator,
        address collateralToken,
        address oracle,
        uint256 feeBps,
        uint256 resolutionTime,
        bytes calldata data
    ) external;
}