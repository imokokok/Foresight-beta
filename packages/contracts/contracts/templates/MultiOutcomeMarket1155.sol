// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IMarket.sol";
import "../tokens/OutcomeToken1155.sol";

/// @title MultiOutcomeMarket1155
/// @notice Multi-outcome market template using a shared ERC1155 for outcome tokens
contract MultiOutcomeMarket1155 is AccessControl, ReentrancyGuard, IMarket {
    using SafeERC20 for IERC20;
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum State { Created, Trading, Resolved, Canceled }

    State public state;

    address public factory;
    address public creator;
    IERC20 public collateral;
    uint8 public collateralDecimals;

    OutcomeToken1155 public outcome1155;
    uint256 public outcomeCount;

    address public oracle;
    uint256 public feeBps;
    uint256 public resolutionTime;

    address public feeRecipient;
    uint256 public accruedFees;

    int256 public finalOutcome; // -1=unset, [0..outcomeCount-1]
    bool private _initialized;

    event Initialized(address factory, address creator, address collateral, address oracle, uint256 feeBps, uint256 resolutionTime, address outcome1155, uint256 outcomeCount);
    event TradingStarted();
    event MarketCanceled();
    event Finalized(int256 outcome);
    event DepositCompleteSet(address indexed user, uint256 collateralIn, uint256[] mintedPerOutcome);
    event Redeem(address indexed user, int256 outcome, uint256 tokenBurned, uint256 collateralOut);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event FeesWithdrawn(address indexed to, uint256 amount);

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "not admin");
        _;
    }

    modifier onlyOracle() {
        require(hasRole(ORACLE_ROLE, msg.sender), "not oracle");
        _;
    }

    function initialize(
        bytes32,
        address factory_,
        address creator_,
        address collateralToken_,
        address oracle_,
        uint256 feeBps_,
        uint256 resolutionTime_,
        bytes calldata data
    ) external override {
        require(!_initialized, "already init");
        require(factory_ != address(0) && creator_ != address(0), "bad actors");
        require(collateralToken_ != address(0) && oracle_ != address(0), "bad addrs");
        require(resolutionTime_ > block.timestamp, "resolution in past");
        require(feeBps_ <= 1000, "fee too high"); // max 10%

        // data encoding: (address outcome1155_, uint256 outcomeCount_)
        (address outcome1155_, uint256 outcomeCount_) = abi.decode(data, (address, uint256));
        require(outcome1155_ != address(0), "outcome1155=0");
        require(outcomeCount_ >= 2 && outcomeCount_ <= 256, "outcomes range");

        factory = factory_;
        creator = creator_;
        collateral = IERC20(collateralToken_);
        collateralDecimals = IERC20Metadata(collateralToken_).decimals();
        require(collateralDecimals <= 18, "decimals too high");
        oracle = oracle_;
        feeBps = feeBps_;
        resolutionTime = resolutionTime_;
        feeRecipient = creator_;

        outcome1155 = OutcomeToken1155(outcome1155_);
        outcomeCount = outcomeCount_;

        _grantRole(ADMIN_ROLE, creator_);
        _grantRole(ORACLE_ROLE, oracle_);

        state = State.Created;
        finalOutcome = -1;
        _initialized = true;

        emit Initialized(factory_, creator_, collateralToken_, oracle_, feeBps_, resolutionTime_, outcome1155_, outcomeCount_);
    }

    function setFeeRecipient(address newRecipient) external onlyAdmin {
        require(newRecipient != address(0), "recipient=0");
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    function startTrading() external onlyAdmin {
        require(state == State.Created, "bad state");
        state = State.Trading;
        emit TradingStarted();
    }

    function cancelMarket() external onlyAdmin {
        require(state == State.Created || state == State.Trading, "bad state");
        state = State.Canceled;
        emit MarketCanceled();
    }

    /// @notice Deposit collateral to mint a complete set: one unit for each outcome
    function depositCompleteSet(uint256 collateralAmount) external nonReentrant {
        require(state == State.Trading, "not trading");
        require(block.timestamp < resolutionTime, "past resolution");
        require(collateralAmount > 0, "amount=0");

        // ensure market has minter role on shared 1155
        require(outcome1155.hasRole(outcome1155.MINTER_ROLE(), address(this)), "no minter role");

        // transfer collateral in
        collateral.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // normalize to 18 decimals outcome tokens
        uint256 amountOut = _to18(collateralAmount);

        // prepare ids and amounts
        uint256[] memory ids = new uint256[](outcomeCount);
        uint256[] memory amounts = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            ids[i] = outcome1155.computeTokenId(address(this), i);
            amounts[i] = amountOut;
        }

        outcome1155.mintBatch(msg.sender, ids, amounts);

        emit DepositCompleteSet(msg.sender, collateralAmount, amounts);
    }

    /// @notice Finalize market outcome by oracle after resolutionTime
    function finalize(int256 outcomeIndex) external onlyOracle {
        require(block.timestamp >= resolutionTime, "too early");
        require(state == State.Trading || state == State.Created, "bad state");
        require(outcomeIndex >= 0 && outcomeIndex < int256(outcomeCount), "bad outcome");
        state = State.Resolved;
        finalOutcome = outcomeIndex;
        emit Finalized(outcomeIndex);
    }

    /// @notice Redeem winning token for collateral 1:1 (minus fee if set)
    function redeem(uint256 tokenAmount) external nonReentrant {
        require(state == State.Resolved, "not resolved");
        require(tokenAmount > 0, "amount=0");
        require(outcome1155.hasRole(outcome1155.MINTER_ROLE(), address(this)), "no minter role");

        uint256 idWin = outcome1155.computeTokenId(address(this), uint256(finalOutcome));

        // burn winning tokens from user (market must have MINTER_ROLE on outcome1155)
        outcome1155.burn(msg.sender, idWin, tokenAmount);

        uint256 gross = _from18(tokenAmount);
        uint256 fee = feeBps > 0 ? (gross * feeBps) / 10000 : 0;
        uint256 net = gross - fee;
        accruedFees += fee;

        require(collateral.balanceOf(address(this)) >= net, "insufficient vault");
        collateral.safeTransfer(msg.sender, net);

        emit Redeem(msg.sender, finalOutcome, tokenAmount, net);
    }

    /// @notice On cancel, redeem a complete set back to collateral 1:1 (no fee)
    function redeemCompleteSetOnCancel(uint256 amount18PerOutcome) external nonReentrant {
        require(state == State.Canceled, "not canceled");
        require(amount18PerOutcome > 0, "amount=0");
        require(outcome1155.hasRole(outcome1155.MINTER_ROLE(), address(this)), "no minter role");

        uint256[] memory ids = new uint256[](outcomeCount);
        uint256[] memory amounts = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            ids[i] = outcome1155.computeTokenId(address(this), i);
            amounts[i] = amount18PerOutcome;
        }
        outcome1155.burnBatch(msg.sender, ids, amounts);

        uint256 collateralOut = _from18(amount18PerOutcome);
        require(collateral.balanceOf(address(this)) >= collateralOut, "insufficient vault");
        collateral.safeTransfer(msg.sender, collateralOut);
    }

    function withdrawFees(uint256 amount) external onlyAdmin {
        require(amount > 0 && amount <= accruedFees, "bad amount");
        accruedFees -= amount;
        collateral.safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    

    function _to18(uint256 amt) internal view returns (uint256) {
        if (collateralDecimals == 18) return amt;
        return amt * (10 ** (18 - collateralDecimals));
    }

    function _from18(uint256 amt18) internal view returns (uint256) {
        if (collateralDecimals == 18) return amt18;
        return amt18 / (10 ** (18 - collateralDecimals));
    }
}