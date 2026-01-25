<p align="center">
  <img src="apps/web/public/images/logo.png" alt="Foresight Logo" width="120" />
</p>

<h1 align="center">🔮 Foresight</h1>

<p align="center">
  <strong>Next-Generation Decentralized Prediction Market Protocol</strong><br/>
  <em>Professional Trading Experience × UMA Oracle Decentralized Settlement × Web3 Native Architecture</em>
</p>

<p align="center">
  <a href="https://foresight.market">Website</a> •
  <a href="./DOCS.md">Documentation</a> •
  <a href="https://twitter.com/ForesightMarket">Twitter</a> •
  <a href="https://discord.gg/foresight">Discord</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Polygon-Amoy-8247E5?logo=polygon" alt="Polygon" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 🌟 Why Foresight?

### Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Foresight Technical Architecture                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   User Interface (Next.js 15)                                           │
│   ├── Responsive design, mobile-first                                   │
│   ├── Real-time order book depth display                                │
│   └── Seamless Web3 wallet integration                                  │
│                     │                                                    │
│                     ▼                                                    │
│   Off-chain Order Book (Relayer Service)                                │
│   ├── EIP-712 signed orders                                             │
│   ├── High-performance matching engine                                  │
│   └── Supabase real-time data synchronization                           │
│                     │                                                    │
│                     ▼                                                    │
│   Smart Contract Layer (Polygon)                                        │
│   ├── MarketFactory: Market factory (UUPS upgradeable)                  │
│   ├── OffchainBinaryMarket: Binary market template                      │
│   ├── OffchainMultiMarket8: Multi-outcome market template (up to 8)     │
│   ├── OutcomeToken1155: ERC-1155 outcome tokens                         │
│   └── UMAOracleAdapterV2: UMA oracle adapter                            │
│                     │                                                    │
│                     ▼                                                    │
│   Settlement Layer (UMA Protocol)                                       │
│   ├── Optimistic oracle mechanism                                       │
│   ├── Decentralized dispute arbitration                                 │
│   └── Economic incentives ensure truthfulness                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Runtime Security & Observability

