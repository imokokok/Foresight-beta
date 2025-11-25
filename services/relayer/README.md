# Foresight Relayer

This is a simplified ERC-4337 Bundler/Relayer for the Foresight prediction market platform. It's responsible for receiving signed `UserOperation` objects from the frontend, bundling them into a transaction, and sending them to the `EntryPoint` contract on the blockchain.

## How it Works

1.  The relayer runs an Express server, exposing a single API endpoint at `/`.
2.  The frontend sends a POST request to this endpoint with the signed `UserOperation` and the `EntryPoint` contract address.
3.  The relayer uses its own EOA wallet (the "Bundler") to call the `handleOps` function on the `EntryPoint` contract.
4.  The Bundler pays for the gas fees, effectively providing a gas-less experience for the end-user.
5.  The `EntryPoint` contract verifies the `UserOperation` and executes the transaction on behalf of the user's Smart Contract Wallet.

## Setup and Configuration

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure the Relayer**:
    Open `src/config.ts` and replace the placeholder values:

    *   `BUNDLER_PRIVATE_KEY`: **[CRITICAL]** This is the private key of the wallet that will pay for gas. This wallet must be funded with the native currency of the target blockchain (e.g., ETH on Ethereum, MATIC on Polygon).
    *   `RPC_URL`: The HTTP RPC endpoint of the blockchain node you want to connect to (e.g., from Infura, Alchemy, or your own local node).

## Running the Relayer

Since this is a TypeScript project, you'll need to compile and run the code.

1.  **Install TypeScript and ts-node (if you haven't already)**:
    ```bash
    npm install -g typescript ts-node
    ```

2.  **Run the server**:
    ```bash
    ts-node src/index.ts
    ```

    You should see the following output if it starts successfully:
    ```
    Bundler address: 0x...
    Relayer server listening on port 3000
    ```

## Frontend Integration

Your frontend needs to construct and sign a `UserOperation` and then send it to this relayer.

**Example Request**:

*   **URL**: `http://localhost:3000/`
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json`
*   **Body**:

    ```json
    {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "eth_sendUserOperation",
      "params": [
        {
          "sender": "0x...", // User's Smart Contract Wallet address
          "nonce": "0x0",
          "initCode": "0x",
          "callData": "0x...", // The encoded function call to the target contract
          "callGasLimit": "0x...",
          "verificationGasLimit": "0x...",
          "preVerificationGas": "0x...",
          "maxFeePerGas": "0x...",
          "maxPriorityFeePerGas": "0x...",
          "paymasterAndData": "0x",
          "signature": "0x..." // Signature over the UserOpHash
        },
        "0x..." // EntryPoint contract address
      ]
    }
    ```

**Note**: The body structure mimics the standard `eth_sendUserOperation` RPC method for compatibility with ERC-4337 client libraries.