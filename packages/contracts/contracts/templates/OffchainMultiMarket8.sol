// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./OffchainMarketBase.sol";
import "../MarketFactory.sol";

/**
 * @notice Off-chain settlement market for multi outcomes (2..8).
 *
 * initialize data encoding:
 * - abi.encode(address outcome1155, uint8 outcomeCount)
 */
contract OffchainMultiMarket8 is OffchainMarketBase {
    function initialize(
        bytes32 _marketId,
        address _factory,
        address _creator,
        address _collateralToken,
        address _oracle,
        uint256 feeBps,
        uint256 _resolutionTime,
        bytes calldata data
    ) external override initializer {
        (address outcome1155, uint8 oc) = abi.decode(data, (address, uint8));
        _initCommon(_marketId, _factory, _creator, _collateralToken, _oracle, _resolutionTime, outcome1155, oc);

        address feeRecipient = MarketFactory(_factory).feeTo();
        _setFeeConfig(feeBps, feeRecipient);
    }
}

