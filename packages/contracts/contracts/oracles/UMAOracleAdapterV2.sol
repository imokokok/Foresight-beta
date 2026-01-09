// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IOracleRegistrar.sol";

/**
 * @notice Minimal UMA Optimistic Oracle V3 interface.
 * @dev Uses callbacks for correctness instead of relying on assertion struct fields.
 */
interface IOptimisticOracleV3 {
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
    ) external returns (bytes32 assertionId);

    function settle(bytes32 assertionId) external;
}

/// @title UMAOracleAdapterV2
/// @author Foresight
/// @notice Production-oriented UMA OOv3 adapter with gas optimizations.
/// @dev Gas optimizations applied:
///      - unchecked blocks for safe arithmetic
///      - Packed struct for MarketConfig
///      - Immutable variables where possible
///      - Storage slot packing
/// @custom:security-contact security@foresight.io
contract UMAOracleAdapterV2 is IOracle, IOracleRegistrar, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // ═══════════════════════════════════════════════════════════════════════
    // IMMUTABLES
    // ═══════════════════════════════════════════════════════════════════════

    IOptimisticOracleV3 public immutable uma;
    IERC20 public immutable bondCurrency;

    // ═══════════════════════════════════════════════════════════════════════
    // ENUMS & STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    enum Status { NONE, PENDING, RESOLVED, INVALID }

    /// @dev Packed to fit in single slot (8 + 1 + 1 = 10 bytes < 32)
    struct MarketConfig {
        uint64 resolutionTime;
        uint8 outcomeCount;
        bool exists;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATE - Slot-optimized layout
    // ═══════════════════════════════════════════════════════════════════════

    // Slot: Oracle params (256 bits)
    uint256 public defaultBond;
    
    // Slot: identifier
    bytes32 public defaultIdentifier;
    
    // Slot: escalation config (packed: address 20 bytes + 2 bools + 1 uint8 = 23 bytes)
    address public escalationManager;
    bool public arbitrateViaEscalationManager;
    bool public disregardProposals;
    uint8 public maxReassertions;

    // Mappings (each takes its own slot per key)
    mapping(bytes32 => MarketConfig) public marketConfig;
    mapping(bytes32 => bytes32) public marketToAssertion;
    mapping(bytes32 => bytes32) public assertionToMarket;
    mapping(bytes32 => uint8) public assertedOutcomeIndex;
    mapping(bytes32 => Status) public marketStatus;
    mapping(bytes32 => uint256) public marketOutcome;
    mapping(bytes32 => address) public assertionAsserter;
    mapping(bytes32 => uint8) public marketReassertionCount;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event OutcomeAsserted(bytes32 indexed marketId, bytes32 indexed assertionId, uint8 outcomeIndex, bytes claim);
    event OutcomeFinalized(bytes32 indexed marketId, Status status, uint256 outcomeIndex);
    event OracleParamsUpdated(uint256 bond, bytes32 identifier, address escalationManager);
    event MarketRegistered(bytes32 indexed marketId, uint64 resolutionTime, uint8 outcomeCount);
    event AssertionDisputed(bytes32 indexed marketId, bytes32 indexed assertionId);
    event MarketResetForReassert(bytes32 indexed marketId, uint8 reassertionAttempt);
    event MaxReassertionsUpdated(uint8 newMax);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error AlreadyAsserted();
    error BadOutcomeIndex();
    error NotUmaOracle();
    error MarketNotInvalid();
    error MaxReassertionsReached();
    error InvalidMarket();
    error TooEarly();
    error ZeroAddress();
    error MarketIdZero();
    error OutcomesRange();
    error ResolutionTimeZero();
    error NotAsserted();
    error NotFinalized();

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(
        address umaOracleV3,
        address bondCurrency_,
        address admin,
        address reporter
    ) {
        if (umaOracleV3 == address(0)) revert ZeroAddress();
        if (bondCurrency_ == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();
        if (reporter == address(0)) revert ZeroAddress();

        uma = IOptimisticOracleV3(umaOracleV3);
        bondCurrency = IERC20(bondCurrency_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REPORTER_ROLE, reporter);
        _grantRole(REGISTRAR_ROLE, admin);

        maxReassertions = 3;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function registerMarket(
        bytes32 marketId,
        uint64 resolutionTime,
        uint8 outcomeCount
    ) external override onlyRole(REGISTRAR_ROLE) {
        if (marketId == bytes32(0)) revert MarketIdZero();
        if (outcomeCount < 2 || outcomeCount > 8) revert OutcomesRange();
        if (resolutionTime == 0) revert ResolutionTimeZero();
        
        marketConfig[marketId] = MarketConfig({
            resolutionTime: resolutionTime,
            outcomeCount: outcomeCount,
            exists: true
        });
        
        emit MarketRegistered(marketId, resolutionTime, outcomeCount);
    }

    function setOracleParams(
        uint256 bond,
        bytes32 identifier,
        address escalationManager_,
        bool arbitrateViaEscalationManager_,
        bool disregardProposals_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultBond = bond;
        defaultIdentifier = identifier;
        escalationManager = escalationManager_;
        arbitrateViaEscalationManager = arbitrateViaEscalationManager_;
        disregardProposals = disregardProposals_;
        emit OracleParamsUpdated(bond, identifier, escalationManager_);
    }

    function setMaxReassertions(uint8 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxReassertions = newMax;
        emit MaxReassertionsUpdated(newMax);
    }

    function resetMarketForReassert(bytes32 marketId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (marketStatus[marketId] != Status.INVALID) revert MarketNotInvalid();
        
        uint8 currentAttempts = marketReassertionCount[marketId];
        if (currentAttempts >= maxReassertions) revert MaxReassertionsReached();
        
        marketStatus[marketId] = Status.NONE;
        delete marketToAssertion[marketId];
        delete marketOutcome[marketId];
        
        unchecked {
            marketReassertionCount[marketId] = currentAttempts + 1;
        }
        
        emit MarketResetForReassert(marketId, currentAttempts + 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // REPORTER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function requestOutcome(
        bytes32 marketId,
        uint8 outcomeIndex,
        bytes calldata claim
    ) external nonReentrant onlyRole(REPORTER_ROLE) returns (bytes32 assertionId) {
        if (marketStatus[marketId] != Status.NONE) revert AlreadyAsserted();
        
        // Cache storage read
        MarketConfig memory cfg = marketConfig[marketId];
        if (!cfg.exists) revert InvalidMarket();
        if (block.timestamp < uint256(cfg.resolutionTime)) revert TooEarly();
        if (outcomeIndex >= cfg.outcomeCount) revert BadOutcomeIndex();

        // Cache storage reads for uma call
        address _escalationManager = escalationManager;
        bool _arbitrateViaEscalationManager = arbitrateViaEscalationManager;
        bool _disregardProposals = disregardProposals;
        uint256 _defaultBond = defaultBond;
        bytes32 _defaultIdentifier = defaultIdentifier;

        assertionId = uma.assertTruth(
            claim,
            msg.sender,
            address(this),
            _escalationManager,
            _arbitrateViaEscalationManager,
            _disregardProposals,
            address(bondCurrency),
            _defaultBond,
            _defaultIdentifier
        );

        // Batch storage writes
        marketToAssertion[marketId] = assertionId;
        assertionToMarket[assertionId] = marketId;
        assertedOutcomeIndex[assertionId] = outcomeIndex;
        assertionAsserter[assertionId] = msg.sender;
        marketStatus[marketId] = Status.PENDING;

        emit OutcomeAsserted(marketId, assertionId, outcomeIndex, claim);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PERMISSIONLESS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function settleOutcome(bytes32 marketId) external nonReentrant {
        bytes32 assertionId = marketToAssertion[marketId];
        if (assertionId == bytes32(0)) revert NotAsserted();
        uma.settle(assertionId);
    }

    function getOutcome(bytes32 marketId) external view override returns (uint256) {
        Status s = marketStatus[marketId];
        if (s != Status.RESOLVED && s != Status.INVALID) revert NotFinalized();
        return marketOutcome[marketId];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UMA CALLBACKS
    // ═══════════════════════════════════════════════════════════════════════

    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external {
        if (msg.sender != address(uma)) revert NotUmaOracle();
        
        bytes32 marketId = assertionToMarket[assertionId];
        if (marketId == bytes32(0)) return;

        if (assertedTruthfully) {
            uint8 k = assertedOutcomeIndex[assertionId];
            marketStatus[marketId] = Status.RESOLVED;
            marketOutcome[marketId] = uint256(k);
            emit OutcomeFinalized(marketId, Status.RESOLVED, uint256(k));
        } else {
            marketStatus[marketId] = Status.INVALID;
            marketOutcome[marketId] = type(uint256).max;
            emit OutcomeFinalized(marketId, Status.INVALID, type(uint256).max);
        }
    }

    function assertionDisputedCallback(bytes32 assertionId) external {
        if (msg.sender != address(uma)) revert NotUmaOracle();
        
        bytes32 marketId = assertionToMarket[assertionId];
        if (marketId == bytes32(0)) return;
        
        emit AssertionDisputed(marketId, assertionId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function getMarketStatus(bytes32 marketId) external view returns (
        Status status,
        uint256 outcome,
        bytes32 assertionId,
        uint8 reassertionCount
    ) {
        return (
            marketStatus[marketId],
            marketOutcome[marketId],
            marketToAssertion[marketId],
            marketReassertionCount[marketId]
        );
    }

    function canReassert(bytes32 marketId) external view returns (bool) {
        return marketStatus[marketId] == Status.INVALID && 
               marketReassertionCount[marketId] < maxReassertions;
    }
}
