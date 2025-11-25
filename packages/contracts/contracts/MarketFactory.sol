// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./interfaces/IMarket.sol";

/// @title MarketFactory
/// @author Foresight
/// @notice This factory contract is responsible for creating and managing prediction markets.
/// @dev It uses a template-based approach with minimal proxies (clones) for gas efficiency.
/// It maintains a registry of market templates and tracks all created markets.
contract MarketFactory is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    using Clones for address;

    /// @notice The role identifier for administrators who can manage templates and fees.
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    /// @dev The fixed address of the UMA Oracle contract.
    address public umaOracle;

    /// @dev Represents a registered market template.
    struct Template {
        address implementation; // The address of the template implementation contract.
        bool exists;            // Flag to check if the template is registered.
        string name;            // An optional name for the template (e.g., "BINARY_MARKET_V1").
    }

    /// @dev Contains information about a created market.
    struct MarketInfo {
        address market;         // The address of the cloned market contract.
        bytes32 templateId;     // The ID of the template used to create the market.
        address creator;        // The address of the market creator.
        address collateralToken;// The ERC20 token used for collateral.
        address oracle;         // The oracle contract responsible for resolution.
        uint256 feeBps;         // The trading fee in basis points.
        uint256 resolutionTime; // The timestamp when the market can be resolved.
    }

    /// @notice Mapping from a template ID to the Template struct.
    mapping(bytes32 => Template) public templates;

    /// @notice The total number of markets created by this factory.
    uint256 public marketCount;

    /// @notice Mapping from a sequential market ID to its MarketInfo.
    mapping(uint256 => MarketInfo) public markets;

    /// @notice A quick lookup mapping to verify if a market address was created by this factory.
    mapping(address => bool) public isMarketFromFactory;

    // Fee management (controlled by ADMIN_ROLE)
    uint256 public feeBps; // Global fee in basis points
    address public feeTo; // Address to receive fees

    /// @notice Emitted when a new market template is registered.
    event TemplateRegistered(bytes32 indexed templateId, address implementation, string name);
    
    /// @notice Emitted when a market template is removed.
    event TemplateRemoved(bytes32 indexed templateId);

    /// @notice Emitted when the fee structure is changed by an admin.
    event FeeChanged(uint256 newFeeBps, address newFeeTo);

    /// @notice Emitted when a new market is created.
    event MarketCreated(
        uint256 indexed marketId,
        address indexed market,
        bytes32 indexed templateId,
        address creator,
        address collateralToken,
        address oracle,
        uint256 _feeBps,
        uint256 resolutionTime
    );

    /// @notice Contract constructor.
    /// @param admin The address to be granted the initial ADMIN_ROLE.
    /// @param _umaOracle The address of the UMA Oracle contract.
    function initialize(address admin, address _umaOracle) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        require(admin != address(0), "admin cannot be the zero address");
        require(_umaOracle != address(0), "UMA oracle cannot be the zero address");
        _grantRole(ADMIN_ROLE, admin);
        umaOracle = _umaOracle;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}

    // ----------------------
    // Fee Management (Admin Controlled)
    // ----------------------

    /// @notice Sets the fee structure for the platform.
    /// @dev Can only be called by the admin.
    /// @param newFeeBps The new fee in basis points.
    /// @param newFeeTo The new address to receive fees.
    function setFee(uint256 newFeeBps, address newFeeTo) external onlyRole(ADMIN_ROLE) {
        require(newFeeBps <= 10000, "fee too high");
        feeBps = newFeeBps;
        feeTo = newFeeTo;
        emit FeeChanged(newFeeBps, newFeeTo);
    }

    // ----------------------
    // Template management
    // ----------------------

    /// @notice Registers a new market template.
    /// @dev Can only be called by an address with the ADMIN_ROLE.
    /// @param templateId A unique identifier for the template (e.g., keccak256("BINARY_V1")).
    /// @param implementation The address of the deployed template logic contract.
    /// @param name A human-readable name for the template.
    function registerTemplate(bytes32 templateId, address implementation, string calldata name) external onlyRole(ADMIN_ROLE) {
        require(templateId != bytes32(0), "templateId cannot be zero");
        require(implementation != address(0), "implementation cannot be the zero address");
        templates[templateId] = Template({ implementation: implementation, exists: true, name: name });
        emit TemplateRegistered(templateId, implementation, name);
    }

    /// @notice Removes an existing market template.
    /// @dev Can only be called by an address with the ADMIN_ROLE.
    /// @param templateId The ID of the template to remove.
    function removeTemplate(bytes32 templateId) external onlyRole(ADMIN_ROLE) {
        require(templates[templateId].exists, "template does not exist");
        delete templates[templateId];
        emit TemplateRemoved(templateId);
    }

    /// @notice Retrieves information about a registered template.
    /// @param templateId The ID of the template to query.
    /// @return The Template struct associated with the given ID.
    function getTemplate(bytes32 templateId) external view returns (Template memory) {
        return templates[templateId];
    }

    // ----------------------
    // Market creation
    // ----------------------

    /// @notice Creates a new prediction market by cloning a registered template.
    /// @dev This function deploys a minimal proxy (clone) of the template and initializes it.
    /// It forces the use of the pre-configured UMA oracle.
    /// @param templateId The ID of the registered template to use.
    /// @param collateralToken The ERC20 token to be used as collateral.
    /// @param _feeBps The trading fee for the market in basis points (1 bps = 0.01%).
    /// @param resolutionTime The Unix timestamp after which the market can be resolved.
    /// @param data ABI-encoded data specific to the template's initialization function.
    /// @return market The address of the newly created market.
    /// @return marketId The sequential ID assigned to the new market.
    function createMarket(
        bytes32 templateId,
        address collateralToken,
        uint256 _feeBps,
        uint256 resolutionTime,
        bytes calldata data
    ) external returns (address market, uint256 marketId) {
        Template memory t = templates[templateId];
        require(t.exists, "template does not exist");
        require(collateralToken != address(0), "collateralToken cannot be the zero address");
        require(resolutionTime > block.timestamp, "resolution in past");

        market = t.implementation.clone();

        marketId = ++marketCount;

        uint256 feeBpsToUse = _feeBps == 0 ? feeBps : _feeBps;
        require(feeBpsToUse <= 10000, "fee too high");

        IMarket(market).initialize(
            bytes32(marketId),
            address(this),
            msg.sender,
            collateralToken,
            umaOracle, // Force use of the UMA oracle
            feeBpsToUse,
            resolutionTime,
            data
        );
        markets[marketId] = MarketInfo({
            market: market,
            templateId: templateId,
            creator: msg.sender,
            collateralToken: collateralToken,
            oracle: umaOracle, // Record the UMA oracle
            feeBps: feeBpsToUse,
            resolutionTime: resolutionTime
        });
        isMarketFromFactory[market] = true;

        emit MarketCreated(
            marketId,
            market,
            templateId,
            msg.sender,
            collateralToken,
            umaOracle, // Emit the UMA oracle address
            feeBpsToUse,
            resolutionTime
        );
    }
}