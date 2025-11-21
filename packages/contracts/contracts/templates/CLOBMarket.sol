// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IMarket.sol";
import "../interfaces/IOracle.sol";
import "../tokens/OutcomeToken1155.sol";

contract CLOBMarket is IMarket, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    bytes32 public marketId;
    address public factory;
    address public creator;
    address public collateralToken;
    address public oracle;
    uint256 public feeBps;
    uint256 public resolutionTime;
    OutcomeToken1155 public outcomeToken;
    IMarket.Stages public stage;
    uint256 public resolvedOutcome;
    address public feeRecipient;
    uint256 public accruedFees;
    bool public paused;

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

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256[]) public buyBook;
    mapping(uint256 => uint256[]) public sellBook;

    event Initialized();
    event OrderPlaced(uint256 id, address trader, uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount);
    event OrderCanceled(uint256 id);
    event Trade(uint256 buyId, uint256 sellId, uint256 outcomeIndex, uint256 price, uint256 amount, uint256 fee);
    event Resolved(uint256 outcome);
    event Redeemed(address indexed user, uint256 amount, uint256 outcomeIndex);
    event CompleteSetDeposited(address indexed user, uint256 amount);

    error InvalidOutcomeIndex();
    error InvalidStage();
    error AlreadyResolved();
    error ResolutionTimeNotReached();
    error Paused();
    error NotAdmin();

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
        marketId = _marketId;
        factory = _factory;
        creator = _creator;
        collateralToken = _collateralToken;
        oracle = _oracle;
        feeBps = _feeBps;
        resolutionTime = _resolutionTime;
        (address outcome1155) = abi.decode(data, (address));
        outcomeToken = OutcomeToken1155(outcome1155);
        feeRecipient = _factory;
        stage = IMarket.Stages.TRADING;
        emit Initialized();
    }

    function placeOrder(uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused returns (uint256 id) {
        if (outcomeIndex > 1) revert InvalidOutcomeIndex();
        require(price > 0 && amount > 0);
        id = ++nextOrderId;
        uint256 escrow;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), outcomeIndex);
        if (isBuy) {
            escrow = price * amount;
            IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), escrow);
            buyBook[outcomeIndex].push(id);
        } else {
            require(outcomeToken.isApprovedForAll(msg.sender, address(this)), "not approved for 1155");
            outcomeToken.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
            escrow = amount;
            sellBook[outcomeIndex].push(id);
        }
        orders[id] = Order({ id: id, trader: msg.sender, outcomeIndex: outcomeIndex, isBuy: isBuy, price: price, amount: amount, remaining: amount, escrow: escrow, expiry: type(uint256).max, active: true });
        emit OrderPlaced(id, msg.sender, outcomeIndex, isBuy, price, amount);
    }

    function placeOrderWithExpiry(uint256 outcomeIndex, bool isBuy, uint256 price, uint256 amount, uint256 expiry) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused returns (uint256 id) {
        if (outcomeIndex > 1) revert InvalidOutcomeIndex();
        require(price > 0 && amount > 0);
        require(expiry == 0 || expiry > block.timestamp);
        id = ++nextOrderId;
        uint256 escrow;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), outcomeIndex);
        if (isBuy) {
            escrow = price * amount;
            IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), escrow);
            buyBook[outcomeIndex].push(id);
        } else {
            require(outcomeToken.isApprovedForAll(msg.sender, address(this)), "not approved for 1155");
            outcomeToken.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
            escrow = amount;
            sellBook[outcomeIndex].push(id);
        }
        orders[id] = Order({ id: id, trader: msg.sender, outcomeIndex: outcomeIndex, isBuy: isBuy, price: price, amount: amount, remaining: amount, escrow: escrow, expiry: expiry == 0 ? type(uint256).max : expiry, active: true });
        emit OrderPlaced(id, msg.sender, outcomeIndex, isBuy, price, amount);
    }

    function cancelOrder(uint256 id) external nonReentrant atStage(IMarket.Stages.TRADING) {
        Order storage o = orders[id];
        require(o.active);
        require(o.trader == msg.sender);
        o.active = false;
        uint256 tokenId = outcomeToken.computeTokenId(address(this), o.outcomeIndex);
        if (o.isBuy) {
            uint256 refund = o.price * o.remaining;
            o.escrow -= refund;
            IERC20(collateralToken).safeTransfer(msg.sender, refund);
        } else {
            uint256 refundAmount = o.remaining;
            o.escrow -= refundAmount;
            outcomeToken.safeTransferFrom(address(this), msg.sender, tokenId, refundAmount, "");
        }
        emit OrderCanceled(id);
    }

    function matchOrders(uint256 outcomeIndex, uint256 maxMatches) external nonReentrant atStage(IMarket.Stages.TRADING) notPaused {
        if (outcomeIndex > 1) revert InvalidOutcomeIndex();
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
        b.remaining -= qty;
        s.remaining -= qty;
        b.escrow -= collateral;
        IERC20(collateralToken).safeTransfer(s.trader, pay);
        accruedFees += fee;
        outcomeToken.safeTransferFrom(address(this), b.trader, tokenId, qty, "");
        emit Trade(b.id, s.id, outcomeIndex, askPrice, qty, fee);
        if (b.remaining == 0) b.active = false;
        if (s.remaining == 0) s.active = false;
        return true;
    }

    function withdrawFees(uint256 amount) external {
        require(msg.sender == feeRecipient);
        require(amount > 0 && amount <= accruedFees);
        accruedFees -= amount;
        IERC20(collateralToken).safeTransfer(feeRecipient, amount);
    }

    function depositCompleteSet(uint256 amount) external nonReentrant atStage(IMarket.Stages.TRADING) {
        require(amount > 0);
        require(outcomeToken.hasRole(outcomeToken.MINTER_ROLE(), address(this)), "no minter role");
        uint256 idNo = outcomeToken.computeTokenId(address(this), 0);
        uint256 idYes = outcomeToken.computeTokenId(address(this), 1);
        outcomeToken.burn(msg.sender, idNo, amount);
        outcomeToken.burn(msg.sender, idYes, amount);
        IERC20(collateralToken).safeTransfer(msg.sender, amount);
        emit CompleteSetDeposited(msg.sender, amount);
    }

    function redeem(uint256 amount) external nonReentrant atStage(IMarket.Stages.RESOLVED) {
        require(amount > 0);
        require(outcomeToken.hasRole(outcomeToken.MINTER_ROLE(), address(this)), "no minter role");
        uint256 idWin = outcomeToken.computeTokenId(address(this), resolvedOutcome);
        outcomeToken.burn(msg.sender, idWin, amount);
        IERC20(collateralToken).safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, amount, resolvedOutcome);
    }

    function resolve() external atStage(IMarket.Stages.TRADING) {
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
        feeBps = newFeeBps;
        feeRecipient = newRecipient;
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
            if (o.price == p) total += o.remaining;
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
            if (o.price == p) total += o.remaining;
        }
        price = p;
        qty = total;
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
                uint256 refund = o.price * o.remaining;
                o.escrow -= refund;
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
                uint256 refund = o.price * o.remaining;
                o.escrow -= refund;
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
    }

    function resumeTrading() external {
        if (!_isAdmin(msg.sender)) revert NotAdmin();
        paused = false;
    }

}