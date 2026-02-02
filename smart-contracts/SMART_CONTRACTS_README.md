# Smart Contracts Guide (TipSplitter)

This directory contains the smart contracts for **OnlyTokens Tips**, specifically the `TipSplitter` contract used for single-transaction direct tipping on EVM chains (like Base).

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed (v18+ recommended).
2.  **Dependencies**: Install the Hardhat dependencies:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    The deployment script relies on variables set in `frontend/.env.local` (shared env file).
    Ensure the following are set in `frontend/.env.local`:
    ```env
    NEXT_PUBLIC_FEE_ADDRESS=0xYourFeeAddressHere...
    PRIVATE_KEY=0xYourPrivateKeyHere...
    ```

## 1. Compile

To compile the Solidity contracts:

```bash
npx hardhat compile
```

Artifacts will be generated in the `artifacts/` directory.

## 2. Test

Run the Hardhat test suite to verify contract logic (Admin, Fee, Tipping):

```bash
npx hardhat test
```

## 3. Deploy

To deploy the contract to a network (e.g., Base Mainnet):

**Base Mainnet:**
```bash
npx hardhat run scripts/deploy.ts --network base
```

**Base Sepolia (Testnet):**
```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### Post-Deployment
After successful deployment:
1.  Copy the **Contract Address** from the console output.
2.  Add it to your `frontend/.env.local`:
    ```env
    NEXT_PUBLIC_SPLITTER_ADDRESS=0xTheDeployedContractAddress
    ```
3.  Restart your frontend (`npm run dev`) to enable the Single-Transaction Direct Tip feature.

## Contract Details

**TipSplitter.sol**
- **Role**: Splits incoming ETH tips.
- **Rules**:
    - **Fee**: Configurable (Default 1%).
    - **Recipient**: 100% - Fee.
    - **Admin**: The deployer. Can update Fee Address and Fee Percentage.

## Admin Actions

You can use Hardhat console or scripts to call admin functions:
- `setAdmin(address)`
- `setFeeAddress(address)`
- `setFeeBasisPoints(uint256)` (e.g., 100 = 1%)
