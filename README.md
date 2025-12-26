# NebulaLaunch

NebulaLaunch is a privacy-first token launchpad that lets anyone create encrypted ERC-7984 tokens, list them instantly, and sell them for ETH at a fixed 1 ETH = 10,000,000 token rate. It is built on Zama FHEVM to keep balances and transfers confidential while still enabling on-chain interactions.

This repository contains the smart contracts, deployment scripts, tasks, tests, and a React + Vite frontend (under `home/`) that supports the full launch-to-purchase-to-decrypt flow.

## Overview

NebulaLaunch focuses on the full lifecycle of a confidential token:

- Create a token by providing name, symbol, and total supply (defaults to 10,000,000).
- Deploy an ERC-7984 compliant confidential token via a factory.
- List all created tokens on the frontend without mock data.
- Buy tokens with ETH at a fixed price (1 ETH = 10,000,000 tokens).
- View encrypted balances and explicitly decrypt when the user requests it.

## Problems Solved

- **Privacy leakage in token balances**: Most token launches reveal balances and transfers publicly. NebulaLaunch uses FHE to keep balances confidential.
- **Manual token launch complexity**: Deploying and wiring token sales often requires multiple contracts and custom scripts. The factory streamlines this into a single creation flow.
- **Fragmented user experience**: Token creation, listing, purchase, and balance decryption live in one interface with no placeholders or mock data.
- **Hard-to-audit pricing**: The system enforces a deterministic 1 ETH = 10,000,000 token price at the contract level.

## Key Advantages

- **End-to-end confidentiality**: Uses FHEVM to encrypt balances and keep sensitive data private on-chain.
- **Simple launch flow**: Create a token in a few inputs; everything else is handled by the factory and frontend.
- **Deterministic pricing**: Fixed-price sales remove ambiguity and make token economics explicit.
- **No mock data**: All data comes directly from deployed contracts using real reads and writes.
- **Clear separation of reads and writes**: Reads use viem; writes use ethers, aligned with FHEVM and wallet tooling.

## Tech Stack

- **Smart contracts**: Solidity + Hardhat
- **Confidential computing**: Zama FHEVM
- **Frontend**: React + Vite + viem + rainbowkit
- **Contract writes**: ethers
- **Package manager**: npm

## Architecture

1. **Token Factory**
   - Receives user input (name, symbol, supply).
   - Deploys an ERC-7984 confidential token instance.
   - Registers the token for frontend discovery.

2. **Confidential ERC-7984 Token**
   - Stores balances in encrypted form.
   - Supports encrypted transfers and balances.
   - Provides decrypt flows only when a user explicitly requests it.

3. **Frontend (home/)**
   - Lists all tokens from the factory.
   - Allows token purchase with ETH at the fixed rate.
   - Shows encrypted balances and offers a decrypt action.

## Repository Structure

```
contracts/    Smart contracts (factory + ERC-7984 implementation)
deploy/       Hardhat deployment scripts
deployments/  Deployed addresses and generated ABIs
home/         React + Vite frontend
tasks/        Hardhat tasks
test/         Tests
```

## Smart Contract Behavior

- **Token creation**
  - Inputs: name, symbol, total supply (default 10,000,000).
  - Factory deploys a new confidential ERC-7984 token.

- **Token purchase**
  - Price is fixed on-chain: 1 ETH = 10,000,000 tokens.
  - The factory handles minting/transfer logic for purchases.

- **Confidential balances**
  - Balances are encrypted using FHEVM.
  - Decryption is only triggered by an explicit user action.

## Frontend Behavior

- Lists all tokens created by the factory.
- Uses contract ABIs generated in `deployments/sepolia`.
- Uses viem for read operations and ethers for write operations.
- Does not depend on localhost networks, localStorage, or JSON files.
- Uses the existing UI in `home/` as the base and extends it.

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm
- A Sepolia wallet with ETH

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create a `.env` file for deployments. Mnemonics are not supported.

```
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_project_id
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy Locally (Contracts Only)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

### Frontend Usage

1. Open the `home/` app.
2. Connect a Sepolia wallet.
3. Create a token from the UI.
4. The new token appears immediately in the token list.
5. Buy tokens with ETH at the fixed exchange rate.
6. View encrypted balances and choose to decrypt them.

## How Data Flows

- Contract deployments generate ABIs and addresses in `deployments/sepolia`.
- The frontend imports those ABIs directly.
- Reads are executed through viem to fetch token lists and balances.
- Writes are executed through ethers to create tokens and purchase them.

## Security and Privacy Notes

- Balances are stored and handled in encrypted form via FHEVM.
- Decryption is user-initiated and should never be automatic.
- Fixed pricing eliminates unexpected price manipulation.

## Testing

- Unit and integration tests live in `test/`.
- Run with `npm run test` after compiling.

## Future Roadmap

- Add richer token discovery and filtering on the frontend.
- Expand purchase options with variable pricing models.
- Improve token metadata support and IPFS integration.
- Add analytics dashboards for encrypted token flows.
- Extend multi-chain support when FHEVM-compatible networks mature.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
