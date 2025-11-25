// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title OutcomeToken1155
/// @notice Shared ERC1155 token contract for multiple markets and outcomes
/// @dev Markets must be granted MINTER_ROLE to mint/burn users' outcome tokens
contract OutcomeToken1155 is Initializable, ERC1155Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function initialize(string memory uri_) public initializer {
        __ERC1155_init(uri_);
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setURI(string memory newuri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    function grantMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, minter);
    }

    function revokeMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE) {
        _mintBatch(to, ids, amounts, "");
    }

    function burn(address from, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(from, id, amount);
    }

    function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE) {
        _burnBatch(from, ids, amounts);
    }

    /// @notice Utility to compute a unique token id from market address and outcome index
    /// @dev Packs market address (160 bits) left-shifted by 32 and outcome index in lower 32 bits
    function computeTokenId(address market, uint256 outcomeIndex) external pure returns (uint256) {
        return (uint256(uint160(market)) << 32) | outcomeIndex;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}