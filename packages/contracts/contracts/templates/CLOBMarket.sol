// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../interfaces/IMarket.sol";
import "../interfaces/IOracle.sol";
import "../tokens/OutcomeToken1155.sol";

contract CLOBMarket is IMarket, ReentrancyGuard, Initializable, ERC1155Holder, EIP712Upgradeable {
    using SafeERC20 for IERC20;

    bytes32 public marketId;
    address public factory;
    address public creator;
    address public collateralToken;
    address public oracle;
    uint256 public feeBps;
    uint256 public resolutionTime;
    OutcomeToken1155 public outcomeToken;
    uint256 public outcomeCount;
    IMarket.Stages public stage;
    uint256 public resolvedOutcome;
    address public feeRecipient;
    uint256 public accruedFees;
    bool public paused;
    uint256 public tickSize;

    struct Order {
        uint256 id;
        address trader;
        uint256 outcomeIndex;
        bool isBuy;
        uint256 price;
        uint256 amount;
        uint256 remaining;
        uint256 escrow;
        uint256 expiry;
        bool active;
    }
    struct OrderRequest {
        address maker;
        uint256 outcomeIndex;
        bool isBuy;
        uint256 price;
        uint256 amount;
        uint256 expiry;
        uint256 salt;
    }
    struct CancelRequest {
        address maker;
        uint256 id;
        uint256 salt;
    }
    struct CancelSaltRequest {
        address maker;
        uint256 salt;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256[]) public buyBook;
    mapping(uint256 => uint256[]) public sellBook;
    mapping(address => mapping(uint256 => bool)) public usedSalt;
    mapping(address => mapping(uint256 => uint256)) public filledBySalt;
    mapping(address => mapping(uint256 => bool)) public canceledSalt;
    bytes32 public constant ORDER_TYPEHASH = keccak256("OrderRequest(address maker,uint256 outcomeIndex,bool isBuy,uint256 price,uint256 amount,uint256 expiry,uint256 salt)");
    bytes32 public constant CANCEL_TYPEHASH = keccak256("CancelRequest(address maker,uint256 id,uint256 salt)");
    bytes32 public constant CANCEL_SALT_TYPEHASH = keccak256("CancelSaltRequest(address maker,uint256 salt)");

    event Initialized();
    event OrderPlaced(uint256 id, address trader, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount);
    event OrderCanceled(uint256 id);
    event Trade(uint256 buyId, uint256 sellId, uint256 outcomeIndex, uint256 price, uint256 amount, uint256 fee);
    event Resolved(uint256 outcome);
    event Redeemed(address indexed user, uint256 amount, uint256 outcomeIndex);
    event CompleteSetDeposited(address indexed user, uint256 amount);
    event FeeUpdated(uint256 feeBps, address recipient);
    event FeesWithdrawn(address recipient, uint256 amount);
    event TradingPaused(bool paused);
    event TradingStarted();
    event Finalized(uint256 refundedBuys, uint256 refundedSells);
    event OrderPlacedSigned(address maker, uint256 id);
    event OrderCanceledSigned(address maker, uint256 id);
    event OrderFilledSigned(address maker, address taker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 fee, uint256 salt);
    event OrderSaltCanceled(address maker, uint256 salt);

    error InvalidOutcomeIndex();
    error InvalidStage();
    error AlreadyResolved();
    error ResolutionTimeNotReached();
    error Paused();
    error NotAdmin();
    error NoMinterRole();
    error NotApproved1155();
    error InvalidExpiry();
    error InvalidAmount();
    error InvalidAmountOrPrice();
    error InvalidTick();
    error InvalidSignedRequest();
    error OrderAlreadyCanceled();

    modifier atStage(IMarket.Stages _stage) {
        if (stage != _stage) revert InvalidStage();
        _;
    }

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    function _isAdmin(address a) internal view returns (bool) {
        return a == factory || a == creator;
    }

    function initialize(
        bytes32 _marketId,
        address _factory,
        address _creator,
        address _collateralToken,
        address _oracle,
        uint256 _feeBps,
        uint256 _resolutionTime,
        bytes calldata data
    ) external override initializer {
        __EIP712_init("CLOBMarket", "1");
        marketId = _marketId;
        factory = _factory;
        creator = _creator;
        collateralToken = _collateralToken;
        oracle = _oracle;
        feeBps = _feeBps;
        resolutionTime = _resolutionTime;
        address outcome1155;
        uint256 oc = 2;
        if (data.length == 32) {
            outcome1155 = abi.decode(data, (address));
        } else if (data.length == 64) {
            (outcome1155, oc) = abi.decode(data, (address, uint256));
        } else {
            revert();
        }
        outcomeToken = OutcomeToken1155(outcome1155);
        outcomeCount = oc;
        feeRecipient = _factory;
        stage = IMarket.Stages.TRADING;
        tickSize = 1;
        paused = true;
        emit Initialized();
    }

    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function isSaltUsed(address maker, uint256 salt) external view returns (bool) {
        return usedSalt[maker][salt];
    }

    function getFilledBySalt(address maker, uint256 salt) external view returns (uint256) {
        return filledBySalt[maker][salt];
    }

    function placeOrder(uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused returns (uint256 id) {
        id = _placeOrder(msg.sender, outcomeIndex, isBuy, price, amount, type(uint256).max);
    }

    function placeOrderWithExpiry(uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 expiry) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused returns (uint256 id) {
        if (expiry != 0 && expiry <= block.timestamp) revert InvalidExpiry();
        id = _placeOrder(msg.sender, outcomeIndex, isBuy, price, amount, expiry == 0 ? type(uint256).max : expiry);
    }

    function _placeOrder(address maker, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 expiry) internal returns (uint256 id) {
        if (outcomeIndex >= outcomeCount) revert InvalidOutcomeIndex();
        if (price == 0 || amount == 0) revert InvalidAmountOrPrice();
        if (tickSize > 0 && price % tickSize != 0) revert InvalidTick();
        id = ++nextOrderId;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), outcomeIndex);
        if (isBuy) {
            uint256 escrowBuy = price * amount;
            IERC20(collateralToken).safeTransferFrom(maker, address(this), escrowBuy);
            buyBook[outcomeIndex].push(id);
            orders[id] = Order({ id: id, trader: maker, outcomeIndex: outcomeIndex, isBuy: true, price: price, amount: amount, remaining: amount, escrow: escrowBuy, expiry: expiry, active: true });
        } else {
            if (!outcomeToken.isApprovedForAll(maker, address(this))) revert NotApproved1155();
            outcomeToken.safeTransferFrom(maker, address(this), tokenId, amount, "");
            sellBook[outcomeIndex].push(id);
            orders[id] = Order({ id: id, trader: maker, outcomeIndex: outcomeIndex, isBuy: false, price: price, amount: amount, remaining: amount, escrow: amount, expiry: expiry, active: true });
        }
        emit OrderPlaced(id, maker, outcomeIndex, isBuy, price, amount);
    }

    function cancelOrder(uint256 id) external nonReentrant atStage(IMarket.Stages.TRADING) {
        Order storage o = orders[id];
        require(o.active);
        require(o.trader == msg.sender);
        _refundAndDeactivate(o, msg.sender);
        emit OrderCanceled(id);
    }

    function _refundAndDeactivate(Order storage o, address to) internal {
        o.active = false;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), o.outcomeIndex);
        if (o.isBuy) {
            uint256 refund = o.escrow;
            o.escrow = 0;
            IERC20(collateralToken).safeTransfer(to, refund);
        } else {
            uint256 refundAmount = o.remaining;
            unchecked { o.escrow -= refundAmount; }
            outcomeToken.safeTransferFrom(address(this), to, tokenId, refundAmount, "");
        }
    }

    function matchOrders(uint256 outcomeIndex, uint256 maxMatches) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        if (outcomeIndex >= outcomeCount) revert InvalidOutcomeIndex();
        require(maxMatches > 0);
        uint256 matched = 0;
        while (matched < maxMatches) {
            if (!_executeOneMatch(outcomeIndex)) break;
            matched++;
        }
    }

    function _executeOneMatch(uint256 outcomeIndex) internal returns (bool) {
        (uint256 bestBidId, uint256 bidPrice) = _bestBid(outcomeIndex);
        (uint256 bestAskId, uint256 askPrice) = _bestAsk(outcomeIndex);
        if (bestBidId == 0 || bestAskId == 0) return false;
        if (orders[bestBidId].expiry < block.timestamp || orders[bestAskId].expiry < block.timestamp) return false;
        if (bidPrice < askPrice) return false;
        Order storage b = orders[bestBidId];
        Order storage s = orders[bestAskId];
        uint256 qty = b.remaining < s.remaining ? b.remaining : s.remaining;
        uint256 collateral = qty * askPrice;
        uint256 fee = feeBps > 0 ? (collateral * feeBps) / 10000 : 0;
        uint256 pay = collateral - fee;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), outcomeIndex);
        unchecked {
            b.remaining -= qty;
            s.remaining -= qty;
            b.escrow -= collateral;
            s.escrow -= qty;
        }
        IERC20(collateralToken).safeTransfer(s.trader, pay);
        unchecked { accruedFees += fee; }
        outcomeToken.safeTransferFrom(address(this), b.trader, tokenId, qty, "");
        emit Trade(b.id, s.id, outcomeIndex, askPrice, qty, fee);
        if (b.remaining == 0) b.active = false;
        if (s.remaining == 0) s.active = false;
        return true;
    }

    function withdrawFees(uint256 amount) external nonReentrant {
        require(msg.sender == feeRecipient);
        require(amount > 0 && amount <= accruedFees);
        accruedFees -= amount;
        IERC20(collateralToken).safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function placeOrderSigned(OrderRequest calldata req, bytes calldata signature) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused returns (uint256 id) {
        if (usedSalt[req.maker][req.salt]) revert InvalidSignedRequest();
        bytes32 structHash = keccak256(abi.encode(ORDER_TYPEHASH, req.maker, req.outcomeIndex, req.isBuy, req.price, req.amount, req.expiry, req.salt));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != req.maker) revert InvalidSignedRequest();
        usedSalt[req.maker][req.salt] = true;
        uint256 normalizedExpiry = req.expiry == 0 ? type(uint256).max : req.expiry;
        id = _placeOrder(req.maker, req.outcomeIndex, req.isBuy, req.price, req.amount, normalizedExpiry);
        emit OrderPlacedSigned(req.maker, id);
    }

    function cancelOrderSigned(CancelRequest calldata req, bytes calldata signature) external nonReentrant atStage(IMarket.Stages.TRADING) {
        if (usedSalt[req.maker][req.salt]) revert InvalidSignedRequest();
        bytes32 structHash = keccak256(abi.encode(CANCEL_TYPEHASH, req.maker, req.id, req.salt));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != req.maker) revert InvalidSignedRequest();
        usedSalt[req.maker][req.salt] = true;
        Order storage o = orders[req.id];
        require(o.active);
        require(o.trader == req.maker);
        _refundAndDeactivate(o, req.maker);
        emit OrderCanceledSigned(req.maker, req.id);
    }

    function cancelOrderSaltSigned(CancelSaltRequest calldata req, bytes calldata signature) external nonReentrant atStage(IMarket.Stages.TRADING) {
        if (canceledSalt[req.maker][req.salt]) revert OrderAlreadyCanceled();
        bytes32 structHash = keccak256(abi.encode(CANCEL_SALT_TYPEHASH, req.maker, req.salt));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != req.maker) revert InvalidSignedRequest();
        canceledSalt[req.maker][req.salt] = true;
        emit OrderSaltCanceled(req.maker, req.salt);
    }

    function mintCompleteSet(uint256 amount) external nonReentrant atStage(IMarket.Stages.TRADING) {
        if (amount == 0) revert InvalidAmount();
        if (!outcomeToken.hasRole(outcomeToken.MINTER_ROLE(), address(this))) revert NoMinterRole();
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256[] memory ids = new uint256[](outcomeCount);
        uint256[] memory amounts = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            ids[i] = outcomeToken.computeTokenId(address(this), i);
            amounts[i] = amount;
        }
        OutcomeToken1155(address(outcomeToken)).mintBatch(msg.sender, ids, amounts);
    }

    function depositCompleteSet(uint256 amount) external nonReentrant atStage(IMarket.Stages.TRADING) {
        if (amount == 0) revert InvalidAmount();
        if (!outcomeToken.hasRole(outcomeToken.MINTER_ROLE(), address(this))) revert NoMinterRole();
        uint256[] memory ids = new uint256[](outcomeCount);
        uint256[] memory amounts = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            ids[i] = outcomeToken.computeTokenId(address(this), i);
            amounts[i] = amount;
        }
        outcomeToken.burnBatch(msg.sender, ids, amounts);
        IERC20(collateralToken).safeTransfer(msg.sender, amount);
        emit CompleteSetDeposited(msg.sender, amount);
    }

    function redeem(uint256 amount) external nonReentrant atStage(IMarket.Stages.RESOLVED) {
        if (amount == 0) revert InvalidAmount();
        if (!outcomeToken.hasRole(outcomeToken.MINTER_ROLE(), address(this))) revert NoMinterRole();
        uint256 idWin = outcomeToken.computeTokenId(address(this), resolvedOutcome);
        outcomeToken.burn(msg.sender, idWin, amount);
        IERC20(collateralToken).safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, amount, resolvedOutcome);
    }

    function fillOrderSigned(OrderRequest calldata req, bytes calldata signature, uint256 fillAmount) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        if (canceledSalt[req.maker][req.salt]) revert InvalidSignedRequest();
        if (req.outcomeIndex >= outcomeCount) revert InvalidOutcomeIndex();
        if (req.price == 0 || req.amount == 0 || fillAmount == 0) revert InvalidAmountOrPrice();
        if (tickSize > 0 && req.price % tickSize != 0) revert InvalidTick();
        bytes32 structHash = keccak256(abi.encode(ORDER_TYPEHASH, req.maker, req.outcomeIndex, req.isBuy, req.price, req.amount, req.expiry, req.salt));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != req.maker) revert InvalidSignedRequest();
        uint256 normalizedExpiry = req.expiry == 0 ? type(uint256).max : req.expiry;
        if (normalizedExpiry <= block.timestamp) revert InvalidExpiry();
        uint256 already = filledBySalt[req.maker][req.salt];
        if (already + fillAmount > req.amount) revert InvalidAmount();
        filledBySalt[req.maker][req.salt] = already + fillAmount;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), req.outcomeIndex);
        uint256 collateral = fillAmount * req.price;
        uint256 fee = feeBps > 0 ? (collateral * feeBps) / 10000 : 0;
        uint256 pay = collateral - fee;
        if (req.isBuy) {
            IERC20(collateralToken).safeTransferFrom(req.maker, address(this), collateral);
            IERC20(collateralToken).safeTransfer(msg.sender, pay);
            unchecked { accruedFees += fee; }
            if (!outcomeToken.isApprovedForAll(msg.sender, address(this))) revert NotApproved1155();
            outcomeToken.safeTransferFrom(msg.sender, req.maker, tokenId, fillAmount, "");
        } else {
            if (!outcomeToken.isApprovedForAll(req.maker, address(this))) revert NotApproved1155();
            outcomeToken.safeTransferFrom(req.maker, msg.sender, tokenId, fillAmount, "");
            IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateral);
            IERC20(collateralToken).safeTransfer(req.maker, pay);
            unchecked { accruedFees += fee; }
        }
        emit OrderFilledSigned(req.maker, msg.sender, req.outcomeIndex, req.isBuy, req.price, fillAmount, fee, req.salt);
    }

    function resolve() external atStage(IMarket.Stages.TRADING) {
        if (msg.sender != oracle) revert NotAdmin();
        if (block.timestamp < resolutionTime) revert ResolutionTimeNotReached();
        if (stage == IMarket.Stages.RESOLVED) revert AlreadyResolved();
        resolvedOutcome = IOracle(oracle).getOutcome(marketId);
        stage = IMarket.Stages.RESOLVED;
        emit Resolved(resolvedOutcome);
    }

    function _bestBid(uint256 outcomeIndex) internal view returns (uint256 id, uint256 price) {
        uint256[] storage ids = buyBook[outcomeIndex];
        uint256 bestPrice = 0;
        uint256 bestId = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            if (o.price > bestPrice) {
                bestPrice = o.price;
                bestId = o.id;
            }
        }
        id = bestId;
        price = bestPrice;
    }

    function _bestAsk(uint256 outcomeIndex) internal view returns (uint256 id, uint256 price) {
        uint256[] storage ids = sellBook[outcomeIndex];
        uint256 bestPrice = type(uint256).max;
        uint256 bestId = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            if (o.price < bestPrice) {
                bestPrice = o.price;
                bestId = o.id;
            }
        }
        if (bestPrice == type(uint256).max) {
            bestPrice = 0;
        }
        id = bestId;
        price = bestPrice;
    }
    
    function setFee(uint256 newFeeBps, address newRecipient) external {
        require(msg.sender == factory);
        require(newFeeBps <= 10000);
        require(newRecipient != address(0));
        feeBps = newFeeBps;
        feeRecipient = newRecipient;
        emit FeeUpdated(newFeeBps, newRecipient);
    }

    function getBestBid(uint256 outcomeIndex) external view returns (uint256 price, uint256 qty) {
        (uint256 idBest, uint256 p) = _bestBid(outcomeIndex);
        if (idBest == 0) return (0, 0);
        uint256 total = 0;
        uint256[] storage ids = buyBook[outcomeIndex];
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            if (o.price == p) {
                unchecked { total += o.remaining; }
            }
        }
        price = p;
        qty = total;
    }

    function getBestAsk(uint256 outcomeIndex) external view returns (uint256 price, uint256 qty) {
        (uint256 idBest, uint256 p) = _bestAsk(outcomeIndex);
        if (idBest == 0 || p == 0) return (0, 0);
        uint256 total = 0;
        uint256[] storage ids = sellBook[outcomeIndex];
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            if (o.price == p) {
                unchecked { total += o.remaining; }
            }
        }
        price = p;
        qty = total;
    }

    function getTopOfBook(uint256 outcomeIndex, bool isBuy, uint256 levels) external view returns (uint256[] memory prices, uint256[] memory qtys) {
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        uint256[] memory up = new uint256[](ids.length);
        uint256[] memory uq = new uint256[](ids.length);
        uint256 unique = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            uint256 p = o.price;
            bool found = false;
            for (uint256 j = 0; j < unique; j++) {
                if (up[j] == p) {
                    unchecked { uq[j] += o.remaining; }
                    found = true;
                    break;
                }
            }
            if (!found) {
                up[unique] = p;
                uq[unique] = o.remaining;
                unchecked { unique++; }
            }
        }
        uint256 m = levels < unique ? levels : unique;
        prices = new uint256[](m);
        qtys = new uint256[](m);
        for (uint256 k = 0; k < m; k++) {
            uint256 idxSel = 0;
            for (uint256 j = 1; j < unique; j++) {
                if (isBuy) {
                    if (up[j] > up[idxSel]) idxSel = j;
                } else {
                    if (up[idxSel] == 0 || (up[j] != 0 && up[j] < up[idxSel])) idxSel = j;
                }
            }
            prices[k] = up[idxSel];
            qtys[k] = uq[idxSel];
            up[idxSel] = isBuy ? 0 : type(uint256).max;
            uq[idxSel] = 0;
        }
    }

    function getQueueAtPrice(uint256 outcomeIndex, bool isBuy, uint256 price, uint256 cursor, uint256 limit) external view returns (uint256[] memory idsOut) {
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        uint256 count = 0;
        for (uint256 i = cursor; i < ids.length && count < limit; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            if (o.price == price) {
                unchecked { count++; }
            }
        }
        idsOut = new uint256[](count);
        uint256 j = 0;
        for (uint256 i2 = cursor; i2 < ids.length && j < count; i2++) {
            Order storage o2 = orders[ids[i2]];
            if (!o2.active || o2.remaining == 0) continue;
            if (o2.expiry != 0 && o2.expiry < block.timestamp) continue;
            if (o2.price == price) {
                idsOut[j] = o2.id;
                unchecked { j++; }
            }
        }
    }

    function getOrderbookDepth(uint256 outcomeIndex, bool isBuy, uint256[] calldata pricesIn) external view returns (uint256[] memory qtys) {
        qtys = new uint256[](pricesIn.length);
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        for (uint256 i = 0; i < ids.length; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.remaining == 0) continue;
            if (o.expiry != 0 && o.expiry < block.timestamp) continue;
            for (uint256 j = 0; j < pricesIn.length; j++) {
                if (o.price == pricesIn[j]) {
                    unchecked { qtys[j] += o.remaining; }
                }
            }
        }
    }

    function getOrderFull(uint256 id) external view returns (address trader, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 remaining, uint256 escrow, uint256 expiry, bool active) {
        Order storage o = orders[id];
        trader = o.trader;
        outcomeIndex = o.outcomeIndex;
        isBuy = o.isBuy;
        price = o.price;
        amount = o.amount;
        remaining = o.remaining;
        escrow = o.escrow;
        expiry = o.expiry;
        active = o.active;
    }

    function getUserOrders(address user, uint256 cursor, uint256 limit) external view returns (uint256[] memory idsOut) {
        uint256 start = cursor;
        uint256 end = nextOrderId;
        uint256 count = 0;
        for (uint256 i = start; i <= end && count < limit; i++) {
            Order storage o = orders[i];
            if (o.trader == user) count++;
        }
        idsOut = new uint256[](count);
        uint256 j = 0;
        for (uint256 i2 = start; i2 <= end && j < count; i2++) {
            Order storage o2 = orders[i2];
            if (o2.trader == user) {
                idsOut[j] = i2;
                j++;
            }
        }
    }

    function getOrder(uint256 id) external view returns (address trader, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 remaining, bool active) {
        Order storage o = orders[id];
        trader = o.trader;
        outcomeIndex = o.outcomeIndex;
        isBuy = o.isBuy;
        price = o.price;
        amount = o.amount;
        remaining = o.remaining;
        active = o.active;
    }

    function cancelAll(uint256 outcomeIndex, bool isBuy, uint256 max) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length && count < max; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.trader != msg.sender || o.remaining == 0) continue;
            o.active = false;
            uint256 tokenId = outcomeToken.computeTokenId(address(this), o.outcomeIndex);
            if (isBuy) {
                uint256 refund = o.escrow;
                o.escrow = 0;
                IERC20(collateralToken).safeTransfer(msg.sender, refund);
            } else {
                uint256 refundAmount = o.remaining;
                o.escrow -= refundAmount;
                outcomeToken.safeTransferFrom(address(this), msg.sender, tokenId, refundAmount, "");
            }
            count++;
        }
    }

    function cancelExpired(uint256 outcomeIndex, bool isBuy, uint256 max) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length && count < max; i++) {
            Order storage o = orders[ids[i]];
            if (!o.active || o.expiry == 0 || o.expiry > block.timestamp) continue;
            o.active = false;
            uint256 tokenId = outcomeToken.computeTokenId(address(this), o.outcomeIndex);
            if (isBuy) {
                uint256 refund = o.escrow;
                o.escrow = 0;
                IERC20(collateralToken).safeTransfer(o.trader, refund);
            } else {
                uint256 refundAmount = o.remaining;
                o.escrow -= refundAmount;
                outcomeToken.safeTransferFrom(address(this), o.trader, tokenId, refundAmount, "");
            }
            count++;
        }
    }

    function sweepBook(uint256 outcomeIndex, bool isBuy, uint256 maxSweeps) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        uint256[] storage ids = isBuy ? buyBook[outcomeIndex] : sellBook[outcomeIndex];
        uint256 sweeps = 0;
        uint256 i = 0;
        while (i < ids.length && sweeps < maxSweeps) {
            Order storage o = orders[ids[i]];
            bool removable = (!o.active) || (o.remaining == 0) || (o.expiry != 0 && o.expiry < block.timestamp);
            if (removable) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                sweeps++;
            } else {
                i++;
            }
        }
    }

    function pauseTrading() external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        paused = true;
        emit TradingPaused(true);
    }

    function resumeTrading() external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        paused = false;
        emit TradingPaused(false);
    }

    function startTrading() external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        require(paused);
        paused = false;
        emit TradingStarted();
    }

    function setTickSize(uint256 newTick) external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        if (newTick == 0) revert InvalidTick();
        tickSize = newTick;
    }

    function updateResolutionTime(uint256 newTime) external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        if (newTime <= block.timestamp) revert ResolutionTimeNotReached();
        resolutionTime = newTime;
    }

    function finalize(uint256 max) external nonReentrant atStage(IMarket.Stages.RESOLVED) {
        uint256 refundedBuys = 0;
        uint256 refundedSells = 0;
        for (uint256 outcomeIndex = 0; outcomeIndex < outcomeCount && refundedBuys < max; outcomeIndex++) {
            uint256[] storage bids = buyBook[outcomeIndex];
            for (uint256 i = 0; i < bids.length && refundedBuys < max; i++) {
                Order storage o = orders[bids[i]];
                if (!o.active || !o.isBuy || o.remaining == 0) continue;
                o.active = false;
                uint256 refund = o.escrow;
                o.escrow = 0;
                IERC20(collateralToken).safeTransfer(o.trader, refund);
                refundedBuys++;
            }
        }
        for (uint256 outcomeIndex = 0; outcomeIndex < outcomeCount && refundedSells < max; outcomeIndex++) {
            uint256[] storage asks = sellBook[outcomeIndex];
            uint256 tokenId = outcomeToken.computeTokenId(address(this), outcomeIndex);
            for (uint256 i = 0; i < asks.length && refundedSells < max; i++) {
                Order storage o = orders[asks[i]];
                if (!o.active || o.isBuy || o.remaining == 0) continue;
                o.active = false;
                uint256 qty = o.remaining;
                o.escrow -= qty;
                outcomeToken.safeTransferFrom(address(this), o.trader, tokenId, qty, "");
                refundedSells++;
            }
        }
        emit Finalized(refundedBuys, refundedSells);
    }

}