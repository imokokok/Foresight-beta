// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IOracle.sol";

/// @title ManualOracle
/// @notice A simple oracle where a designated reporter can manually set the outcome.
contract ManualOracle is IOracle, AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    uint256 private _outcome;
    bool private _isSet;

    event OutcomeSet(uint256 outcome);

    error OutcomeAlreadySet();
    error OutcomeNotSet();

    constructor(address reporter) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REPORTER_ROLE, reporter);
        _outcome = 0; // Not set
    }

    /// @notice Sets the outcome of the market.
    /// @param outcome The outcome to set.
    function setOutcome(uint256 outcome) external onlyRole(REPORTER_ROLE) {
        if (_isSet) revert OutcomeAlreadySet();
        _outcome = outcome;
        _isSet = true;
        emit OutcomeSet(outcome);
    }

    /// @notice Returns the outcome of the market.
    /// @return The outcome of the market.
    function getOutcome(bytes32) external view override returns (uint256) {
        if (!_isSet) revert OutcomeNotSet();
        return _outcome;
    }
}
