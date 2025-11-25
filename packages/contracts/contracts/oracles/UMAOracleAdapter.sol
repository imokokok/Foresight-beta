// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOracle.sol";

/**
 * @title IUmaOptimisticOracleV3
 * @dev Interface for UMA's Optimistic Oracle V3.
 * This is a simplified interface based on public documentation.
 * It may need to be expanded with more functions and events as needed.
 */
interface IUmaOptimisticOracleV3 {
    struct Assertion {
        bool arbitrateViaEscalationManager;
        bool disregardProposals;
        bool asserted;
        address assertionCreator;
        uint64 resolutionTime;
        address settlementRecipient;
        bytes assertionId;
        bytes32 domainId;
        bytes claim;
        address currency;
        uint256 bond;
        address identifier;
        uint64 expirationTime;
    }

    function assertTruth(
        bytes calldata claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        bool arbitrateViaEscalationManager,
        bool disregardProposals,
        address currency,
        uint256 bond,
        bytes32 identifier
    ) external returns (bytes32);

    function getAssertion(bytes32 assertionId) external view returns (Assertion memory);

    function settle(bytes32 assertionId) external;
}

/**
 * @title UMAOracleAdapter
 * @dev An adapter contract to integrate with UMA's Optimistic Oracle V3.
 * This contract implements the IOracle interface, allowing market contracts
 * to resolve outcomes based on UMA's decentralized oracle.
 */
contract UMAOracleAdapter is IOracle {
    address public immutable reporter;
    IUmaOptimisticOracleV3 public immutable umaOracle;

    // Mapping from a market identifier (e.g., market address) to a UMA assertion ID
    mapping(bytes32 => bytes32) public marketAssertions;

    // Event to log the creation of a new outcome request
    event OutcomeRequest(bytes32 indexed marketId, bytes32 assertionId, bytes claim);

    constructor(address _umaOracle) {
        reporter = msg.sender;
        umaOracle = IUmaOptimisticOracleV3(_umaOracle);
    }

    /**
     * @dev Requests an outcome resolution from the UMA Oracle.
     * This would typically be called by a trusted admin or the market factory upon market creation.
     * @param _marketId A unique identifier for the market.
     * @param _claim The question to be resolved by the oracle (e.g., "Will team A win the match?").
     */
    function requestOutcome(bytes32 _marketId, bytes memory _claim) external {
        // For now, only the initial reporter can request outcomes.
        // This could be expanded to a multi-sig or DAO.
        require(msg.sender == reporter, "Only reporter can request");

        // For this PoC, we'll use default values for bond, currency, etc.
        // In a production system, these would be configurable.
        bytes32 assertionId = umaOracle.assertTruth(
            _claim,
            address(this), // The asserter is this contract
            address(this), // The callback recipient is this contract
            address(0),    // Default escalation manager
            false,
            false,
            address(0),    // No bond currency (can be ETH or ERC20)
            0,             // No bond required for this simple request
            bytes32(0)     // Default identifier
        );

        marketAssertions[_marketId] = assertionId;
        emit OutcomeRequest(_marketId, assertionId, _claim);
    }

    /**
     * @dev Gets the final outcome for a market.
     * This function is called by the market contract (e.g., BinaryMarket) after the market's closing time.
     * It checks the state of the corresponding UMA assertion.
     * @param _marketId The unique identifier for the market.
     * @return The resolved outcome. 0 for No, 1 for Yes, 2 for Unknown/Invalid.
     */
    function getOutcome(bytes32 _marketId) external view override returns (uint256) {
        bytes32 assertionId = marketAssertions[_marketId];
        require(assertionId != bytes32(0), "Outcome not requested");

        IUmaOptimisticOracleV3.Assertion memory assertion = umaOracle.getAssertion(assertionId);

        // Check if the assertion has been settled
        if (assertion.asserted) {
            // In a real scenario, you would decode the `claim` to determine the outcome.
            // For this example, we'll assume a simple "1" for Yes and "0" for No.
            if (keccak256(assertion.claim) == keccak256(bytes("1"))) {
                return 1; // Yes
            } else if (keccak256(assertion.claim) == keccak256(bytes("0"))) {
                return 0; // No
            }
        }

        // If the assertion is not yet settled, or the claim is invalid, return Unknown.
        return 2;
    }

    /**
     * @dev Settles an assertion. This can be called by anyone after the liveness period has passed
     * and no dispute has been raised.
     * @param _marketId The market to settle the outcome for.
     */
    function settleOutcome(bytes32 _marketId) external {
        bytes32 assertionId = marketAssertions[_marketId];
        require(assertionId != bytes32(0), "Outcome not requested");
        
        umaOracle.settle(assertionId);
    }
}