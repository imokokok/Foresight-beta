# 📚 Foresight Developer Documentation

> Complete technical reference manual covering smart contracts, frontend architecture, API design, and deployment.

---

## 📑 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Smart Contracts](#smart-contracts)
- [Frontend Architecture](#frontend-architecture)
- [Relayer Service](#relayer-service)
- [API Reference](#api-reference)
- [Database Design](#database-design)
- [Deployment Guide](#deployment-guide)
- [Security Guidelines](#security-guidelines)
- [Testing Guide](#testing-guide)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Foresight adopts an **off-chain matching + on-chain settlement** hybrid architecture, achieving user experience close to a centralized exchange while maintaining complete decentralized settlement.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            User Interaction Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (Future)   │  │  (REST)     │  │  (Future)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Service Layer                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Relayer Service                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ Order Book  │  │  Matching   │  │  Event      │                 ││
│  │  │ Management  │  │  Engine     │  │  Ingestion  │                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌─────────────────────────────────▼───────────────────────────────────┐│
│  │                         Supabase                                    ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │  Orders     │  │  Trades     │  │  Candles    │                 ││
│  │  │  (Pending)  │  │  (History)  │  │  (OHLCV)    │                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Blockchain Layer                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ Market      │  │ Outcome     │  │ UMA Oracle  │                 ││
│  │  │ Factory     │  │ Token 1155  │  │ Adapter V2  │                 ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 ││
│  │         │                │                │                        ││
│  │  ┌──────▼────────────────▼────────────────▼──────┐                 ││
│  │  │              Market Instances                 │                 ││
│  │  └───────────────────────────────────────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

### Contract Architecture

```
packages/contracts/contracts/
├── MarketFactory.sol              # Market factory (UUPS upgradeable)
├── interfaces/
│   ├── IMarket.sol                # Market contract interface
│   ├── IOracle.sol                # Oracle interface
│   └── IOracleRegistrar.sol       # Oracle registration interface
├── templates/
│   ├── OffchainMarketBase.sol     # Base market contract
│   ├── OffchainBinaryMarket.sol   # Binary market template
│   └── OffchainMultiMarket8.sol   # Multi-outcome market template (2-8 options)
├── tokens/
│   ├── OutcomeToken1155.sol       # ERC-1155 outcome token
│   └── Foresight.sol              # Foresight governance token
├── oracles/
│   ├── ManualOracle.sol           # Manual oracle (for testing)
│   └── UMAOracleAdapterV2.sol     # UMA oracle adapter
├── governance/
│   └── ForesightTimelock.sol      # Governance timelock
└── rewards/
    └── LPFeeStaking.sol           # LP fee staking
```

### MarketFactory

The market factory is responsible for creating and managing all prediction market instances, using UUPS upgradeable pattern and minimal proxies (EIP-1167) for gas optimization.

**Core Functions:**

```solidity
// Register market template
function registerTemplate(
    bytes32 templateId,
    address implementation,
    string calldata name
) external onlyRole(ADMIN_ROLE);

// Create market
function createMarket(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256 resolutionTime,
    uint256 feeBps,
    bytes calldata initData
) external returns (address market);

// Batch create markets (admin)
function createMarkets(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256[] calldata resolutionTimes,
    uint256[] calldata feeBps,
    bytes[] calldata initDataList
) external onlyRole(ADMIN_ROLE) returns (address[] memory markets);

// Set fee
function setFee(uint256 newFeeBps, address newFeeTo) external onlyRole(ADMIN_ROLE);

// Set LP fee
function setLpFee(uint256 newLpFeeBps, address newLpFeeTo) external onlyRole(ADMIN_ROLE);

// Pause/unpause market
function pauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
function unpauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
```

**View Functions:**

```solidity
function getMarket(uint256 marketId) external view returns (MarketInfo memory);
function getMarketAddress(uint256 marketId) external view returns (address);
function isValidMarket(address market) external view returns (bool);
```

**Events:**

```solidity
event TemplateRegistered(bytes32 indexed templateId, address implementation, string name);
event TemplateRemoved(bytes32 indexed templateId);
event MarketCreated(
    uint256 indexed marketId,
    address indexed market,
    bytes32 indexed templateId,
    address creator,
    address collateralToken,
    address oracle,
    uint256 feeBps,
    uint256 resolutionTime
);
event FeeChanged(uint256 newFeeBps, address newFeeTo);
event Paused(address indexed account);
```

### OffchainMarketBase

Base contract for all market contracts, providing core functionality for order validation, minting, redemption, and settlement.

**Core Functions:**

```solidity
// Mint complete set (buy all outcomes)
function mintCompleteSets(uint256 amount18) external nonReentrant;

// Redeem complete set (when market is invalid)
function redeemCompleteSetsOnInvalid(uint256 amount18PerOutcome) external nonReentrant;

// Redeem winning outcome
function redeem(uint256 amount18, uint8 outcomeIndex) external nonReentrant;

// Assert truth via oracle
function assertTruth(
    bytes calldata claim,
    uint8 outcomeIndex,
    bytes32 identifier,
    uint256 bond
) external;
```

**EIP-712 Signature Validation:**

```solidity
function validateOrderSignature(
    Order calldata order,
    bytes calldata signature
) external view returns (bool);

function isValidSignature(
    address signer,
    bytes32 hash,
    bytes calldata signature
) external view returns (bytes4 magicValue);
```

**State Queries:**

```solidity
function getOutcomeCount() external view returns (uint8);
function getOutcomeTokenAddress() external view returns (address);
function getResolutionTime() external view returns (uint256);
```

**Events:**

```solidity
event OrderFilledSigned(
    address indexed maker,
    address indexed taker,
    uint256 indexed outcomeIndex,
    bool isBuy,
    uint256 price,
    uint256 amount,
    uint256 fee,
    uint256 salt
);
event OrderSaltCanceled(address indexed maker, uint256 salt);
event Resolved(uint256 indexed outcomeIndex);
event Invalidated();
event CompleteSetMinted(address indexed user, uint256 amount18);
event Redeemed(address indexed user, uint256 amount18, uint8 outcomeIndex);
```

### Order Structure

```solidity
struct Order {
    address maker;           // Order creator address
    uint256 outcomeIndex;    // Outcome index (0 to outcomeCount-1)
    bool isBuy;              // true=buy YES, false=sell YES
    uint256 price;           // Price (USDC 1e6 / shares 1e18)
    uint256 amount;          // Share amount (1e18 precision)
    uint256 expiry;          // Expiration timestamp
    uint256 salt;            // Unique identifier (prevents signature reuse)
}
```

**Price Calculation Example:**

- Price 0.5 USDC = 500000 (1e6)
- Amount 10 shares = 10 \* 1e18
- Total amount = 500000 _ 10 _ 1e12 / 1e6 = 5000000 USDC

### OutcomeToken1155

Shared ERC-1155 outcome token contract, all markets share the same contract instance, distinguished by Token ID.

**Token ID Calculation:**

```solidity
// Token ID = (market_address << 32) | outcomeIndex
function computeTokenId(address market, uint256 outcomeIndex) external pure returns (uint256 tokenId);

// Example: market 0x1234..., outcome 0
// tokenId = 0x1234000000000000000000000000000000000000 << 32 | 0
// = 0x1234000000000000000000000000000000000000000000000000000000000000
```

**Core Functions:**

```solidity
function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function burn(address from, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function grantMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
function revokeMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
```

### UMAOracleAdapterV2

UMA Optimistic Oracle V3 adapter for decentralized result verification.

**Core Functions:**

```solidity
// Register market
function registerMarket(
    bytes32 marketId,
    uint64 resolutionTime,
    uint8 outcomeCount
) external onlyRole(REGISTRAR_ROLE);

// Assert outcome
function assertOutcome(
    bytes32 marketId,
    uint8 outcomeIndex,
    bytes calldata claim
) external onlyRole(REPORTER_ROLE);

// Settle assertion (UMA callback)
function settleAssertion(bytes32 assertionId) external;

// Query outcome
function getOutcome(bytes32 marketId) external view returns (uint8 outcomeIndex, bool exists);
```

**Status Enum:**

```solidity
enum Status {
    NONE,      // Not started
    PENDING,   // Waiting for UMA confirmation
    RESOLVED,  // Resolved
    INVALID    // Market invalid
}
```

### Security Features

- ✅ ReentrancyGuard protection (all write functions)
- ✅ Flash loan attack protection (1M USDC per block limit)
- ✅ Batch operation size limit (max 50 orders per batch)
- ✅ Minimum order lifetime (30 seconds, prevents sandwich attacks)
- ✅ ECDSA signature malleability protection (s-value check)
- ✅ ERC-1271 smart contract wallet support (on-chain validation)
- ✅ Circuit breaker mechanism (emergency pause)
- ✅ Role-Based Access Control

### Contract Error Codes

```solidity
error InvalidOutcomeIndex();           // Invalid outcome index
error InvalidState();                  // Invalid market state
error ResolutionTimeNotReached();      // Settlement time not reached
error InvalidExpiry();                 // Order expired
error InvalidAmount();                 // Invalid amount
error InvalidPrice();                  // Invalid price
error InvalidSignedRequest();          // Signature verification failed
error OrderCanceled();                 // Order canceled
error NoMinterRole();                  // No minting permission
error FeeNotSupported();               // Unsupported fee
error MarketPaused();                  // Market paused
error NotAuthorized();                 // Unauthorized operation
error ArrayLengthMismatch();           // Array length mismatch
error BatchSizeExceeded();             // Batch size limit exceeded
error FlashLoanProtection();           // Flash loan protection triggered
error OrderLifetimeTooShort();         // Order lifetime too short
error InvalidSignatureS();             // Invalid signature s-value
```

### OffchainBinaryMarket

Binary market (YES/NO) specific contract, inherits from OffchainMarketBase.

```solidity
// Initialization data format
// abi.encode(["Yes", "No"])
```

### OffchainMultiMarket8

Multi-outcome market (2-8 options) specific contract, inherits from OffchainMarketBase.

```solidity
// Initialization data format
// abi.encode(["Option 1", "Option 2", ..., "Option N"])
// Supports 2-8 outcome options
```

---

## Frontend Architecture

### Tech Stack

| Category  | Technology           | Version |
| --------- | -------------------- | ------- |
| Framework | Next.js (App Router) | 15.5.4  |
| UI        | React                | 19      |
| Language  | TypeScript           | 5.0     |
| Styling   | Tailwind CSS         | 3.4     |
| Animation | Framer Motion        | 11      |
| State     | React Query          | 5       |
| Web3      | ethers.js            | 6       |
| i18n      | next-intl            | 3       |

### Internationalization

Frontend uses `next-intl` for internationalization. Supported languages:

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

### Directory Structure

```
apps/web/src/
├── app/                           # Next.js App Router pages
│   ├── api/                       # API routes (backend)
│   ├── prediction/[id]/           # Market detail page
│   ├── trending/                  # Trending markets list
│   ├── profile/                   # User profile
│   ├── forum/                     # Forum
│   ├── flags/                     # Flag markets
│   ├── proposals/                 # Proposal system
│   ├── admin/                     # Admin dashboard
│   └── leaderboard/               # Leaderboard
├── components/                    # React components
│   ├── market/                    # Market-related components
│   ├── chatPanel/                 # Chat panel
│   ├── topNavBar/                 # Top navigation
│   ├── ui/                        # Base UI components
│   └── walletModal/               # Wallet modal
├── contexts/                      # React Context
│   ├── AuthContext.tsx            # Authentication state
│   ├── WalletContext.tsx          # Wallet state
│   └── UserContext.tsx            # User state
├── hooks/                         # Custom hooks
│   ├── useWalletModalLogic.ts    # Wallet modal logic
│   ├── useMarketWebSocket.ts      # WebSocket connection
│   └── useInfiniteScroll.ts       # Infinite scroll
├── lib/                           # Utility libraries
│   ├── format.ts                  # Formatting utilities
│   ├── address.ts                 # Address handling
│   ├── jwt.ts                     # JWT verification
│   └── database.types.ts          # Database types
└── features/                      # Feature modules
    ├── flags/                     # Flag features
    └── predictionAdmin/           # Prediction market management
```

### Core Components

**Trading Panel:**

```typescript
// Trade parameters interface
interface TradeParams {
  outcomeIndex: number; // Outcome index
  isBuy: boolean; // Buy/sell
  price: string; // Price (USDC)
  amount: string; // Amount (shares)
  salt: string; // Random number
  expiry: number; // Expiration time
}

// Submit order flow
async function submitOrder(params: TradeParams, signature: string) {
  const response = await fetch("/api/orderbook/order", {
    method: "POST",
    body: JSON.stringify({ order: params, signature }),
  });
  return response.json();
}
```

---

## Relayer Service

### Architecture Overview

Relayer is the core infrastructure of Foresight prediction market, using off-chain matching + on-chain settlement hybrid architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Relayer Service                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  REST API   │   │  WebSocket  │   │  Metrics    │           │
│  │  /v2/*      │   │  :3006      │   │  /metrics   │           │
│  └──────┬──────┘   └──────┬──────┘   └─────────────┘           │
│         │                 │                                     │
│         ▼                 ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Matching Engine                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │    │
│  │  │ Order    │ │ Order    │ │ Trade    │                │    │
│  │  │ Validate │ │ Match    │ │ Execute  │                │    │
│  │  └──────────┘ └──────────┘ └──────────┘                │    │
│  └────────────────────────────────────────────────────────┘    │
│                          │                                      │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Supabase   │  │  Redis      │  │  Blockchain │            │
│  │  (Orders/   │  │  (Cache/    │  │  (Settle)   │            │
│  │   Trades)   │  │   Pub/Sub)  │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

**Order Validator:** Validates EIP-712 signatures, order parameters, and replay protection.

**Matching Engine:** High-performance order matching, supporting limit orders, market orders, and multiple order types.

**Trade Executor:** Batch submits on-chain settlement transactions, manages gas optimization and retry mechanism.

**Event Ingestion:** Listens to on-chain events, updates order status and balances.

### v2 Matching Engine API (Recommended)

| Method | Endpoint               | Description                                                 |
| ------ | ---------------------- | ----------------------------------------------------------- |
| POST   | `/v2/orders`           | Submit order and match (returns match result and remaining) |
| GET    | `/v2/depth`            | Get orderbook depth (memory snapshot)                       |
| GET    | `/v2/stats`            | Get market stats (bestBid/bestAsk, etc.)                    |
| GET    | `/v2/ws-info`          | Get WS connection info and subscribe channels               |
| POST   | `/v2/register-settler` | Register settler/Operator for marketKey                     |
| GET    | `/v2/settlement-stats` | Get settlement stats (aggregated)                           |
| GET    | `/v2/operator-status`  | Get Operator status for a marketKey                         |

### Compatible API (DB-driven Orderbook)

| Method | Endpoint                  | Description                                                 |
| ------ | ------------------------- | ----------------------------------------------------------- |
| POST   | `/orderbook/orders`       | Submit signed order (write to orders table)                 |
| POST   | `/orderbook/cancel-salt`  | Sign cancel single salt (write to orders status)            |
| GET    | `/orderbook/depth`        | Get depth (prefer depth_levels / fallback aggregate orders) |
| GET    | `/orderbook/queue`        | Get order queue for a price level                           |
| POST   | `/orderbook/report-trade` | Backfill trades via txHash (on-chain events)                |

### System API

| Method | Endpoint   | Description        |
| ------ | ---------- | ------------------ |
| GET    | `/health`  | Health check       |
| GET    | `/ready`   | Readiness check    |
| GET    | `/metrics` | Prometheus metrics |
| GET    | `/version` | Version info       |

**Health Check Response Example:**

```json
{
  "status": "healthy",
  "timestamp": "2024-12-27T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.1.0",
  "checks": {
    "supabase": { "status": "pass", "latency": 45 },
    "redis": { "status": "pass", "latency": 2 },
    "rpc": { "status": "pass", "latency": 150 },
    "matching_engine": { "status": "pass", "message": "Active markets: 5" }
  }
}
```

### WebSocket Real-time Data

```javascript
// Connect
const ws = new WebSocket("ws://relayer.foresight.io:3006");

// Subscribe to depth
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "depth",
    marketKey: "80002:1",
    outcomeIndex: 0,
  })
);

// Subscribe to trades
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "trades",
    marketKey: "80002:1",
  })
);

// Subscribe to candles
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "candles",
    marketKey: "80002:1",
    outcomeIndex: 0,
    resolution: "1m",
  })
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**WebSocket Message Types:**

```typescript
interface DepthUpdate {
  type: "depth";
  marketKey: string;
  outcomeIndex: number;
  bids: [price: string, amount: string][];
  asks: [price: string, amount: string][];
  timestamp: number;
}

interface TradeUpdate {
  type: "trade";
  marketKey: string;
  outcomeIndex: number;
  price: string;
  amount: string;
  maker: string;
  taker: string;
  timestamp: number;
}

interface CandleUpdate {
  type: "candle";
  marketKey: string;
  outcomeIndex: number;
  resolution: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: number;
}
```

### Prometheus Monitoring Metrics

| Metric                               | Description             |
| ------------------------------------ | ----------------------- |
| `foresight_orders_total`             | Total orders submitted  |
| `foresight_orders_active`            | Active orders           |
| `foresight_matches_total`            | Total matches           |
| `foresight_matching_latency_ms`      | Matching latency (ms)   |
| `foresight_matched_volume_total`     | Trading volume          |
| `foresight_settlement_batches_total` | Settlement batches      |
| `foresight_settlement_pending_fills` | Pending settlements     |
| `foresight_settlement_latency_ms`    | Settlement latency (ms) |
| `foresight_ws_connections_active`    | WebSocket connections   |

### Configuration

```env
RELAYER_PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
WS_PORT=3006
RELAYER_CORS_ORIGINS=http://localhost:3000
OPERATOR_PRIVATE_KEY=0x...
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Running Relayer

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Using Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 -p 3006:3006 foresight-relayer

# Using PM2
pm2 start dist/index.js --name foresight-relayer
```

### Grafana Dashboard

```bash
docker-compose -f docker-compose.monitoring.yml up -d
# Access http://localhost:3030
# Default credentials: admin / foresight123
```

---

## API Reference

### Authentication (SIWE)

```text
GET /api/siwe/nonce          # Generate nonce
POST /api/siwe/verify         # Verify signature and login
GET /api/siwe/logout         # Logout
POST /api/siwe/logout        # Logout
```

### Email Authentication

```text
POST /api/email-otp/request        # Request OTP
POST /api/email-otp/verify         # Verify OTP
POST /api/email-otp/complete-signup # Complete signup
POST /api/email-magic-link/request  # Request magic link
POST /api/email-magic-link/verify   # Verify magic link
```

### Traditional Authentication

```text
POST /api/auth/login      # Login
POST /api/auth/register   # Register
GET /api/auth/me          # Get current user
GET /api/auth/sessions    # Session list
POST /api/auth/sessions   # Create session
DELETE /api/auth/sessions # Delete session
POST /api/auth/delete-account # Delete account
```

### Rate Limiting

| Tier     | Requests/Minute | Use Case             |
| -------- | --------------- | -------------------- |
| strict   | 5               | High-risk operations |
| moderate | 20              | Regular users        |
| relaxed  | 60              | High-frequency reads |
| lenient  | 120             | Public data queries  |

### Market Data API

```text
GET /api/markets/map           # Market map
GET /api/markets/summary       # Market summary
GET /api/orderbook/order       # Orderbook
POST /api/orderbook/order      # Submit order
GET /api/orderbook/depth       # Order depth
GET /api/orderbook/candles     # Candlestick data
GET /api/orderbook/trades      # Trade history
GET /api/orderbook/quote       # Quote estimation
POST /api/orderbook/cancel-salt # Cancel order
POST /api/orderbook/report-trade # Report trade
POST /api/orderbook/orders/fill # Order fill
GET /api/orderbook/market-plan # Market plan preview
```

### Prediction Market API

```text
GET /api/predictions           # Market list
POST /api/predictions          # Create market (admin)
GET /api/predictions/[id]      # Market detail
GET /api/predictions/[id]/stats # Market stats
```

### User Assets API

```text
GET /api/user-balance          # User balance
POST /api/user-balance         # Deposit
GET /api/deposits/history      # Deposit history
GET /api/history               # Trade history
POST /api/history              # Position history
GET /api/user-portfolio        # Portfolio
POST /api/user-portfolio/compute # Compute PnL
```

### Social System API

```text
POST /api/follows              # Follow user
DELETE /api/follows            # Unfollow user
GET /api/follows               # Following list
POST /api/follows/counts       # Follow counts
GET /api/user-follows          # User follows
POST /api/user-follows/user    # Follow operation
GET /api/user-follows/counts   # Follow counts
```

### Discussions API

```text
GET /api/discussions           # Discussion list
POST /api/discussions          # Create discussion
PATCH /api/discussions/[id]    # Update discussion
DELETE /api/discussions/[id]   # Delete discussion
POST /api/discussions/report   # Report discussion
```

### Forum API

```text
GET /api/forum                 # Forum list
POST /api/forum                # Create thread
POST /api/forum/comments       # Create comment
POST /api/forum/vote           # Vote
GET /api/forum/user-votes      # User votes
POST /api/forum/report         # Report
```

### Flag Market API

```text
GET /api/flags                 # Flag list
POST /api/flags                # Create flag (admin)
POST /api/flags/[id]/checkin   # Check in
GET /api/flags/[id]/checkins   # Check-in list
POST /api/flags/[id]/settle    # Settle flag
POST /api/checkins/[id]/review # Review check-in
```

### Leaderboard API

```text
GET /api/leaderboard           # Leaderboard
POST /api/leaderboard          # Update leaderboard
```

### Search API

```text
GET /api/search                # Search
POST /api/search               # Advanced search
```

### User Profile API

```text
GET /api/user-profiles         # User profile
POST /api/user-profiles        # Update profile
```

### Categories API

```text
GET /api/categories            # Category list
GET /api/categories/counts     # Category counts
```

### Notifications API

```text
GET /api/notifications         # Notification list
GET /api/notifications/unread-count # Unread count
POST /api/notifications/read   # Mark as read
POST /api/notifications/archive # Archive
```

### Analytics API

```text
POST /api/analytics/events     # Report event
GET /api/analytics/events      # Query events
POST /api/analytics/vitals     # Web Vitals
```

### Health Check

```text
GET /api/health                # Health check
```

### AA Account Migration

```text
POST /api/aa/owner-migration   # Migrate ownership
POST /api/aa/userop/draft      # Draft UserOperation
POST /api/aa/userop/simulate   # Simulate UserOperation
POST /api/aa/userop/submit     # Submit UserOperation
```

### Proxy Wallet

```text
POST /api/wallets/proxy        # Create proxy wallet
```

### Emojis and Stickers

```text
GET /api/emojis                # Emoji list
POST /api/emojis               # Use emoji
GET /api/stickers              # Sticker list
POST /api/stickers             # Buy sticker
```

### Upload API

```text
POST /api/upload               # Upload file
```

### Admin API

```text
GET /api/admin/roles           # Role list
POST /api/admin/roles          # Create role
GET /api/admin/performance     # Performance monitoring
GET /api/review/proposals      # Proposal review list
POST /api/review/proposals     # Review proposal
GET /api/review/proposals/[id] # Proposal detail
```

---

## Database Design

### Core Tables

```sql
-- Orders (written by Relayer)
CREATE TABLE IF NOT EXISTS public.orders (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  verifying_contract TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  market_key TEXT,
  maker_address TEXT NOT NULL,
  maker_salt TEXT NOT NULL,
  outcome_index INTEGER NOT NULL,
  is_buy BOOLEAN NOT NULL,
  price TEXT NOT NULL,
  amount TEXT NOT NULL,
  remaining TEXT NOT NULL,
  expiry TIMESTAMPTZ NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades (on-chain events)
CREATE TABLE IF NOT EXISTS public.trades (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  network_id INTEGER NOT NULL,
  market_address TEXT NOT NULL,
  outcome_index INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  taker_address TEXT NOT NULL,
  maker_address TEXT NOT NULL,
  is_buy BOOLEAN NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candles (OHLCV)
CREATE TABLE IF NOT EXISTS public.candles (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  network_id INTEGER NOT NULL,
  market_address TEXT NOT NULL,
  outcome_index INTEGER NOT NULL,
  resolution TEXT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Deployment Guide

### Smart Contracts

```bash
# 1. Configure environment variables
export PRIVATE_KEY=your_deployer_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# 2. Compile contracts
npx hardhat compile

# 3. Deploy
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy
```

### Frontend

```bash
# 1. Build
cd apps/web
npm run build

# 2. Deploy to Vercel
vercel deploy --prod
```

### Relayer

```bash
# 1. Build
cd services/relayer
npm run build

# 2. Run with PM2
pm2 start dist/index.js --name foresight-relayer

# 3. Or use Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 foresight-relayer
```

---

## Security Guidelines

### Smart Contract Security

1. **Reentrancy Protection**: All state-modifying functions use `ReentrancyGuard`
2. **Access Control**: Using OpenZeppelin AccessControl
3. **Flash Loan Protection**: Single-block transaction limit
4. **Signature Security**: ECDSA malleability check
5. **Circuit Breaker**: Emergency pause functionality

### Frontend Security

1. **Input Validation**: Use `validateAndSanitize` to sanitize user input
2. **XSS Protection**: Never render raw user input directly
3. **CSRF Protection**: API uses signature verification
4. **Rate Limiting**: Use `withRateLimit` wrapper for API routes

---

## Testing Guide

### Smart Contract Testing

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/SecurityTests.test.cjs

# Generate coverage report
npx hardhat coverage
```

### Frontend Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run tests with report
npm run test:web -- --run
```

### Relayer Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

### Testing Key Points

1. **Signature Verification**: Ensure EIP-712 signature validation works correctly
2. **Order Matching**: Verify limit order and market order matching logic
3. **Settlement Process**: Test market settlement and profit calculation
4. **Security Protection**: Verify reentrancy protection and flash loan protection
5. **Concurrency Handling**: Test stability under high concurrency scenarios

---

## Troubleshooting

### Common Issues

**Issue: Order submission failed**

1. Check if signature is valid and not expired
2. Confirm order parameter format (price/amount precision)
3. Verify account balance is sufficient
4. Check if replay protection was triggered

**Issue: WebSocket connection disconnected**

1. Check network connection stability
2. Confirm WebSocket port is correct (default 3006)
3. Check if firewall blocks the connection
4. Try reconnecting (implement auto-reconnect mechanism)

**Issue: Contract call failed**

1. Check if RPC URL is accessible
2. Confirm wallet balance is sufficient
3. Verify contract address is correct
4. Check if gas limit was triggered

**Issue: High matching latency**

1. Check Relayer service status
2. Check Supabase query performance
3. Confirm network latency is normal
4. Check if there are many pending orders

### Log Viewing

```bash
# Relayer logs
tail -f services/relayer/logs/app.log

# Frontend logs (browser console)
# Open browser developer tools

# Contract logs (blockchain explorer)
# View transaction details on PolygonScan
```

### Monitoring Metrics

```bash
# View Prometheus metrics
curl http://localhost:3001/metrics

# View Grafana dashboard
open http://localhost:3030
```

### Performance Optimization Tips

1. **Database Queries**: Use indexes to optimize query performance
2. **Caching Strategy**: Use Redis caching for hot data
3. **Batch Operations**: Use batch operations to reduce on-chain transactions
4. **Gas Optimization**: Use ERC-1155 to reduce contract calls
5. **CDN Acceleration**: Use CDN for static resources

---

## More Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [UMA Protocol](https://docs.uma.xyz)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Polygon Documentation](https://docs.polygon.technology)

---

**Last Updated**: 2026-01-27  
**Documentation Version**: v3.0

---

**Languages:**

- English (this document)
