// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./OffchainMarketBase.sol";
import "../MarketFactory.sol";

/**
 * @notice Off-chain settlement market for binary outcomes (YES/NO).
 * outcomeCount is fixed to 2.
 *
 * initialize data encoding:
 * - abi.encode(address outcome1155)
 */
contract OffchainBinaryMarket is OffchainMarketBase {
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
        address outcome1155 = abi.decode(data, (address));
        _initCommon(_marketId, _factory, _creator, _collateralToken, _oracle, _resolutionTime, outcome1155, 2);

        address feeRecipient = MarketFactory(_factory).feeTo();
        _setFeeConfig(feeBps, feeRecipient);
    }
}

