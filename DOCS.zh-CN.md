# 📚 Foresight 开发者文档

> 完整的技术参考手册，涵盖智能合约、前端架构、API 设计和部署运维。

---

## 📑 目录

- [架构概览](#架构概览)
- [智能合约](#智能合约)
- [前端架构](#前端架构)
- [Relayer 服务](#relayer-服务)
- [API 参考](#api-参考)
- [数据库设计](#数据库设计)
- [部署指南](#部署指南)
- [安全规范](#安全规范)
- [测试指南](#测试指南)
- [故障排除](#故障排除)

---

## 架构概览

Foresight 采用 **链下撮合 + 链上结算** 的混合架构，实现了接近中心化交易所的用户体验，同时保持完全的去中心化结算。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (Future)   │  │  (REST)     │  │  (Future)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              服务层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Relayer Service                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ Order Book  │  │  Matching   │  │  Event      │                 ││
│  │  │ Management  │  │  Engine     │  │  Ingestion  │                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                      │
│  ┌─────────────────────────────────▼───────────────────────────────────┐│
│  │                         Supabase                                    ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │  Orders     │  │  Trades     │  │  Candles    │                 ││
│  │  │  (待成交)   │  │  (历史成交) │  │  (K线数据)  │                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              区块链层                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ Market      │  │ Outcome     │  │ UMA Oracle  │                 ││
│  │  │ Factory     │  │ Token 1155  │  │ Adapter V2  │                 ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 ││
│  │         │                │                │                         ││
│  │  ┌──────▼────────────────▼────────────────▼──────┐                 ││
│  │  │              Market Instances                 │                 ││
│  │  └───────────────────────────────────────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 智能合约

### 合约架构

```
packages/contracts/contracts/
├── MarketFactory.sol              # 市场工厂（UUPS 可升级）
├── interfaces/
│   ├── IMarket.sol                # 市场合约接口
│   ├── IOracle.sol                # 预言机接口
│   └── IOracleRegistrar.sol       # 预言机注册接口
├── templates/
│   ├── OffchainMarketBase.sol     # 市场基础合约
│   ├── OffchainBinaryMarket.sol   # 二元市场模板
│   └── OffchainMultiMarket8.sol   # 多元市场模板（2-8 选项）
├── tokens/
│   ├── OutcomeToken1155.sol       # ERC-1155 结果代币
│   └── Foresight.sol              # Foresight 治理代币
├── oracles/
│   ├── ManualOracle.sol           # 手动预言机（测试用）
│   └── UMAOracleAdapterV2.sol     # UMA 预言机适配器
├── governance/
│   └── ForesightTimelock.sol      # 治理时间锁
└── rewards/
    └── LPFeeStaking.sol           # LP 费用质押
```

### MarketFactory

市场工厂负责创建和管理所有预测市场实例，采用 UUPS 可升级模式和最小代理（EIP-1167）实现 gas 优化。

**核心函数：**

```solidity
// 注册市场模板
function registerTemplate(
    bytes32 templateId,
    address implementation,
    string calldata name
) external onlyRole(ADMIN_ROLE);

// 创建市场
function createMarket(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256 resolutionTime,
    uint256 feeBps,
    bytes calldata initData
) external returns (address market);

// 批量创建市场（管理员）
function createMarkets(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256[] calldata resolutionTimes,
    uint256[] calldata feeBps,
    bytes[] calldata initDataList
) external onlyRole(ADMIN_ROLE) returns (address[] memory markets);

// 设置手续费
function setFee(uint256 newFeeBps, address newFeeTo) external onlyRole(ADMIN_ROLE);

// 设置 LP 手续费
function setLpFee(uint256 newLpFeeBps, address newLpFeeTo) external onlyRole(ADMIN_ROLE);

// 暂停/恢复市场
function pauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
function unpauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
```

**查询函数：**

```solidity
function getMarket(uint256 marketId) external view returns (MarketInfo memory);
function getMarketAddress(uint256 marketId) external view returns (address);
function isValidMarket(address market) external view returns (bool);
```

**事件：**

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

所有市场合约的基类，提供订单验证、铸造、赎回和结算的核心功能。

**核心函数：**

```solidity
// 铸造完整组合（买入所有结果）
function mintCompleteSets(uint256 amount18) external nonReentrant;

// 赎回完整组合（市场无效时）
function redeemCompleteSetsOnInvalid(uint256 amount18PerOutcome) external nonReentrant;

// 赎回获胜结果
function redeem(uint256 amount18, uint8 outcomeIndex) external nonReentrant;

// 预言机断言结果
function assertTruth(
    bytes calldata claim,
    uint8 outcomeIndex,
    bytes32 identifier,
    uint256 bond
) external;
```

**EIP-712 签名验证：**

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

**状态查询：**

```solidity
function getOutcomeCount() external view returns (uint8);
function getOutcomeTokenAddress() external view returns (address);
function getResolutionTime() external view returns (uint256);
```

**事件：**

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

### 订单结构

```solidity
struct Order {
    address maker;           // 挂单者地址
    uint256 outcomeIndex;    // 结果索引（0 到 outcomeCount-1）
    bool isBuy;              // true=买入 YES，false=卖出 YES
    uint256 price;           // 价格（USDC 精度 1e6 / 份额精度 1e18）
    uint256 amount;          // 份额数量（1e18 精度）
    uint256 expiry;          // 过期时间戳
    uint256 salt;            // 唯一标识符（防止签名重用）
}
```

**价格计算示例：**

- 价格 0.5 USDC = 500000（1e6）
- 数量 10 份额 = 10 \* 1e18
- 总金额 = 500000 _ 10 _ 1e12 / 1e6 = 5000000 USDC

### OutcomeToken1155

共享的 ERC-1155 结果代币合约，所有市场共享同一合约实例，通过 Token ID 区分不同市场和结果。

**Token ID 计算：**

```solidity
// Token ID = (market_address << 32) | outcomeIndex
function computeTokenId(address market, uint256 outcomeIndex) external pure returns (uint256 tokenId);

// 示例：市场 0x1234...，结果 0
// tokenId = 0x1234000000000000000000000000000000000000 << 32 | 0
// = 0x1234000000000000000000000000000000000000000000000000000000000000
```

**核心函数：**

```solidity
function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function burn(address from, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function grantMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
function revokeMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
```

### UMAOracleAdapterV2

UMA Optimistic Oracle V3 适配器，负责去中心化结果验证。

**核心函数：**

```solidity
// 注册市场
function registerMarket(
    bytes32 marketId,
    uint64 resolutionTime,
    uint8 outcomeCount
) external onlyRole(REGISTRAR_ROLE);

// 断言结果
function assertOutcome(
    bytes32 marketId,
    uint8 outcomeIndex,
    bytes calldata claim
) external onlyRole(REPORTER_ROLE);

// 解决争议（UMA 回调）
function settleAssertion(bytes32 assertionId) external;

// 查询结果
function getOutcome(bytes32 marketId) external view returns (uint8 outcomeIndex, bool exists);
```

**状态枚举：**

```solidity
enum Status {
    NONE,      // 未开始
    PENDING,   // 等待 UMA 确认
    RESOLVED,  // 已解决
    INVALID    // 市场无效
}
```

### 安全特性

- ✅ ReentrancyGuard 重入保护（所有写入函数）
- ✅ 闪电贷攻击防护（单区块交易量限制 1M USDC）
- ✅ 批量操作大小限制（单次最多 50 个订单）
- ✅ 订单最小生命周期（30 秒，防止三明治攻击）
- ✅ ECDSA 签名可延展性保护（s 值检查）
- ✅ ERC-1271 智能合约钱包支持（链上验证）
- ✅ 熔断机制（紧急暂停功能）
- ✅ 访问控制（Role-Based Access Control）

### 合约错误码

```solidity
error InvalidOutcomeIndex();           // 无效结果索引
error InvalidState();                  // 无效市场状态
error ResolutionTimeNotReached();      // 未到结算时间
error InvalidExpiry();                 // 订单已过期
error InvalidAmount();                 // 无效数量
error InvalidPrice();                  // 无效价格
error InvalidSignedRequest();          // 签名验证失败
error OrderCanceled();                 // 订单已取消
error NoMinterRole();                  // 无铸造权限
error FeeNotSupported();               // 不支持的手续费
error MarketPaused();                  // 市场已暂停
error NotAuthorized();                 // 未授权操作
error ArrayLengthMismatch();           // 数组长度不匹配
error BatchSizeExceeded();             // 超出批量大小限制
error FlashLoanProtection();           // 触发闪电贷保护
error OrderLifetimeTooShort();         // 订单生命周期不足
error InvalidSignatureS();             // 签名 s 值无效
```

### OffchainBinaryMarket

二元市场（YES/NO）专用合约，继承自 OffchainMarketBase。

```solidity
// 初始化数据格式
// abi.encode(["Yes", "No"])
```

### OffchainMultiMarket8

多元市场（2-8 选项）专用合约，继承自 OffchainMarketBase。

```solidity
// 初始化数据格式
// abi.encode(["Option 1", "Option 2", ..., "Option N"])
// 支持 2-8 个结果选项
```

---

## 前端架构

### 技术栈

| 类别   | 技术                 | 版本   |
| ------ | -------------------- | ------ |
| 框架   | Next.js (App Router) | 15.5.4 |
| UI     | React                | 19     |
| 语言   | TypeScript           | 5.0    |
| 样式   | Tailwind CSS         | 3.4    |
| 动画   | Framer Motion        | 11     |
| 状态   | React Query          | 5      |
| Web3   | ethers.js            | 6      |
| 国际化 | next-intl            | 3      |

### 国际化

前端使用 `next-intl` 进行国际化，支持的语言：

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

### 目录结构

```
apps/web/src/
├── app/                           # Next.js App Router 页面
│   ├── api/                       # API 路由（后端）
│   ├── prediction/[id]/           # 市场详情页
│   ├── trending/                  # 趋势市场列表
│   ├── profile/                   # 用户主页
│   ├── forum/                     # 论坛
│   ├── flags/                     # Flag 市场
│   ├── proposals/                 # 提案系统
│   ├── admin/                     # 管理后台
│   └── leaderboard/               # 排行榜
├── components/                    # React 组件
│   ├── market/                    # 市场相关组件
│   ├── chatPanel/                 # 聊天面板
│   ├── topNavBar/                 # 顶部导航
│   ├── ui/                        # 基础 UI 组件
│   └── walletModal/               # 钱包模态框
├── contexts/                      # React Context
│   ├── AuthContext.tsx            # 认证状态
│   ├── WalletContext.tsx          # 钱包状态
│   └── UserContext.tsx            # 用户状态
├── hooks/                         # 自定义 Hooks
│   ├── useWalletModalLogic.ts    # 钱包模态框逻辑
│   ├── useMarketWebSocket.ts      # WebSocket 连接
│   └── useInfiniteScroll.ts       # 无限滚动
├── lib/                           # 工具库
│   ├── format.ts                  # 格式化工具
│   ├── address.ts                 # 地址处理
│   ├── jwt.ts                     # JWT 验证
│   └── database.types.ts          # 数据库类型
└── features/                      # 功能模块
    ├── flags/                     # Flag 功能
    └── predictionAdmin/           # 预测市场管理
```

### 核心组件

**市场交易面板：**

```typescript
// 交易参数接口
interface TradeParams {
  outcomeIndex: number; // 结果索引
  isBuy: boolean; // 买入/卖出
  price: string; // 价格（USDC）
  amount: string; // 数量（份额）
  salt: string; // 随机数
  expiry: number; // 过期时间
}

// 提交订单流程
async function submitOrder(params: TradeParams, signature: string) {
  const response = await fetch("/api/orderbook/order", {
    method: "POST",
    body: JSON.stringify({ order: params, signature }),
  });
  return response.json();
}
```

---

## Relayer 服务

### 架构概述

Relayer 是 Foresight 预测市场的核心基础设施，采用链下撮合、链上结算的混合架构。

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

### 核心组件

**订单验证器（Order Validator）：** 验证 EIP-712 签名、订单参数和防重放保护。

**撮合引擎（Matching Engine）：** 高性能订单撮合，支持限价单、市价单和多种订单类型。

**交易执行器（Trade Executor）：** 批量提交链上结算交易，管理 gas 优化和重试机制。

**事件 ingestion：** 监听链上事件，更新订单状态和余额。

### v2 撮合引擎 API（推荐）

| 方法 | 端点                   | 描述                                   |
| ---- | ---------------------- | -------------------------------------- |
| POST | `/v2/orders`           | 提交订单并撮合（返回撮合结果与剩余量） |
| GET  | `/v2/depth`            | 获取订单簿深度（内存快照）             |
| GET  | `/v2/stats`            | 获取盘口统计（bestBid/bestAsk 等）     |
| GET  | `/v2/ws-info`          | 获取 WS 连接信息与可订阅频道           |
| POST | `/v2/register-settler` | 为 marketKey 注册结算器/Operator       |
| GET  | `/v2/settlement-stats` | 获取结算统计（聚合）                   |
| GET  | `/v2/operator-status`  | 获取某 marketKey 的 Operator 状态      |

### 兼容 API（DB 驱动订单簿）

| 方法 | 端点                      | 描述                                                |
| ---- | ------------------------- | --------------------------------------------------- |
| POST | `/orderbook/orders`       | 提交签名订单（写入 orders 表）                      |
| POST | `/orderbook/cancel-salt`  | 签名取消单个 salt（写入 orders 状态）               |
| GET  | `/orderbook/depth`        | 获取深度（优先读取 depth_levels / 回退聚合 orders） |
| GET  | `/orderbook/queue`        | 获取某价格档位的订单队列                            |
| POST | `/orderbook/report-trade` | 通过 txHash 回灌成交（链上事件入库）                |

### 系统 API

| 方法 | 端点       | 描述            |
| ---- | ---------- | --------------- |
| GET  | `/health`  | 健康检查        |
| GET  | `/ready`   | 就绪检查        |
| GET  | `/metrics` | Prometheus 指标 |
| GET  | `/version` | 版本信息        |

**健康检查响应示例：**

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

### WebSocket 实时数据

```javascript
// 连接
const ws = new WebSocket("ws://relayer.foresight.io:3006");

// 订阅深度
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "depth",
    marketKey: "80002:1",
    outcomeIndex: 0,
  })
);

// 订阅成交
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "trades",
    marketKey: "80002:1",
  })
);

// 订阅 K线
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

**WebSocket 消息类型：**

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

### Prometheus 监控指标

| 指标                                 | 描述             |
| ------------------------------------ | ---------------- |
| `foresight_orders_total`             | 订单提交总数     |
| `foresight_orders_active`            | 活跃订单数       |
| `foresight_matches_total`            | 撮合总数         |
| `foresight_matching_latency_ms`      | 撮合延迟（毫秒） |
| `foresight_matched_volume_total`     | 成交量           |
| `foresight_settlement_batches_total` | 结算批次数       |
| `foresight_settlement_pending_fills` | 待结算撮合数     |
| `foresight_settlement_latency_ms`    | 结算延迟（毫秒） |
| `foresight_ws_connections_active`    | WebSocket 连接数 |

### 配置说明

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

### 运行 Relayer

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run start:prod

# 使用 Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 -p 3006:3006 foresight-relayer

# 使用 PM2
pm2 start dist/index.js --name foresight-relayer
```

### Grafana 监控面板

```bash
docker-compose -f docker-compose.monitoring.yml up -d
# 访问 http://localhost:3030
# 默认账号: admin / foresight123
```

---

## API 参考

### 认证（SIWE）

```text
GET /api/siwe/nonce          # 生成 nonce
POST /api/siwe/verify         # 验证签名并登录
GET /api/siwe/logout         # 登出
POST /api/siwe/logout        # 登出
```

### 认证（邮箱）

```text
POST /api/email-otp/request        # 请求验证码
POST /api/email-otp/verify         # 验证验证码
POST /api/email-otp/complete-signup # 完成注册
POST /api/email-magic-link/request  # 请求魔法链接
POST /api/email-magic-link/verify   # 验证魔法链接
```

### 传统认证

```text
POST /api/auth/login      # 登录
POST /api/auth/register   # 注册
GET /api/auth/me          # 获取当前用户
GET /api/auth/sessions    # 会话列表
POST /api/auth/sessions   # 创建会话
DELETE /api/auth/sessions # 删除会话
POST /api/auth/delete-account # 删除账户
```

### 限流策略

| 档位     | 请求/分钟 | 适用场景     |
| -------- | --------- | ------------ |
| strict   | 5         | 高风险操作   |
| moderate | 20        | 普通用户     |
| relaxed  | 60        | 高频读取     |
| lenient  | 120       | 公开数据查询 |

### 市场数据 API

```text
GET /api/markets/map           # 市场地图
GET /api/markets/summary       # 市场摘要
GET /api/orderbook/order       # 订单簿
POST /api/orderbook/order      # 提交订单
GET /api/orderbook/depth       # 订单深度
GET /api/orderbook/candles     # K线数据
GET /api/orderbook/trades      # 成交记录
GET /api/orderbook/quote       # 报价估算
POST /api/orderbook/cancel-salt # 取消订单
POST /api/orderbook/report-trade # 报告成交
POST /api/orderbook/orders/fill # 订单填充
GET /api/orderbook/market-plan # 市场计划预览
```

### 预测市场 API

```text
GET /api/predictions           # 市场列表
POST /api/predictions          # 创建市场（管理员）
GET /api/predictions/[id]      # 市场详情
GET /api/predictions/[id]/stats # 市场统计
```

### 用户资产 API

```text
GET /api/user-balance          # 用户余额
POST /api/user-balance         # 充值
GET /api/deposits/history      # 充值历史
GET /api/history               # 交易历史
POST /api/history              # 持仓历史
GET /api/user-portfolio        # 投资组合
POST /api/user-portfolio/compute # 计算收益
```

### 社交系统 API

```text
POST /api/follows              # 关注用户
DELETE /api/follows            # 取消关注
GET /api/follows               # 关注列表
POST /api/follows/counts       # 关注计数
GET /api/user-follows          # 用户关注
POST /api/user-follows/user    # 关注用户操作
GET /api/user-follows/counts   # 关注计数
```

### 讨论系统 API

```text
GET /api/discussions           # 讨论列表
POST /api/discussions          # 创建讨论
PATCH /api/discussions/[id]    # 更新讨论
DELETE /api/discussions/[id]   # 删除讨论
POST /api/discussions/report   # 举报讨论
```

### 论坛系统 API

```text
GET /api/forum                 # 论坛列表
POST /api/forum                # 创建主题
POST /api/forum/comments       # 创建评论
POST /api/forum/vote           # 投票
GET /api/forum/user-votes      # 用户投票
POST /api/forum/report         # 举报
```

### Flag 市场 API

```text
GET /api/flags                 # Flag 列表
POST /api/flags                # 创建 Flag（管理员）
POST /api/flags/[id]/checkin   # 打卡
GET /api/flags/[id]/checkins   # 打卡列表
POST /api/flags/[id]/settle    # 结算 Flag
POST /api/checkins/[id]/review # 审核打卡
```

### 排行榜 API

```text
GET /api/leaderboard           # 排行榜
POST /api/leaderboard          # 更新排行榜
```

### 搜索 API

```text
GET /api/search                # 搜索
POST /api/search               # 高级搜索
```

### 用户资料 API

```text
GET /api/user-profiles         # 用户资料
POST /api/user-profiles        # 更新资料
```

### 分类 API

```text
GET /api/categories            # 分类列表
GET /api/categories/counts     # 分类计数
```

### 通知系统 API

```text
GET /api/notifications         # 通知列表
GET /api/notifications/unread-count # 未读计数
POST /api/notifications/read   # 标记已读
POST /api/notifications/archive # 归档通知
```

### 分析 API

```text
POST /api/analytics/events     # 上报事件
GET /api/analytics/events      # 查询事件
POST /api/analytics/vitals     # Web Vitals
```

### 健康检查

```text
GET /api/health                # 健康检查
```

### AA 账户迁移

```text
POST /api/aa/owner-migration   # 迁移所有权
POST /api/aa/userop/draft      # 草稿 UserOperation
POST /api/aa/userop/simulate   # 模拟 UserOperation
POST /api/aa/userop/submit     # 提交 UserOperation
```

### 代理钱包

```text
POST /api/wallets/proxy        # 创建代理钱包
```

### 表情包和贴纸

```text
GET /api/emojis                # 表情包列表
POST /api/emojis               # 使用表情包
GET /api/stickers              # 贴纸列表
POST /api/stickers             # 购买贴纸
```

### 上传 API

```text
POST /api/upload               # 上传文件
```

### 管理员 API

```text
GET /api/admin/roles           # 角色列表
POST /api/admin/roles          # 创建角色
GET /api/admin/performance     # 性能监控
GET /api/review/proposals      # 提案审核列表
POST /api/review/proposals     # 审核提案
GET /api/review/proposals/[id] # 提案详情
```

---

## 数据库设计

### 核心表

```sql
-- 订单（Relayer 写入）
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

-- 成交（链上事件）
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

-- K线（OHLCV）
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

## 部署指南

### 智能合约

```bash
# 1. 配置环境变量
export PRIVATE_KEY=your_deployer_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# 2. 编译合约
npx hardhat compile

# 3. 部署
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy
```

### 前端

```bash
# 1. 构建
cd apps/web
npm run build

# 2. 部署到 Vercel
vercel deploy --prod
```

### Relayer

```bash
# 1. 构建
cd services/relayer
npm run build

# 2. 使用 PM2 运行
pm2 start dist/index.js --name foresight-relayer

# 3. 或使用 Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 foresight-relayer
```

---

## 安全规范

### 智能合约安全

1. **重入保护**：所有状态修改函数使用 `ReentrancyGuard`
2. **访问控制**：使用 OpenZeppelin AccessControl
3. **闪电贷防护**：单区块交易量限制
4. **签名安全**：ECDSA 可延展性检查
5. **熔断机制**：紧急暂停功能

### 前端安全

1. **输入验证**：使用 `validateAndSanitize` 清理用户输入
2. **XSS 防护**：不直接渲染用户原始输入
3. **CSRF 防护**：API 使用签名验证
4. **限流**：使用 `withRateLimit` 包装 API

---

## 测试指南

### 智能合约测试

```bash
# 运行所有测试
npx hardhat test

# 运行特定测试文件
npx hardhat test test/SecurityTests.test.cjs

# 生成覆盖率报告
npx hardhat coverage
```

### 前端测试

```bash
# 运行单元测试
npm run test

# 运行 E2E 测试
npm run test:e2e

# 运行测试并生成报告
npm run test:web -- --run
```

### Relayer 测试

```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration
```

### 测试要点

1. **签名验证**：确保 EIP-712 签名正确验证
2. **订单撮合**：验证限价单、市价单撮合逻辑
3. **结算流程**：测试市场结算和收益计算
4. **安全防护**：验证重入保护和闪电贷防护
5. **并发处理**：测试高并发场景下的稳定性

---

## 故障排除

### 常见问题

**问题：订单提交失败**

1. 检查签名是否有效且未过期
2. 确认订单参数格式正确（价格、数量精度）
3. 验证账户余额是否充足
4. 检查是否触发了防重放保护

**问题：WebSocket 连接断开**

1. 检查网络连接是否稳定
2. 确认 WebSocket 端口是否正确（默认 3006）
3. 查看是否有防火墙阻止连接
4. 尝试重新连接（实现自动重连机制）

**问题：合约调用失败**

1. 检查 RPC URL 是否可访问
2. 确认钱包余额是否充足
3. 验证合约地址是否正确
4. 检查是否触发了 gas 限制

**问题：撮合延迟高**

1. 检查 Relayer 服务状态
2. 查看 Supabase 查询性能
3. 确认网络延迟是否正常
4. 检查是否有大量待处理订单

### 日志查看

```bash
# Relayer 日志
tail -f services/relayer/logs/app.log

# 前端日志（浏览器控制台）
# 打开浏览器开发者工具查看

# 合约日志（区块链浏览器）
# 在 PolygonScan 上查看交易详情
```

### 监控指标

```bash
# 查看 Prometheus 指标
curl http://localhost:3001/metrics

# 查看 Grafana 面板
open http://localhost:3030
```

### 性能优化建议

1. **数据库查询**：使用索引优化查询性能
2. **缓存策略**：合理使用 Redis 缓存热点数据
3. **批量操作**：优先使用批量操作减少链上交易
4. **Gas 优化**：使用 ERC-1155 减少合约调用次数
5. **CDN 加速**：静态资源使用 CDN 加速

---

## 更多资源

- [Next.js 文档](https://nextjs.org/docs)
- [React Query 文档](https://tanstack.com/query/latest)
- [OpenZeppelin 合约](https://docs.openzeppelin.com/contracts)
- [UMA 协议](https://docs.uma.xyz)
- [EIP-712 规范](https://eips.ethereum.org/EIPS/eip-712)
- [Polygon 文档](https://docs.polygon.technology)

---

**最后更新**: 2025-01-26  
**文档版本**: v3.0

---

**语言切换 / Languages / Idioma / Langue / 언어:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
