// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title Confidential ERC7984 token with capped supply
/// @notice Minting is restricted to the factory while balances remain encrypted on-chain
contract ConfidentialERC7984Token is ERC7984, ZamaEthereumConfig, Ownable {
    /// @dev Factory that is allowed to mint new tokens
    address public immutable factory;

    /// @dev Original creator who requested this token
    address public immutable creator;

    /// @dev Maximum supply in base units (decimals = 6)
    uint64 public immutable maxSupply;

    /// @dev Amount minted so far in base units
    uint64 public mintedSupply;

    error InvalidFactory();
    error InvalidRecipient();
    error InvalidAmount();
    error MintingExceedsSupply();

    modifier onlyFactory() {
        if (msg.sender != factory) {
            revert InvalidFactory();
        }
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address factory_,
        uint64 maxSupply_
    ) ERC7984(name_, symbol_, "") Ownable(creator_) {
        if (factory_ == address(0)) {
            revert InvalidFactory();
        }

        creator = creator_;
        factory = factory_;
        maxSupply = maxSupply_;
    }

    /// @notice Mint encrypted tokens to a recipient
    /// @param to recipient address
    /// @param amount token amount in base units (6 decimals)
    function mint(address to, uint64 amount) external onlyFactory returns (euint64 mintedAmount) {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        uint64 newTotal = mintedSupply + amount;
        if (newTotal > maxSupply) {
            revert MintingExceedsSupply();
        }

        mintedSupply = newTotal;
        mintedAmount = _mint(to, FHE.asEuint64(amount));
    }

    /// @notice Remaining mintable supply in base units
    function remainingSupply() external view returns (uint64) {
        return maxSupply - mintedSupply;
    }
}