- **Security Headers & CSP**
  - Strict security headers configured via Next.js, production disables unsafe-inline/unsafe-eval
  - Reference: [next.config.ts](file:///Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/next.config.ts#L70-L129)
- **Global Middleware**
  - Injects and propagates x-request-id throughout server logs and event chains
  - Applies strict rate limiting to /api/siwe/verify (5 requests/minute/IP)
  - Reference: [middleware.ts](file:///Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/src/middleware.ts)
- **Rate Limiting Strategy**
  - Upstash Redis preferred; falls back to in-memory implementation (dev environment)
  - Tiers: strict/moderate/relaxed/lenient; returns remaining quota and reset time
  - Reference: [rateLimit.ts](file:///Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/src/lib/rateLimit.ts)
- **Events & RED Metrics**
  - logApiEvent prints in development, persists to Supabase analytics_events in production
  - Admins can pull RED aggregated views by minute
  - Reference: [serverUtils.ts](file:///Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/src/lib/serverUtils.ts#L139-L156), [analytics/events](file:///Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/src/app/api/analytics/events/route.ts)

---

## ✨ Product Features

### 🎯 Prediction Markets

- **Binary Markets**: YES/NO simple and intuitive predictions
- **Multi-Outcome Markets**: Complex events supporting 2-8 options
- **Real-Time Odds**: Dynamic pricing based on order book
- **Zero Gas Trading**: Off-chain signatures, on-chain settlement

### 🤝 Social, Chat & Gamification

- **Follow System**: Track top traders and get real-time updates on their activities
- **User Cards**: Hover to view any user's win rate, PnL, and professional data
- **Leaderboards**: Real-time profit rankings with multi-dimensional filtering (PnL, win rate, streak)
- **Real-Time Discussions**: Each proposal/event has a dedicated chat room, supporting images, replies, deletion, and reports; new messages pushed via Supabase Realtime
- **Forum Proposals**: Subject + comment tree + voting mechanism, aggregated by eventId, suitable for turning "market ideas" into reviewable proposals
- **Wish Flags**: Three verification paths (self/witness/official); daily check-ins + expiry settlement; tiered sticker rewards based on completion span, building a growth trajectory

**API Quick Reference (consistent with docs/code)**

```text
# Chat / Discussions
GET    /api/discussions?proposalId=1
POST   /api/discussions
PATCH  /api/discussions/[id]
DELETE /api/discussions/[id]
POST   /api/discussions/report

# Flag
GET  /api/flags
POST /api/flags
POST /api/flags/[id]/checkin
POST /api/flags/[id]/settle

# Forum
GET  /api/forum?eventId=1
POST /api/forum
POST /api/forum/comments
POST /api/forum/vote
GET  /api/forum/user-votes?eventId=1
```

### 💰 Professional Trading Experience

- **Limit Orders**: Precise entry price control
- **Market Orders**: Instant execution at best price
- **Depth Charts**: Visualize buy/sell order distribution
- **Candlestick Charts**: Professional-grade price trend analysis

### 🔐 Security & Decentralization

- **UMA Oracle**: Decentralized result verification
- **Multi-Sig Governance**: 3/5 multisig + 24h Timelock
- **Flash Loan Protection**: Single-block transaction limit
- **Signature Security**: ECDSA malleability protection

### 👛 Wallet Support

- MetaMask
- Coinbase Wallet
- WalletConnect
- More wallets coming soon...

### 🌍 Internationalization

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇫🇷 Français
- 🇰🇷 한국어
- 🇪🇸 Español

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm (recommended)
- Git

### Installation & Running

```bash
# Clone the repository
git clone https://github.com/Foresight-builder/Foresight-beta.git
cd Foresight-beta

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with required configuration

# Start Web + Relayer (recommended)
npm run dev

# Start Web only (optional)
# npm run dev:web

# Start Relayer only (optional)
# npm run dev:relayer

# Visit http://localhost:3000
```

### Environment Variables

```env
# Supabase (Web)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase (Relayer / Backend scripts)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Blockchain
NEXT_PUBLIC_CHAIN_ID=80002
NEXT_PUBLIC_RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=your_deployer_private_key

# Contract addresses (Polygon Amoy)
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_OUTCOME_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_UMA_ADAPTER_ADDRESS=0x...

# Relayer
NEXT_PUBLIC_RELAYER_URL=http://localhost:3001

# Relayer (Chain settlement Operator, optional: needed for settlement/AA capabilities)
OPERATOR_PRIVATE_KEY=your_operator_private_key
```

---

## 🏗️ Project Architecture

```
Foresight-beta/
├── apps/
│   └── web/                      # Next.js 15 frontend application
│       ├── src/
│       │   ├── app/              # App Router pages
│       │   ├── components/       # React component library
│       │   ├── contexts/         # Global state management
│       │   ├── hooks/            # Custom hooks
│       │   └── lib/              # Utility library
│       └── messages/             # i18n translation files
│
├── packages/
│   └── contracts/                # Solidity smart contracts
│       └── contracts/
│           ├── MarketFactory.sol           # Market factory
│           ├── templates/                  # Market templates
│           │   ├── OffchainMarketBase.sol  # Base contract
│           │   ├── OffchainBinaryMarket.sol
│           │   └── OffchainMultiMarket8.sol
│           ├── tokens/
│           │   └── OutcomeToken1155.sol    # ERC-1155 token
│           ├── oracles/
│           │   └── UMAOracleAdapterV2.sol  # UMA adapter
│           └── governance/
│               └── ForesightTimelock.sol   # Governance timelock
│
├── services/
│   └── relayer/                  # Off-chain order book service
│       └── src/
│           ├── index.ts          # Express server
│           ├── orderbook.ts      # Order book logic
│           └── supabase.ts       # Database interaction
│
├── infra/
│   └── supabase/                 # Database scripts
│       ├── sql/                  # SQL migration files
│       └── scripts/              # Management scripts
│
└── scripts/                      # Deployment scripts
    └── deploy_offchain_sprint1.ts
```

---

## 📊 Technical Specifications

### Smart Contracts

| Contract               | Description                 | Audit Status   |
| ---------------------- | --------------------------- | -------------- |
| `MarketFactory`        | UUPS upgradeable market     | 🔄 In Progress |
| `OffchainBinaryMarket` | Binary market (YES/NO)      | 🔄 In Progress |
| `OffchainMultiMarket8` | Multi-outcome (2-8 options) | 🔄 In Progress |
| `OutcomeToken1155`     | ERC-1155 outcome token      | 🔄 In Progress |
| `UMAOracleAdapterV2`   | UMA oracle integration      | 🔄 In Progress |
| `ForesightTimelock`    | Governance timelock         | 🔄 In Progress |

### Security Features

- ✅ ReentrancyGuard reentrancy protection
- ✅ Flash loan attack protection (single-block limit)
- ✅ Batch operation size limit (DoS prevention)
- ✅ Minimum order lifetime (sandwich attack prevention)
- ✅ ECDSA signature malleability protection
- ✅ ERC-1271 smart contract wallet support
- ✅ Circuit breaker mechanism (emergency pause)

### Performance Targets

| Metric                | Target  |
| --------------------- | ------- |
| LCP                   | < 2.5s  |
| INP                   | < 200ms |
| CLS                   | < 0.1   |
| API Response (cached) | < 50ms  |

---

## 🔗 Deployed Contracts

### Polygon Amoy Testnet

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| MarketFactory               | `0x0762A2EeFEB20f03ceA60A542FfC8EC85FE8A30`  |
| OutcomeToken1155            | `0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087` |
| UMAOracleAdapterV2          | `0x5e42fce766Ad623cE175002B7b2528411C47cc92` |
| OffchainBinaryMarket (impl) | `0x846145DC2850FfB97D14C4AF79675815b6D7AF0f` |
| OffchainMultiMarket8 (impl) | `0x1e8BeCF558Baf0F74cEc2D7fa7ba44F0335282e8` |

---

## 🛣️ Roadmap

### Phase 1: Infrastructure ✅

- [x] Core smart contract development
- [x] Off-chain order book service
- [x] Frontend trading interface
- [x] UMA oracle integration

### Phase 2: Security Hardening ✅

- [x] Multi-sig governance system
- [x] Timelock mechanism
- [x] Security audit preparation
- [x] Attack mitigation measures

### Phase 3: Feature Enhancement ✅

- [x] Social feature enhancement (follows, user cards)
- [x] Gamified Flag system deep refactor (immersive 3-step flow & luminous aesthetics)
- [x] Leaderboard search & multi-dimensional sorting (PnL, win rate, streak)
- [x] Real-time "Trending Now" prediction aggregation
- [x] Personal ranking tracking (My Spot)

### Phase 4: Ecosystem Expansion 🔄

- [ ] Mobile App
- [ ] API开放平台
- [ ] 多链部署
- [ ] DAO治理
- [ ] 预言机网络扩展
- [ ] 机构级API

---

## 📚 Documentation Navigation

| Document                                               | Description             |
| ------------------------------------------------------ | ----------------------- |
| [DOCS.md](./DOCS.md)                                   | Developer documentation |
| [DOCS.zh-CN.md](./DOCS.zh-CN.md)                       | 开发者文档 (Chinese)    |
| [DOCS.es.md](./DOCS.es.md)                             | Documentación (Spanish) |
| [DOCS.fr.md](./DOCS.fr.md)                             | Documentation (French)  |
| [DOCS.ko.md](./DOCS.ko.md)                             | 문서 (Korean)           |
| [SECURITY.md](./SECURITY.md)                           | Security policy         |
| [SECURITY.zh-CN.md](./SECURITY.zh-CN.md)               | 安全政策 (Chinese)      |
| [CHANGELOG.md](./CHANGELOG.md)                         | Changelog               |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)             | Code of conduct         |
| [CODE_OF_CONDUCT.zh-CN.md](./CODE_OF_CONDUCT.zh-CN.md) | 行为准则 (Chinese)      |
| [Relayer README](./services/relayer/README.md)         | Relayer documentation   |

---

## 🤝 Contributing

We welcome community contributions! Please see [CONTRIBUTING](./CONTRIBUTING.md) for detailed guidelines (if available in your language).

```bash
# Fork this repository
# Create a feature branch
git checkout -b feature/amazing-feature

# Commit changes (follow Conventional Commits)
git commit -m 'feat(market): add amazing feature'

# Push to branch
git push origin feature/amazing-feature

# Create a Pull Request
```

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

---

## 📞 Contact Us

<p align="center">
  <a href="https://foresight.market">🌐 Website</a> •
  <a href="https://twitter.com/ForesightMarket">🐦 Twitter</a> •
  <a href="https://discord.gg/foresight">💬 Discord</a> •
  <a href="mailto:hello@foresight.market">📧 Email</a>
</p>

---

<p align="center">
  <strong>Built with ❤️ by the Foresight Team</strong><br/>
  <em>Predicting the future, one market at a time.</em>
</p>
