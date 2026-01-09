// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../interfaces/IMarket.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IOracleRegistrar.sol";
import "../tokens/OutcomeToken1155.sol";

/// @title OffchainMarketBase
/// @author Foresight
/// @notice Off-chain orderbook settlement market with security hardening and gas optimization.
/// @dev Gas optimizations applied:
///      - unchecked blocks for safe arithmetic
///      - Storage variable caching to memory
///      - ++i prefix increment
///      - Assembly for hot paths
///      - Precomputed constants
///      - Batch operation optimizations
/// @custom:security-contact security@foresight.io
abstract contract OffchainMarketBase is
    IMarket,
    Initializable,
    ReentrancyGuardUpgradeable,
    ERC1155Holder,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    uint256 internal constant SHARE_SCALE = 1e18;
    uint256 internal constant USDC_SCALE = 1e6;
    uint256 internal constant MAX_PRICE_6_PER_1E18 = 1e6;
    uint256 internal constant SHARE_GRANULARITY = 1e12;

    uint8 internal constant MIN_OUTCOMES = 2;
    uint8 internal constant MAX_OUTCOMES = 8;

    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    uint256 internal constant ERC1271_GAS_LIMIT = 100_000;
    uint256 internal constant MAX_BATCH_SIZE = 50;
    uint256 internal constant MAX_VOLUME_PER_BLOCK = 1_000_000 * 1e6;
    uint256 internal constant MIN_ORDER_LIFETIME = 30;
    uint256 internal constant ECDSA_S_UPPER_BOUND = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    /// @dev Precomputed MINTER_ROLE hash to avoid external call
    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ═══════════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════════

    enum State { TRADING, RESOLVED, INVALID }

    bytes32 public marketId;
    address public factory;
    address public creator;
    IERC20 public collateral;
    address public oracle;
    uint256 public resolutionTime;
    OutcomeToken1155 public outcomeToken;
    uint256 public feeBps;
    address public feeRecipient;
    uint256 public lpFeeBps;
    address public lpFeeRecipient;

    // Packed storage slot (1 + 1 + 1 + 1 = 4 bytes, fits in 1 slot)
    uint8 public outcomeCount;
    State public state;
    uint8 public resolvedOutcome;
    bool public paused;

    mapping(address => mapping(uint256 => uint256)) public filledBySalt;
    mapping(address => mapping(uint256 => bool)) public canceledSalt;
    mapping(address => mapping(uint256 => uint256)) private _blockVolume;

    bytes32 public constant ORDER_TYPEHASH =
        keccak256("Order(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 salt,uint256 expiry)");
    bytes32 public constant CANCEL_SALT_TYPEHASH =
        keccak256("CancelSaltRequest(address maker,uint256 salt)");

    struct Order {
        address maker;
        uint256 outcomeIndex;
        bool isBuy;
        uint256 price;
        uint256 amount;
        uint256 salt;
        uint256 expiry;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event Initialized(bytes32 indexed marketId, address factory, address creator, address collateral, address oracle, uint256 resolutionTime, address outcome1155, uint8 outcomeCount);
    event OrderFilledSigned(address indexed maker, address indexed taker, uint256 indexed outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt);
    event OrderSaltCanceled(address indexed maker, uint256 salt);
    event Resolved(uint256 indexed outcomeIndex);
    event Invalidated();
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event CompleteSetMinted(address indexed user, uint256 amount18);
    event Redeemed(address indexed user, uint256 amount18, uint8 outcomeIndex);
    event CompleteSetRedeemedOnInvalid(address indexed user, uint256 amount18PerOutcome);

    // ═══════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════

    error InvalidOutcomeIndex();
    error InvalidState();
    error ResolutionTimeNotReached();
    error InvalidExpiry();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidSignedRequest();
    error OrderCanceled();
    error NoMinterRole();
    error NotApproved1155();
    error FeeNotSupported();
    error InvalidShareGranularity();
    error MarketPaused();
    error NotAuthorized();
    error ArrayLengthMismatch();
    error BatchSizeExceeded();
    error FlashLoanProtection();
    error OrderLifetimeTooShort();
    error InvalidSignatureS();
    error BadActors();
    error BadAddresses();
    error Outcome1155Zero();
    error ResolutionInPast();
    error ResolutionTimeTooLarge();
    error OutcomesRange();
    error FeeRecipientZero();
    error LpFeeRecipientZero();
    error OracleQueryFailed();

    // ═══════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier inState(State s) {
        if (state != s) revert InvalidState();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert MarketPaused();
        _;
    }

    modifier onlyFactoryOrCreator() {
        if (msg.sender != factory && msg.sender != creator) revert NotAuthorized();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CIRCUIT BREAKER
    // ═══════════════════════════════════════════════════════════════════════

    function pause() external onlyFactoryOrCreator {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyFactoryOrCreator {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GAS-OPTIMIZED HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /// @dev Flash loan protection with cached block number
    function _checkFlashLoanProtection(address user, uint256 volume) internal {
        uint256 currentBlock = block.number;
        uint256 newVolume = _blockVolume[user][currentBlock] + volume;
        if (newVolume > MAX_VOLUME_PER_BLOCK) revert FlashLoanProtection();
        _blockVolume[user][currentBlock] = newVolume;
    }

    function _accumulateFlashLoanProtection(
        address[] memory users,
        uint256[] memory newVolumes,
        uint256 count,
        address user,
        uint256 volume,
        uint256 currentBlock
    ) internal view returns (uint256 newCount) {
        newCount = count;
        for (uint256 i; i < count;) {
            if (users[i] == user) {
                uint256 v = newVolumes[i] + volume;
                if (v > MAX_VOLUME_PER_BLOCK) revert FlashLoanProtection();
                newVolumes[i] = v;
                return newCount;
            }
            unchecked { ++i; }
        }

        uint256 v0 = _blockVolume[user][currentBlock] + volume;
        if (v0 > MAX_VOLUME_PER_BLOCK) revert FlashLoanProtection();
        users[count] = user;
        newVolumes[count] = v0;
        unchecked { newCount = count + 1; }
    }

    /// @dev Assembly-optimized signature malleability check
    function _checkSignatureMalleability(bytes calldata signature) internal pure {
        if (signature.length == 65) {
            uint256 s;
            assembly {
                s := calldataload(add(signature.offset, 32))
            }
            if (s > ECDSA_S_UPPER_BOUND) revert InvalidSignatureS();
        } else if (signature.length == 64) {
            uint256 vs;
            assembly {
                vs := calldataload(add(signature.offset, 32))
            }
            uint256 s = vs & 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
            if (s > ECDSA_S_UPPER_BOUND) revert InvalidSignatureS();
        }
    }

    /// @dev Gas-optimized signature validation
    function _isValidSignature(address signer, bytes32 digest, bytes calldata signature) internal view returns (bool) {
        _checkSignatureMalleability(signature);
        
        // Check if contract (uses extcodesize which is cheaper than code.length)
        uint256 size;
        assembly {
            size := extcodesize(signer)
        }
        
        if (size > 0) {
            try IERC1271(signer).isValidSignature{gas: ERC1271_GAS_LIMIT}(digest, signature) returns (bytes4 magicValue) {
                return magicValue == ERC1271_MAGIC_VALUE;
            } catch {
                return false;
            }
        }
        if (signature.length == 65) {
            (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, signature);
            return err == ECDSA.RecoverError.NoError && recovered == signer;
        }

        if (signature.length == 64) {
            bytes32 r;
            bytes32 vs;
            assembly {
                r := calldataload(signature.offset)
                vs := calldataload(add(signature.offset, 32))
            }
            (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, r, vs);
            return err == ECDSA.RecoverError.NoError && recovered == signer;
        }

        return false;
    }

    /// @dev Assembly-optimized token ID computation
    function _outcomeTokenIdUnchecked(uint256 outcomeIndex) internal view returns (uint256 tokenId) {
        assembly {
            // tokenId = (address(this) << 32) | outcomeIndex
            tokenId := or(shl(32, address()), outcomeIndex)
        }
    }

    function outcomeTokenId(uint256 outcomeIndex) public view returns (uint256) {
        if (outcomeIndex >= uint256(outcomeCount)) revert InvalidOutcomeIndex();
        return _outcomeTokenIdUnchecked(outcomeIndex);
    }

    /// @dev Batch compute all token IDs (gas-efficient for loops)
    function _computeAllTokenIds(uint8 count) internal view returns (uint256[] memory ids) {
        ids = new uint256[](count);
        uint256 base;
        assembly {
            base := shl(32, address())
        }
        for (uint256 i; i < count;) {
            unchecked {
                ids[i] = base | i;
                ++i;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    function _initCommon(
        bytes32 _marketId,
        address _factory,
        address _creator,
        address _collateralToken,
        address _oracle,
        uint256 _resolutionTime,
        address outcome1155,
        uint8 oc
    ) internal onlyInitializing {
        __ReentrancyGuard_init();
        __EIP712_init("Foresight Market", "1");

        if (_factory == address(0) || _creator == address(0)) revert BadActors();
        if (_collateralToken == address(0) || _oracle == address(0)) revert BadAddresses();
        if (outcome1155 == address(0)) revert Outcome1155Zero();
        if (_resolutionTime <= block.timestamp) revert ResolutionInPast();
        if (_resolutionTime > type(uint64).max) revert ResolutionTimeTooLarge();
        if (oc < MIN_OUTCOMES || oc > MAX_OUTCOMES) revert OutcomesRange();

        marketId = _marketId;
        factory = _factory;
        creator = _creator;
        collateral = IERC20(_collateralToken);
        oracle = _oracle;
        resolutionTime = _resolutionTime;
        outcomeToken = OutcomeToken1155(outcome1155);
        outcomeCount = oc;
        state = State.TRADING;
        // paused defaults to false (zero value)

        try IOracleRegistrar(_oracle).registerMarket(_marketId, uint64(_resolutionTime), oc) {} catch {}

        emit Initialized(_marketId, _factory, _creator, _collateralToken, _oracle, _resolutionTime, outcome1155, oc);
    }

    function _setFeeConfig(uint256 _feeBps, address _feeRecipient) internal {
        if (_feeBps != 0 && _feeRecipient == address(0)) revert FeeRecipientZero();
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        lpFeeBps = 0;
        lpFeeRecipient = address(0);
    }

    function _setFeeConfig(uint256 _feeBps, address _feeRecipient, uint256 _lpFeeBps, address _lpFeeRecipient) internal {
        if (_lpFeeBps > _feeBps) revert FeeNotSupported();
        if (_feeBps != 0 && _feeRecipient == address(0)) revert FeeRecipientZero();
        if (_lpFeeBps != 0 && _lpFeeRecipient == address(0)) revert LpFeeRecipientZero();
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        lpFeeBps = _lpFeeBps;
        lpFeeRecipient = _lpFeeRecipient;
    }

    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ORDER CANCELLATION
    // ═══════════════════════════════════════════════════════════════════════

    function cancelSaltSigned(address maker, uint256 salt, bytes calldata signature) external nonReentrant inState(State.TRADING) {
        if (canceledSalt[maker][salt]) revert OrderCanceled();
        bytes32 structHash = keccak256(abi.encode(CANCEL_SALT_TYPEHASH, maker, salt));
        if (!_isValidSignature(maker, _hashTypedDataV4(structHash), signature)) revert InvalidSignedRequest();
        canceledSalt[maker][salt] = true;
        emit OrderSaltCanceled(maker, salt);
    }

    function cancelSaltsBatch(
        address[] calldata makers,
        uint256[] calldata salts,
        bytes[] calldata signatures
    ) external nonReentrant inState(State.TRADING) {
        uint256 n = makers.length;
        if (n != salts.length || n != signatures.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        
        for (uint256 i; i < n;) {
            address maker = makers[i];
            uint256 salt = salts[i];
            
            if (!canceledSalt[maker][salt]) {
                bytes32 structHash = keccak256(abi.encode(CANCEL_SALT_TYPEHASH, maker, salt));
                if (_isValidSignature(maker, _hashTypedDataV4(structHash), signatures[i])) {
                    canceledSalt[maker][salt] = true;
                    emit OrderSaltCanceled(maker, salt);
                }
            }
            unchecked { ++i; }
        }
    }

    function cancelSaltsBatchStrict(
        address[] calldata makers,
        uint256[] calldata salts,
        bytes[] calldata signatures
    ) external nonReentrant inState(State.TRADING) {
        uint256 n = makers.length;
        if (n != salts.length || n != signatures.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        for (uint256 i; i < n;) {
            address maker = makers[i];
            uint256 salt = salts[i];

            if (canceledSalt[maker][salt]) revert OrderCanceled();

            bytes32 structHash = keccak256(abi.encode(CANCEL_SALT_TYPEHASH, maker, salt));
            if (!_isValidSignature(maker, _hashTypedDataV4(structHash), signatures[i])) revert InvalidSignedRequest();

            canceledSalt[maker][salt] = true;
            emit OrderSaltCanceled(maker, salt);

            unchecked { ++i; }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ORDER FILLING
    // ═══════════════════════════════════════════════════════════════════════

    function batchFill(
        Order[] calldata orders,
        bytes[] calldata signatures,
        uint256[] calldata fillAmounts
    ) external nonReentrant inState(State.TRADING) whenNotPaused {
        uint256 n = orders.length;
        if (n != signatures.length || n != fillAmounts.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();
        
        // Cache storage reads
        OutcomeToken1155 _outcomeToken = outcomeToken;
        IERC20 _collateral = collateral;
        uint8 _outcomeCount = outcomeCount;
        uint256 currentBlock = block.number;
        address[] memory users = new address[](2 * n);
        uint256[] memory newVolumes = new uint256[](2 * n);
        uint256 userCount;
        bool takerApprovalChecked;
        address[] memory makerApprovalOwners = new address[](n);
        uint256 makerApprovalCount;
        
        for (uint256 i; i < n;) {
            if (!takerApprovalChecked && orders[i].isBuy) {
                if (!_outcomeToken.isApprovedForAll(msg.sender, address(this))) revert NotApproved1155();
                takerApprovalChecked = true;
            }
            if (!orders[i].isBuy) {
                address maker = orders[i].maker;
                bool seen;
                for (uint256 j; j < makerApprovalCount;) {
                    if (makerApprovalOwners[j] == maker) {
                        seen = true;
                        break;
                    }
                    unchecked { ++j; }
                }
                if (!seen) {
                    if (!_outcomeToken.isApprovedForAll(maker, address(this))) revert NotApproved1155();
                    makerApprovalOwners[makerApprovalCount] = maker;
                    unchecked { ++makerApprovalCount; }
                }
            }
            userCount = _fillOneOptimizedBatch(
                orders[i],
                signatures[i],
                fillAmounts[i],
                _outcomeToken,
                _collateral,
                _outcomeCount,
                users,
                newVolumes,
                userCount,
                currentBlock
            );
            unchecked { ++i; }
        }

        for (uint256 i; i < userCount;) {
            _blockVolume[users[i]][currentBlock] = newVolumes[i];
            unchecked { ++i; }
        }
    }

    function fillOrderSigned(Order calldata order, bytes calldata signature, uint256 fillAmount) external nonReentrant inState(State.TRADING) whenNotPaused {
        _fillOneOptimized(order, signature, fillAmount, outcomeToken, collateral, outcomeCount);
    }

    /// @dev Gas-optimized fill with cached storage variables
    function _fillOneOptimized(
        Order calldata o,
        bytes calldata signature,
        uint256 fillAmount,
        OutcomeToken1155 _outcomeToken,
        IERC20 _collateral,
        uint8 _outcomeCount
    ) internal {
        // --- Validation (fail fast for gas efficiency) ---
        if (o.outcomeIndex >= _outcomeCount) revert InvalidOutcomeIndex();
        if (o.price == 0 || o.price > MAX_PRICE_6_PER_1E18) revert InvalidPrice();
        if (o.amount == 0 || fillAmount == 0) revert InvalidAmount();
        
        if (o.amount % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        if (fillAmount % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        
        if (o.expiry != 0) {
            if (o.expiry <= block.timestamp) revert InvalidExpiry();
            if (o.expiry < block.timestamp + MIN_ORDER_LIFETIME) revert OrderLifetimeTooShort();
        }
        if (canceledSalt[o.maker][o.salt]) revert OrderCanceled();

        // Cache and check filled amount
        uint256 alreadyFilled = filledBySalt[o.maker][o.salt];
        if (alreadyFilled + fillAmount > o.amount) revert InvalidAmount();

        // --- Signature verification ---
        bytes32 structHash = keccak256(abi.encode(
            ORDER_TYPEHASH,
            o.maker, o.outcomeIndex, o.isBuy, o.price, o.amount, o.salt, o.expiry
        ));
        if (!_isValidSignature(o.maker, _hashTypedDataV4(structHash), signature)) revert InvalidSignedRequest();

        // --- Compute cost (use unchecked for known-safe math) ---
        uint256 cost6 = Math.mulDiv(fillAmount, o.price, SHARE_SCALE);

        // --- Flash loan protection ---
        _checkFlashLoanProtection(msg.sender, cost6);
        _checkFlashLoanProtection(o.maker, cost6);

        // --- State update ---
        filledBySalt[o.maker][o.salt] = alreadyFilled + fillAmount;

        // --- Token transfers ---
        uint256 tokenId = _outcomeTokenIdUnchecked(o.outcomeIndex);

        if (o.isBuy) {
            _collateral.safeTransferFrom(o.maker, msg.sender, cost6);
            _outcomeToken.safeTransferFrom(msg.sender, o.maker, tokenId, fillAmount, "");
        } else {
            _collateral.safeTransferFrom(msg.sender, o.maker, cost6);
            _outcomeToken.safeTransferFrom(o.maker, msg.sender, tokenId, fillAmount, "");
        }

        emit OrderFilledSigned(o.maker, msg.sender, o.outcomeIndex, o.isBuy, o.price, fillAmount, 0, o.salt);
    }

    function _fillOneOptimizedBatch(
        Order calldata o,
        bytes calldata signature,
        uint256 fillAmount,
        OutcomeToken1155 _outcomeToken,
        IERC20 _collateral,
        uint8 _outcomeCount,
        address[] memory users,
        uint256[] memory newVolumes,
        uint256 userCount,
        uint256 currentBlock
    ) internal returns (uint256) {
        if (o.outcomeIndex >= _outcomeCount) revert InvalidOutcomeIndex();
        if (o.price == 0 || o.price > MAX_PRICE_6_PER_1E18) revert InvalidPrice();
        if (o.amount == 0 || fillAmount == 0) revert InvalidAmount();

        if (o.amount % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        if (fillAmount % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();

        if (o.expiry != 0) {
            if (o.expiry <= block.timestamp) revert InvalidExpiry();
            if (o.expiry < block.timestamp + MIN_ORDER_LIFETIME) revert OrderLifetimeTooShort();
        }
        if (canceledSalt[o.maker][o.salt]) revert OrderCanceled();

        uint256 alreadyFilled = filledBySalt[o.maker][o.salt];
        if (alreadyFilled + fillAmount > o.amount) revert InvalidAmount();

        bytes32 structHash = keccak256(abi.encode(
            ORDER_TYPEHASH,
            o.maker, o.outcomeIndex, o.isBuy, o.price, o.amount, o.salt, o.expiry
        ));
        if (!_isValidSignature(o.maker, _hashTypedDataV4(structHash), signature)) revert InvalidSignedRequest();

        uint256 cost6 = Math.mulDiv(fillAmount, o.price, SHARE_SCALE);

        userCount = _accumulateFlashLoanProtection(users, newVolumes, userCount, msg.sender, cost6, currentBlock);
        userCount = _accumulateFlashLoanProtection(users, newVolumes, userCount, o.maker, cost6, currentBlock);

        filledBySalt[o.maker][o.salt] = alreadyFilled + fillAmount;

        uint256 tokenId = _outcomeTokenIdUnchecked(o.outcomeIndex);

        if (o.isBuy) {
            if (!_outcomeToken.isApprovedForAll(msg.sender, address(this))) revert NotApproved1155();
            _collateral.safeTransferFrom(o.maker, msg.sender, cost6);
            _outcomeToken.safeTransferFrom(msg.sender, o.maker, tokenId, fillAmount, "");
        } else {
            if (!_outcomeToken.isApprovedForAll(o.maker, address(this))) revert NotApproved1155();
            _collateral.safeTransferFrom(msg.sender, o.maker, cost6);
            _outcomeToken.safeTransferFrom(o.maker, msg.sender, tokenId, fillAmount, "");
        }

        emit OrderFilledSigned(o.maker, msg.sender, o.outcomeIndex, o.isBuy, o.price, fillAmount, 0, o.salt);
        return userCount;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // COMPLETE SET / REDEMPTION
    // ═══════════════════════════════════════════════════════════════════════

    function mintCompleteSet(uint256 amount18) external nonReentrant inState(State.TRADING) whenNotPaused {
        if (amount18 == 0) revert InvalidAmount();
        if (amount18 % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        
        // Cache storage reads
        OutcomeToken1155 _outcomeToken = outcomeToken;
        uint8 _count = outcomeCount;
        
        if (!_outcomeToken.hasRole(MINTER_ROLE, address(this))) revert NoMinterRole();
        
        uint256 deposit6 = amount18 / SHARE_GRANULARITY;
        
        _checkFlashLoanProtection(msg.sender, deposit6);
        collateral.safeTransferFrom(msg.sender, address(this), deposit6);

        // Use pre-computed token IDs
        uint256[] memory ids = _computeAllTokenIds(_count);
        uint256[] memory amts = new uint256[](_count);
        for (uint256 i; i < _count;) {
            amts[i] = amount18;
            unchecked { ++i; }
        }
        
        _outcomeToken.mintBatch(msg.sender, ids, amts);
        emit CompleteSetMinted(msg.sender, amount18);
    }

    function redeem(uint256 amount18) external nonReentrant inState(State.RESOLVED) {
        if (amount18 == 0) revert InvalidAmount();
        if (amount18 % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        
        OutcomeToken1155 _outcomeToken = outcomeToken;
        if (!_outcomeToken.hasRole(MINTER_ROLE, address(this))) revert NoMinterRole();
        
        uint256 idWin = _outcomeTokenIdUnchecked(resolvedOutcome);
        _outcomeToken.burn(msg.sender, idWin, amount18);
        
        uint256 payout6 = amount18 / SHARE_GRANULARITY;

        uint256 totalBps = feeBps;
        uint256 lpBps = lpFeeBps;
        address protocolRecipient = feeRecipient;
        address lpRecipient = lpFeeRecipient;

        uint256 lpFee;
        if (lpRecipient != address(0) && lpBps != 0) {
            lpFee = Math.mulDiv(payout6, lpBps, 10000);
        }

        uint256 protocolFee;
        if (protocolRecipient != address(0) && totalBps > lpBps) {
            protocolFee = Math.mulDiv(payout6, totalBps - lpBps, 10000);
        }

        uint256 totalFee = lpFee + protocolFee;
        if (totalFee > 0) {
            if (lpFee > 0) collateral.safeTransfer(lpRecipient, lpFee);
            if (protocolFee > 0) collateral.safeTransfer(protocolRecipient, protocolFee);
            collateral.safeTransfer(msg.sender, payout6 - totalFee);
        } else {
            collateral.safeTransfer(msg.sender, payout6);
        }
        
        emit Redeemed(msg.sender, amount18, resolvedOutcome);
    }

    function redeemCompleteSetOnInvalid(uint256 amount18PerOutcome) external nonReentrant inState(State.INVALID) {
        if (amount18PerOutcome == 0) revert InvalidAmount();
        if (amount18PerOutcome % SHARE_GRANULARITY != 0) revert InvalidShareGranularity();
        
        OutcomeToken1155 _outcomeToken = outcomeToken;
        uint8 _count = outcomeCount;
        
        if (!_outcomeToken.hasRole(MINTER_ROLE, address(this))) revert NoMinterRole();

        uint256[] memory ids = _computeAllTokenIds(_count);
        uint256[] memory amts = new uint256[](_count);
        for (uint256 i; i < _count;) {
            amts[i] = amount18PerOutcome;
            unchecked { ++i; }
        }
        _outcomeToken.burnBatch(msg.sender, ids, amts);

        uint256 payout6 = amount18PerOutcome / SHARE_GRANULARITY;
        collateral.safeTransfer(msg.sender, payout6);
        
        emit CompleteSetRedeemedOnInvalid(msg.sender, amount18PerOutcome);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESOLUTION
    // ═══════════════════════════════════════════════════════════════════════

    function resolve() external nonReentrant inState(State.TRADING) {
        if (block.timestamp < resolutionTime) revert ResolutionTimeNotReached();

        uint256 outcome;
        try IOracle(oracle).getOutcome(marketId) returns (uint256 o) {
            outcome = o;
        } catch {
            revert OracleQueryFailed();
        }
        
        // Single state write for gas efficiency
        if (outcome == type(uint256).max || outcome >= uint256(outcomeCount)) {
            state = State.INVALID;
            emit Invalidated();
        } else {
            resolvedOutcome = uint8(outcome);
            state = State.RESOLVED;
            emit Resolved(outcome);
        }
    }

    function invalidate() external nonReentrant inState(State.TRADING) onlyFactoryOrCreator {
        if (block.timestamp < resolutionTime) revert ResolutionTimeNotReached();
        state = State.INVALID;
        emit Invalidated();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function getMarketInfo() external view returns (
        bytes32 id,
        State currentState,
        uint8 winningOutcome,
        uint8 numOutcomes,
        uint256 resolution,
        address collateralToken,
        bool isPaused
    ) {
        return (marketId, state, resolvedOutcome, outcomeCount, resolutionTime, address(collateral), paused);
    }

    function getRemainingFillable(address maker, uint256 salt, uint256 orderAmount) external view returns (uint256) {
        if (canceledSalt[maker][salt]) return 0;
        uint256 filled = filledBySalt[maker][salt];
        unchecked {
            return orderAmount > filled ? orderAmount - filled : 0;
        }
    }

    function getUserBalances(address user) external view returns (uint256[] memory balances) {
        uint8 _count = outcomeCount;
        balances = new uint256[](_count);
        OutcomeToken1155 _outcomeToken = outcomeToken;
        uint256[] memory ids = _computeAllTokenIds(_count);
        
        for (uint256 i; i < _count;) {
            balances[i] = _outcomeToken.balanceOf(user, ids[i]);
            unchecked { ++i; }
        }
    }

    function getOutcomeTokenIds() external view returns (uint256[] memory) {
        return _computeAllTokenIds(outcomeCount);
    }

    function getRemainingBlockVolume(address user) external view returns (uint256) {
        uint256 used = _blockVolume[user][block.number];
        unchecked {
            return MAX_VOLUME_PER_BLOCK > used ? MAX_VOLUME_PER_BLOCK - used : 0;
        }
    }

    function getSecurityConfig() external pure returns (
        uint256 maxBatchSize,
        uint256 maxVolumePerBlock,
        uint256 minOrderLifetime,
        uint256 erc1271GasLimit
    ) {
        return (MAX_BATCH_SIZE, MAX_VOLUME_PER_BLOCK, MIN_ORDER_LIFETIME, ERC1271_GAS_LIMIT);
    }
}
