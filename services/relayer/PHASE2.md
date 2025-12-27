# Foresight Relayer - Phase 2 高可用架构指南

Phase 2 实现了高可用、集群化、读写分离和链上对账系统，使 Relayer 能够支持生产级部署。

## 🎯 Phase 2 功能概览

| 功能 | 描述 | 状态 |
|------|------|------|
| Leader Election | 基于 Redis 的主备切换 | ✅ 完成 |
| WebSocket 集群化 | Redis Pub/Sub 跨节点广播 | ✅ 完成 |
| 数据库读写分离 | 主写从读 + 健康检查 | ✅ 完成 |
| 链上对账系统 | 定期对比链上/链下数据 | ✅ 完成 |
| 余额检查器 | 用户余额一致性检查 | ✅ 完成 |

## 🚀 快速开始

### 1. 环境变量配置

```bash
# .env.production

# ============================================================
# 集群配置
# ============================================================
CLUSTER_ENABLED=true
NODE_ID=relayer-node-1        # 或使用 HOSTNAME/POD_NAME

# ============================================================
# Redis 配置 (集群模式)
# ============================================================
REDIS_URL=redis://redis-master:6379
REDIS_HOST=redis-master
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
REDIS_KEY_PREFIX=foresight:

# ============================================================
# 数据库配置 (主库)
# ============================================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# 数据库副本 (可选)
SUPABASE_REPLICA_1_URL=https://replica-1.supabase.co
SUPABASE_REPLICA_1_KEY=replica-1-key
SUPABASE_REPLICA_1_WEIGHT=1

SUPABASE_REPLICA_2_URL=https://replica-2.supabase.co
SUPABASE_REPLICA_2_KEY=replica-2-key
SUPABASE_REPLICA_2_WEIGHT=2

# ============================================================
# 链上对账配置
# ============================================================
RPC_URL=https://polygon-amoy.infura.io/v3/your-key
CHAIN_ID=80002
MARKET_ADDRESS=0x...
USDC_ADDRESS=0x...
RECONCILIATION_INTERVAL_MS=300000  # 5 分钟
RECONCILIATION_AUTO_FIX=false
```

### 2. 启动集群

```bash
# 单节点开发模式
pnpm run start:dev

# 多节点生产模式 (需要配置不同 NODE_ID)
NODE_ID=relayer-1 pnpm run start:prod &
NODE_ID=relayer-2 pnpm run start:prod &
NODE_ID=relayer-3 pnpm run start:prod &
```

## 🏗️ 架构设计

### 1. Leader Election (主备切换)

```
┌─────────────────────────────────────────────────────────┐
│                    Redis Cluster                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  foresight:leader:matching-engine               │    │
│  │  { nodeId, acquiredAt, lastRenewedAt }         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
          ▲                    ▲                    ▲
          │ 续约/获取锁         │                    │
    ┌─────┴─────┐       ┌─────┴─────┐       ┌─────┴─────┐
    │ Relayer 1 │       │ Relayer 2 │       │ Relayer 3 │
    │  LEADER   │       │ FOLLOWER  │       │ FOLLOWER  │
    │ (撮合中)   │       │ (待命)     │       │ (待命)     │
    └───────────┘       └───────────┘       └───────────┘
```

**工作原理:**
1. 节点启动时尝试获取 Redis 分布式锁
2. 获取成功的节点成为 Leader，处理撮合订单
3. Leader 每 10 秒续约锁 (TTL 30 秒)
4. 其他节点每 5 秒检查是否可以接管
5. Leader 崩溃后，锁自动过期，其他节点竞争接管

**使用示例:**
```typescript
import { initClusterManager, getClusterManager } from "./cluster";

// 初始化
const cluster = await initClusterManager({
  enableLeaderElection: true,
  enablePubSub: true,
});

// 监听事件
cluster.on("became_leader", () => {
  console.log("This node is now the leader!");
  startMatchingEngine();
});

cluster.on("lost_leadership", () => {
  console.log("Lost leadership, stopping matching...");
  stopMatchingEngine();
});

// 仅在 Leader 上执行
await cluster.executeAsLeader(async () => {
  await processOrders();
});
```

### 2. WebSocket 集群化

