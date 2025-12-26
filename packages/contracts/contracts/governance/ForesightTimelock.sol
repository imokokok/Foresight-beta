// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title ForesightTimelock
/// @author Foresight
/// @notice Timelock controller for critical governance operations.
/// @dev Wraps OpenZeppelin's TimelockController with Foresight-specific defaults.
///      Critical operations (like changing oracle params, pausing markets) require
///      a delay before execution, giving the community time to react.
///
///      Polymarket-style usage:
///      - Gnosis Safe proposes a transaction
///      - Transaction enters timelock queue (e.g., 24h delay)
///      - After delay, anyone can execute the transaction
///      - During delay, community can verify and raise concerns
///
/// @custom:security-contact security@foresight.io
contract ForesightTimelock is TimelockController {
    /// @notice Creates a new Timelock with the specified delay and roles.
    /// @param minDelay Minimum delay in seconds before execution (e.g., 86400 for 24h).
    /// @param proposers Addresses allowed to propose transactions (typically Gnosis Safe).
    /// @param executors Addresses allowed to execute transactions (can be address(0) for anyone).
    /// @param admin Optional admin address for emergency role management (can be address(0) to renounce).
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}

