# 🔄 Foresight Relayer

> 高性能链下订单簿撮合服务，提供专业级交易体验。

---

## 📋 概述

Relayer 是 Foresight 预测市场的核心基础设施，负责：

- 📥 接收和验证 EIP-712 签名订单
- 🔄 高性能订单撮合
- 📊 实时订单簿维护
- ⛓️ 链上结算交易提交
- 📡 WebSocket 实时数据推送

---

## ⚡ 快速开始

### 环境要求

- Node.js 20.x (LTS)
- Redis (可选，用于高可用部署)
- Docker (可选)

### 安装

```bash
cd services/relayer
npm install
```

### 配置

```bash
# 复制环境变量模板
cp ../../.env.example .env

# 编辑配置
vim .env
```

关键配置项：

```env
# 服务端口
RELAYER_PORT=3001

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# 区块链
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# WebSocket
WS_PORT=3006

# CORS（可选，逗号分隔；为空表示放开）
RELAYER_CORS_ORIGINS=http://localhost:3000

# 链上结算 Operator（可选：启用批量结算时需要）
OPERATOR_PRIVATE_KEY=0x...

# Redis (可选)
REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 运行

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run start:prod
```

---

## 🏗️ 架构

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

---

## 📡 API 端点

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

### Prometheus 指标

```bash
# 查看指标
curl http://localhost:3001/metrics
```

**关键指标：**

| 指标                                 | 描述             |
| ------------------------------------ | ---------------- |
| `foresight_orders_total`             | 订单提交总数     |
| `foresight_orders_active`            | 活跃订单数       |
| `foresight_matches_total`            | 撮合总数         |
| `foresight_matching_latency_ms`      | 撮合延迟         |
| `foresight_matched_volume_total`     | 成交量           |
| `foresight_settlement_batches_total` | 结算批次数       |
| `foresight_settlement_pending_fills` | 待结算撮合数     |
| `foresight_settlement_latency_ms`    | 结算延迟         |
| `foresight_ws_connections_active`    | WebSocket 连接数 |

### Grafana Dashboard

```bash
# 启动监控栈
docker-compose -f docker-compose.monitoring.yml up -d

# 访问 Grafana
open http://localhost:3030
# 账号: admin / foresight123
```

### WebSocket

```javascript
// 连接
const ws = new WebSocket("ws://localhost:3006");

// 订阅深度
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "depth",
    marketKey: "80002:1",
    outcomeIndex: 0,
  })
);

// 接收更新
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

---

## 📊 监控

### Prometheus 指标

```bash
# 查看指标
curl http://localhost:3001/metrics
```

关键指标：

- `foresight_orders_total` - 订单总数
- `foresight_matches_total` - 撮合总数
- `foresight_matching_latency_ms` - 撮合延迟
- `foresight_settlement_pending_fills` - 待结算数

### Grafana Dashboard

```bash
# 启动监控栈
docker-compose -f docker-compose.monitoring.yml up -d

# 访问 Grafana
open http://localhost:3030
# 账号: admin / foresight123
```

---

## 🔧 生产部署

### Docker

```bash
# 构建镜像
docker build -t foresight/relayer .

# 运行
docker run -d \
  --name foresight-relayer \
  -p 3001:3001 \
  -p 3006:3006 \
  --env-file .env \
  foresight/relayer
```

### Kubernetes

```bash
# 应用配置
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### 蓝绿部署

```bash
./scripts/blue-green-deploy.sh foresight/relayer:2.0.0
```

---

## 📖 详细文档

| 文档                             | 描述         |
| -------------------------------- | ------------ |
| [MONITORING.md](./MONITORING.md) | 监控运维指南 |

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

---

## 📁 目录结构

```
services/relayer/
├── src/
│   ├── index.ts              # 入口文件
│   ├── orderbook.ts          # 订单簿逻辑
│   ├── supabase.ts           # 数据库客户端
│   ├── cluster/              # 集群管理
│   ├── database/             # 数据库连接池
│   ├── matching/             # 撮合引擎
│   ├── middleware/           # Express 中间件
│   ├── monitoring/           # 监控组件
│   ├── ratelimit/            # 限流
│   ├── reconciliation/       # 链上对账
│   ├── redis/                # Redis 客户端
│   ├── resilience/           # 弹性组件
│   ├── routes/               # API 路由
│   └── settlement/           # 结算模块
├── k8s/                      # Kubernetes 配置
├── grafana/                  # Grafana 配置
├── scripts/                  # 部署脚本
└── *.md                      # 文档
```

---

## 🆘 故障排除

### 与 Web 事件体系对齐

- Web 侧会将关键业务事件写入 Supabase `analytics_events`，并提供 RED 聚合查询端点
- Relayer 侧通过 Prometheus 指标暴露撮合/结算等运行状态，二者互补
- 建议在可观测性平台（Grafana + 自建面板）中统一展示：
  - Web：登录与风控事件（Rate/Errors/Duration）
  - Relayer：撮合速率、延迟分布、失败率、待结算队列

### 常见问题

#### 订单提交失败

```bash
# 检查签名
curl -X POST http://localhost:3001/v2/orders \
  -H "Content-Type: application/json" \
  -d '{"order": {...}, "signature": "0x..."}'
```

#### 撮合延迟高

```bash
# 检查指标
curl http://localhost:3001/metrics | grep matching_latency
```

#### WebSocket 断连

```javascript
// 使用重连逻辑
ws.onclose = () => {
  setTimeout(() => {
    ws = new WebSocket("ws://localhost:3006");
  }, 1000);
};
```

---

## 📜 许可证

MIT License - 详见 [LICENSE](../../LICENSE)