```
┌─────────────────────────────────────────────────────────┐
│                  Redis Pub/Sub                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ws:depth │ │ws:trades│ │ws:stats │ │ws:orders│       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │
└───────┼──────────┼──────────┼──────────┼───────────────┘
        │          │          │          │
   ┌────┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐
   │Relayer 1│ │Relayer 2│ │Relayer 3│ │Relayer 4│
   │  100    │ │  150    │ │  200    │ │  50     │
   │ clients │ │ clients │ │ clients │ │ clients │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**工作原理:**
1. 每个节点运行独立的 WebSocket 服务器
2. 客户端连接到任意节点
3. 广播消息通过 Redis Pub/Sub 同步到所有节点
4. 每个节点将消息推送给本地订阅的客户端

**预定义频道:**
```typescript
const CHANNELS = {
  WS_DEPTH: "ws:depth",      // 深度更新
  WS_TRADES: "ws:trades",    // 成交
  WS_STATS: "ws:stats",      // 统计
  WS_ORDERS: "ws:orders",    // 订单状态
  CLUSTER_EVENTS: "cluster:events",
  LEADER_EVENTS: "cluster:leader",
};
```

**使用示例:**
```typescript
import { initClusteredWebSocketServer } from "./cluster";

// 初始化集群化 WebSocket
const wsServer = await initClusteredWebSocketServer(3006);

// 广播到所有节点的所有客户端
await wsServer.broadcastDepth(depthSnapshot);
await wsServer.broadcastTrade(trade);
await wsServer.broadcastStats(stats);

// 获取统计
const stats = wsServer.getStats();
console.log(`Connections: ${stats.connections}, Node: ${stats.nodeId}`);
```

### 3. 数据库读写分离

```
┌─────────────────────────────────────────────────────────┐
│                    DatabasePool                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌──────────────┐    ┌──────────────┐                  │
│   │ Write Client │    │ Read Clients │                  │
│   │   (Primary)  │    │  (Replicas)  │                  │
│   └──────┬───────┘    └──────┬───────┘                  │
│          │                   │                          │
│          ▼                   ▼                          │
│   ┌──────────────┐    ┌──────────────────────────┐     │
│   │   Primary    │    │     Weighted Round Robin  │     │
│   │   Supabase   │    │  ┌────────┐ ┌────────┐   │     │
│   └──────────────┘    │  │Replica1│ │Replica2│   │     │
│                       │  │  W: 1  │ │  W: 2  │   │     │
│                       │  └────────┘ └────────┘   │     │
│                       └──────────────────────────┘     │
│                                                          │
│   Health Check: 每 30 秒检查副本健康状态                  │
│   Failover: 3 次连续失败后标记为不健康                    │
└─────────────────────────────────────────────────────────┘
```

**使用示例:**
```typescript
import { initDatabasePool, getDatabasePool } from "./database";
import { getOrderRepository, getTradeRepository } from "./database";

// 初始化
await initDatabasePool();

// 使用 Repository 模式
const orderRepo = getOrderRepository();
const tradeRepo = getTradeRepository();

// 读操作 - 自动使用副本
const orders = await orderRepo.findOpenOrdersByUser(userAddress);
const trades = await tradeRepo.findRecentTrades(marketKey, outcomeIndex);

// 写操作 - 自动使用主库
const newOrder = await orderRepo.create({ ... });
await orderRepo.updateStatus(orderId, "filled", filledQty);

// 直接使用连接池
const pool = getDatabasePool();
const result = await pool.executeRead("custom_query", async (client) => {
  return client.from("markets").select("*").eq("status", "active");
});
```

### 4. 链上对账系统

```
┌─────────────────────────────────────────────────────────┐
│                  ChainReconciler                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌────────────────┐          ┌────────────────┐        │
│   │  Blockchain    │          │   Database     │        │
│   │  (RPC Node)    │          │   (Supabase)   │        │
│   └───────┬────────┘          └───────┬────────┘        │
│           │                           │                 │
│           ▼                           ▼                 │
│   ┌────────────────┐          ┌────────────────┐        │
│   │ Onchain Fills  │◄────────►│ Offchain Trades│        │
│   │ (Events)       │  比较    │ (settled=true) │        │
│   └────────────────┘          └────────────────┘        │
│                                                          │
│   差异类型:                                               │
│   - missing_onchain: 链下有记录但链上无事件               │
│   - missing_offchain: 链上有事件但链下无记录              │
│   - amount_mismatch: 金额不一致                          │
│   - status_mismatch: 状态不一致                          │
│                                                          │
│   自动修复:                                               │
│   - missing_offchain: 从链上同步                         │
│   - status_mismatch: 更新状态                            │
└─────────────────────────────────────────────────────────┘
```

**使用示例:**
```typescript
import { initChainReconciler, getChainReconciler } from "./reconciliation";

// 初始化
const reconciler = await initChainReconciler({
  intervalMs: 300000,  // 5 分钟
  blockRange: 1000,
  autoFix: false,
});

// 监听事件
reconciler.on("reconciliation_complete", (report) => {
  console.log(`Checked ${report.tradesChecked} trades`);
  console.log(`Found ${report.summary.totalDiscrepancies} discrepancies`);
});

// 手动触发
const report = await reconciler.triggerReconciliation();

// 获取差异
const discrepancies = reconciler.getUnresolvedDiscrepancies();

