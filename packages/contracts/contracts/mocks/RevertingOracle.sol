// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../interfaces/IOracle.sol";

contract RevertingOracle is IOracle {
    function getOutcome(bytes32) external pure returns (uint256) {
        revert();
    }
}
