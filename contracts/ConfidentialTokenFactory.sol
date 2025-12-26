// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {ConfidentialERC7984Token} from "./ConfidentialERC7984Token.sol";

/// @title Factory for launching ERC7984 tokens with an ETH sale
/// @notice Users can create capped confidential tokens and sell them at a fixed 1 ETH = 10,000,000 token rate
contract ConfidentialTokenFactory is Ownable {
    using SafeCast for uint256;

    /// @dev Default supply users see when they do not provide one (human units, decimals applied internally)
    uint64 public constant DEFAULT_SUPPLY = 10_000_000;

    /// @dev ERC7984 uses 6 decimals
    uint64 public constant DECIMALS_MULTIPLIER = 1_000_000;

    /// @dev Fixed price: 1 ETH buys 10,000,000 tokens (with decimals applied)
    uint256 public constant TOKENS_PER_ETH = uint256(DEFAULT_SUPPLY) * DECIMALS_MULTIPLIER;

    struct TokenRecord {
        address token;
        string name;
        string symbol;
        uint64 maxSupply;
        uint64 mintedSupply;
        address creator;
    }

    address[] private _tokenList;
    mapping(address => TokenRecord) private _tokenDetails;
    mapping(address => address[]) private _creatorTokens;

    error InvalidSupply();
    error TokenNotFound();
    error NoTokensToMint();
    error InsufficientSupply();
    error InvalidRecipient();

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint64 maxSupply);
    event TokenPurchased(address indexed buyer, address indexed token, uint256 ethSpent, uint64 tokensMinted);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /// @notice Create a new ERC7984 token with optional custom supply
    /// @param name_ token name
    /// @param symbol_ token symbol
    /// @param supplyHuman human-readable supply (no decimals). Uses DEFAULT_SUPPLY when zero.
    function createToken(
        string memory name_,
        string memory symbol_,
        uint64 supplyHuman
    ) external returns (address tokenAddress) {
        uint64 selectedSupply = supplyHuman == 0 ? DEFAULT_SUPPLY : supplyHuman;
        uint256 scaledSupply = uint256(selectedSupply) * DECIMALS_MULTIPLIER;

        if (scaledSupply == 0 || scaledSupply > type(uint64).max) {
            revert InvalidSupply();
        }

        uint64 finalSupply = scaledSupply.toUint64();
        ConfidentialERC7984Token token = new ConfidentialERC7984Token(
            name_,
            symbol_,
            msg.sender,
            address(this),
            finalSupply
        );

        tokenAddress = address(token);

        _tokenDetails[tokenAddress] = TokenRecord({
            token: tokenAddress,
            name: name_,
            symbol: symbol_,
            maxSupply: finalSupply,
            mintedSupply: 0,
            creator: msg.sender
        });

        _tokenList.push(tokenAddress);
        _creatorTokens[msg.sender].push(tokenAddress);

        emit TokenCreated(tokenAddress, msg.sender, name_, symbol_, finalSupply);
    }

    /// @notice Buy tokens from a deployed ERC7984 token using ETH
    /// @param tokenAddress token to purchase
    function buyTokens(address tokenAddress) external payable returns (uint64 mintedAmount) {
        TokenRecord storage record = _getToken(tokenAddress);
        if (msg.value == 0) {
            revert NoTokensToMint();
        }

        uint64 tokensToMint = quoteFromEth(tokenAddress, msg.value);
        if (tokensToMint == 0) {
            revert NoTokensToMint();
        }

        uint64 available = ConfidentialERC7984Token(tokenAddress).remainingSupply();
        if (tokensToMint > available) {
            revert InsufficientSupply();
        }

        ConfidentialERC7984Token(tokenAddress).mint(msg.sender, tokensToMint);
        mintedAmount = tokensToMint;

        record.mintedSupply = ConfidentialERC7984Token(tokenAddress).mintedSupply();

        emit TokenPurchased(msg.sender, tokenAddress, msg.value, mintedAmount);
    }

    /// @notice Compute how many base units are minted for a given ETH amount
    function quoteFromEth(address tokenAddress, uint256 ethAmount) public view returns (uint64) {
        _ensureTokenExists(tokenAddress);

        uint256 tokens = (ethAmount * TOKENS_PER_ETH) / 1 ether;
        if (tokens > type(uint64).max) {
            revert InvalidSupply();
        }

        return tokens.toUint64();
    }

    /// @notice All tokens created through the factory
    function getAllTokens() external view returns (TokenRecord[] memory tokens) {
        uint256 length = _tokenList.length;
        tokens = new TokenRecord[](length);

        for (uint256 i = 0; i < length; i++) {
            tokens[i] = _snapshot(_tokenList[i]);
        }
    }

    /// @notice Tokens created by a specific address
    function getTokensByCreator(address creator) external view returns (TokenRecord[] memory tokens) {
        address[] memory owned = _creatorTokens[creator];
        uint256 length = owned.length;
        tokens = new TokenRecord[](length);

        for (uint256 i = 0; i < length; i++) {
            tokens[i] = _snapshot(owned[i]);
        }
    }

    /// @notice Details for a single token
    function tokenDetails(address tokenAddress) external view returns (TokenRecord memory) {
        return _snapshot(tokenAddress);
    }

    /// @notice Remaining supply (base units) for a token
    function remainingSupply(address tokenAddress) external view returns (uint64) {
        _ensureTokenExists(tokenAddress);
        return ConfidentialERC7984Token(tokenAddress).remainingSupply();
    }

    /// @notice Fixed pricing rule (base units per 1 ETH)
    function tokensPerEth() external pure returns (uint256) {
        return TOKENS_PER_ETH;
    }

    /// @notice ERC7984 decimal multiplier (1e6)
    function decimalsMultiplier() external pure returns (uint64) {
        return DECIMALS_MULTIPLIER;
    }

    /// @notice Withdraw collected ETH
    /// @param to recipient wallet
    /// @param amount amount to withdraw (set to 0 to withdraw all)
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidRecipient();
        }

        uint256 balance = address(this).balance;
        uint256 payout = amount == 0 ? balance : amount;

        require(payout <= balance, "Insufficient balance");

        (bool sent, ) = to.call{value: payout}("");
        require(sent, "Withdraw failed");

        emit TreasuryWithdrawn(to, payout);
    }

    /// @notice Prevent accidental ETH transfers
    receive() external payable {
        revert NoTokensToMint();
    }

    function _getToken(address tokenAddress) private view returns (TokenRecord storage) {
        TokenRecord storage record = _tokenDetails[tokenAddress];
        if (record.token == address(0)) {
            revert TokenNotFound();
        }
        return record;
    }

    function _ensureTokenExists(address tokenAddress) private view {
        if (_tokenDetails[tokenAddress].token == address(0)) {
            revert TokenNotFound();
        }
    }

    function _snapshot(address tokenAddress) private view returns (TokenRecord memory) {
        _ensureTokenExists(tokenAddress);
        TokenRecord memory cached = _tokenDetails[tokenAddress];
        cached.mintedSupply = ConfidentialERC7984Token(tokenAddress).mintedSupply();
        return cached;
    }
}