// 解决差异
reconciler.resolveDiscrepancy(discrepancyId, "Manually verified");
```

## 📡 API 端点

### 集群管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/cluster/status` | GET | 集群状态概览 |
| `/cluster/leader` | GET | 当前 Leader 信息 |
| `/cluster/nodes` | GET | 所有节点列表 |

### 数据库状态

| 端点 | 方法 | 描述 |
|------|------|------|
| `/database/status` | GET | 数据库连接状态 |

### 对账系统

| 端点 | 方法 | 描述 |
|------|------|------|
| `/reconciliation/status` | GET | 对账系统状态 |
| `/reconciliation/discrepancies` | GET | 差异列表 |
| `/reconciliation/trigger` | POST | 手动触发对账 |
| `/reconciliation/resolve/:id` | POST | 解决差异 |

### 综合管理

| 端点 | 方法 | 描述 |
|------|------|------|
| `/admin/overview` | GET | 管理概览 (所有状态) |

## 📊 新增指标

### 集群指标
- `foresight_leader_status` - Leader 状态 (1=leader, 0=follower)
- `foresight_leader_election_total` - Leader 选举次数
- `foresight_cluster_nodes_total` - 集群节点总数

### Pub/Sub 指标
- `foresight_pubsub_messages_total` - Pub/Sub 消息数
- `foresight_pubsub_subscriptions` - 订阅数
- `foresight_pubsub_connection_status` - 连接状态

### WebSocket 集群指标
- `foresight_ws_cluster_connections` - 本节点连接数
- `foresight_ws_cluster_subscriptions` - 本节点订阅数
- `foresight_ws_cluster_broadcast_latency_ms` - 广播延迟

### 数据库指标
- `foresight_db_connections_active` - 活跃连接数
- `foresight_db_queries_total` - 查询总数
- `foresight_db_query_latency_ms` - 查询延迟
- `foresight_db_replica_health` - 副本健康状态

### 对账指标
- `foresight_reconciliation_runs_total` - 对账运行次数
- `foresight_reconciliation_discrepancies_total` - 发现的差异数
- `foresight_reconciliation_duration_seconds` - 对账耗时
- `foresight_reconciliation_pending_items` - 待处理项

### 余额检查指标
- `foresight_balance_checks_total` - 余额检查次数
- `foresight_balance_mismatches_total` - 余额不匹配数
- `foresight_system_total_balance` - 系统总余额

## 🔧 Kubernetes 多副本部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foresight-relayer
spec:
  replicas: 3  # 多副本
  selector:
    matchLabels:
      app: foresight-relayer
  template:
    metadata:
      labels:
        app: foresight-relayer
    spec:
      containers:
        - name: relayer
          image: foresight/relayer:2.0.0
          ports:
            - containerPort: 3000
              name: http
            - containerPort: 3006
              name: websocket
          env:
            - name: NODE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: CLUSTER_ENABLED
              value: "true"
            - name: REDIS_HOST
              value: "redis-master"
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-credentials
                  key: url
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: foresight-relayer
spec:
  selector:
    app: foresight-relayer
  ports:
    - name: http
      port: 3000
      targetPort: 3000
    - name: websocket
      port: 3006
      targetPort: 3006
```

## 📁 新增文件结构

```
services/relayer/
├── src/
│   ├── cluster/
│   │   ├── index.ts              # 模块导出
│   │   ├── leaderElection.ts     # Leader 选举
│   │   ├── leaderElection.test.ts
│   │   ├── pubsub.ts             # Redis Pub/Sub
│   │   ├── pubsub.test.ts
│   │   ├── clusterManager.ts     # 集群管理器
│   │   └── websocketCluster.ts   # WebSocket 集群
│   ├── database/
│   │   ├── index.ts              # 模块导出
│   │   ├── connectionPool.ts     # 连接池
│   │   ├── connectionPool.test.ts
│   │   └── repository.ts         # 数据仓库
│   ├── reconciliation/
│   │   ├── index.ts              # 模块导出
│   │   ├── chainReconciler.ts    # 链上对账
│   │   ├── chainReconciler.test.ts
│   │   └── balanceChecker.ts     # 余额检查
│   └── routes/
│       └── clusterRoutes.ts      # 集群 API
└── PHASE2.md                     # 本文档
```

## 🧪 运行测试

```bash
# 运行所有测试
pnpm test

# 运行 Phase 2 相关测试
pnpm test -- --grep "cluster|database|reconciliation"

# 覆盖率报告
pnpm run test:coverage
```

## 🔜 Phase 3 展望

- [ ] Rate Limiting (API 限流)
- [ ] 分布式事务 (跨服务一致性)
- [ ] 自动扩缩容 (HPA)
- [ ] 蓝绿部署支持
- [ ] 灾难恢复演练

