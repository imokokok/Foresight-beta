# Foresight Relayer - Phase 1 监控指南

本文档介绍 Phase 1 生产化准备中添加的监控、日志、Redis 和健康检查功能。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd services/relayer
npm install
```

### 2. 启动监控栈

```bash
# 启动 Redis + Prometheus + Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# 查看状态
docker-compose -f docker-compose.monitoring.yml ps
```

### 3. 配置环境变量

```bash
# .env 或 .env.local
# Redis 配置
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_KEY_PREFIX=foresight:

# 日志配置
LOG_FORMAT=json      # json | text
LOG_LEVEL=info       # debug | info | warn | error

# 监控
METRICS_ENABLED=true
```

### 4. 启动 Relayer

```bash
# 开发模式 (可读日志)
npm run start:dev

# 生产模式 (JSON 日志)
npm run start:prod
```

## 📊 监控端点

| 端点           | 描述            | 用途                       |
| -------------- | --------------- | -------------------------- |
| `GET /health`  | 健康检查        | Kubernetes liveness probe  |
| `GET /ready`   | 就绪检查        | Kubernetes readiness probe |
| `GET /live`    | 存活检查        | 快速存活确认               |
| `GET /metrics` | Prometheus 指标 | 指标采集                   |
| `GET /version` | 版本信息        | 部署验证                   |

### 健康检查响应示例

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

## 📈 关键指标

### 订单指标

- `foresight_orders_total` - 订单提交总数
- `foresight_orders_active` - 活跃订单数

### 撮合指标

- `foresight_matches_total` - 撮合总数
- `foresight_matching_latency_ms` - 撮合延迟
- `foresight_matched_volume_total` - 成交量

### 结算指标

- `foresight_settlement_batches_total` - 结算批次数
- `foresight_settlement_pending_fills` - 待结算撮合数
- `foresight_settlement_latency_ms` - 结算延迟

### WebSocket 指标

- `foresight_ws_connections_active` - 活跃连接数
- `foresight_ws_subscriptions_active` - 订阅数
- `foresight_ws_messages_total` - 消息总数

### Redis 指标

- `foresight_redis_connection_status` - 连接状态
- `foresight_redis_operations_total` - 操作总数
- `foresight_redis_operation_latency_ms` - 操作延迟

## 📝 日志系统

### 日志格式

**JSON 格式 (生产环境)**

```json
{
  "timestamp": "2024-12-27T10:00:00.000Z",
  "level": "info",
  "message": "Order submitted",
  "service": "matching-engine",
  "context": {
    "marketKey": "80002:1",
    "orderId": "order-123"
  }
}
```

**文本格式 (开发环境)**

```
2024-12-27T10:00:00.000Z [INFO ] [matching-engine] Order submitted {"marketKey":"80002:1","orderId":"order-123"}
```

### 日志级别

| 级别    | 用途         |
| ------- | ------------ |
| `debug` | 详细调试信息 |
| `info`  | 正常操作信息 |
| `warn`  | 警告信息     |
| `error` | 错误信息     |

### 专用 Logger

```typescript
import {
  logger, // 通用
  matchingLogger, // 撮合引擎
  settlementLogger, // 结算
  wsLogger, // WebSocket
  redisLogger, // Redis
} from "./monitoring/logger.js";

// 带上下文的日志
const orderLogger = logger.withMarket("80002:1");
orderLogger.info("Order placed", { orderId: "123" });
```

## 🔴 Redis 订单簿快照

### 功能

- 每 5 秒自动同步订单簿到 Redis
- 服务重启时从 Redis 快速恢复
- 24 小时数据过期

### 数据结构

```
foresight:orderbook:{marketKey}:{outcomeIndex}  -> 订单簿快照
foresight:order:{orderId}                        -> 单个订单
foresight:stats:{marketKey}:{outcomeIndex}       -> 统计信息
```

### 手动操作

```typescript
import { getOrderbookSnapshotService } from "./redis/orderbookSnapshot.js";

const snapshot = getOrderbookSnapshotService();

// 保存快照
await snapshot.saveSnapshot(marketKey, outcomeIndex, bidOrders, askOrders, stats);

// 加载快照
const data = await snapshot.loadSnapshot(marketKey, outcomeIndex);
```

## 📊 Grafana Dashboard

访问地址: http://localhost:3030

默认账号:

- 用户名: `admin`
- 密码: `foresight123`

### 预置 Dashboard

1. **Relayer Overview** - 系统概览
   - 系统健康状态
   - 订单/撮合速率
   - 延迟分布
   - 结算状态

## 🔧 Kubernetes 部署示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foresight-relayer
spec:
  template:
    spec:
      containers:
        - name: relayer
          image: foresight/relayer:1.1.0
          ports:
            - containerPort: 3000
          env:
            - name: LOG_FORMAT
              value: "json"
            - name: REDIS_HOST
              value: "redis-master"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

## 🧪 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

## 📁 新增文件结构

```
services/relayer/
├── src/
│   ├── monitoring/
│   │   ├── index.ts         # 模块导出
│   │   ├── metrics.ts       # Prometheus 指标
│   │   ├── logger.ts        # 结构化日志
│   │   ├── health.ts        # 健康检查
│   │   ├── metrics.test.ts  # 指标测试
│   │   └── logger.test.ts   # 日志测试
│   ├── redis/
│   │   ├── index.ts              # 模块导出
│   │   ├── client.ts             # Redis 客户端
│   │   └── orderbookSnapshot.ts  # 订单簿快照
│   ├── middleware/
│   │   ├── index.ts              # 模块导出
│   │   └── metricsMiddleware.ts  # 指标中间件
│   ├── routes/
│   │   ├── index.ts              # 模块导出
│   │   └── healthRoutes.ts       # 健康检查路由
│   └── matching/
│       └── matchingEngine.test.ts # 撮合测试
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml
│   │   └── dashboards/
│   │       └── dashboards.yml
│   └── dashboards/
│       └── relayer-overview.json
├── docker-compose.monitoring.yml
├── prometheus.yml
└── MONITORING.md
```

## ⚡ 高可用功能

高可用功能已集成到系统中：

- [x] 撮合引擎主备切换 (Leader Election)
- [x] WebSocket 集群化 (Redis Pub/Sub)
- [x] 数据库读写分离
- [x] 链上对账系统
