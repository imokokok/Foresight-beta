# API 路由文档

本文档描述 Foresight 前端 API 路由的接口规范，使用 OpenAPI 3.0 格式。

## 基础信息

- **Base URL**: `/api`
- **版本**: v1
- **Content-Type**: application/json

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "message": "错误描述",
    "code": "ERROR_CODE",
    "details": { ... },
    "timestamp": "2024-01-24T12:00:00Z"
  }
}
```

---

## 认证模块

### POST /api/auth/login

用户登录。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |
| signature | string | 是 | 签名 |
| message | string | 是 | 签名消息 |

**响应：**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...",
    "user": {
      "id": "0x...",
      "email": "user@example.com"
    }
  }
}
```

### POST /api/auth/logout

用户登出。

**响应：**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/me

获取当前用户信息。

**响应：**

```json
{
  "success": true,
  "data": {
    "id": "0x...",
    "email": "user@example.com",
    "username": "username"
  }
}
```

### POST /api/auth/register

用户注册。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |
| signature | string | 是 | 签名 |
| email | string | 是 | 邮箱 |
| username | string | 否 | 用户名 |

---

## 邮箱认证模块

### POST /api/email-otp/request

请求发送邮箱 OTP。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| mode | string | 是 | login 或 signup |

**响应：**

```json
{
  "success": true,
  "data": {
    "expiresInSec": 300,
    "resendAfterSec": 60,
    "codePreview": "1234**"
  }
}
```

### POST /api/email-otp/verify

验证邮箱 OTP。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| code | string | 是 | 6位验证码 |
| mode | string | 是 | login 或 signup |

**响应：**

```json
{
  "success": true,
  "data": {
    "ok": true,
    "address": "0x...",
    "isNewUser": false
  }
}
```

---

## 订单簿模块

### GET /api/orderbook/depth

获取订单簿深度。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| marketKey | string | 是 | 市场标识 |
| outcomeIndex | number | 是 | 结果索引 |
| limit | number | 否 | 深度级别数，默认 50 |

**响应：**

```json
{
  "success": true,
  "data": {
    "marketKey": "137-1",
    "outcomeIndex": 0,
    "bestBid": "0.52",
    "bestAsk": "0.55",
    "buy": [
      { "price": "0.52", "qty": "1000000" },
      { "price": "0.51", "qty": "2000000" }
    ],
    "sell": [
      { "price": "0.55", "qty": "1500000" },
      { "price": "0.56", "qty": "1000000" }
    ]
  }
}
```

### GET /api/orderbook/candles

获取 K 线数据。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| marketKey | string | 是 | 市场标识 |
| outcomeIndex | number | 是 | 结果索引 |
| interval | string | 否 | 时间间隔：1m, 5m, 15m, 1h, 4h, 1d，默认 1h |
| limit | number | 否 | 数据条数，默认 100 |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1706100000,
      "open": "0.50",
      "high": "0.55",
      "low": "0.49",
      "close": "0.52",
      "volume": "10000000"
    }
  ]
}
```

### POST /api/orderbook/order

提交订单。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| marketKey | string | 是 | 市场标识 |
| outcomeIndex | number | 是 | 结果索引 |
| isBuy | boolean | 是 | 买入或卖出 |
| price | string | 是 | 价格（整数形式） |
| amount | string | 是 | 数量（整数形式） |
| salt | string | 是 | 随机盐值 |
| expiry | number | 是 | 过期时间戳 |
| signature | string | 是 | EIP-712 签名 |
| tif | string | 否 | Time In Force |
| postOnly | boolean | 否 | 仅做单 |

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "ord_123456",
    "status": "open",
    "filledAmount": "0",
    "remainingAmount": "1000000"
  }
}
```

### DELETE /api/orderbook/order

取消订单。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| orderId | string | 是 | 订单 ID |
| marketKey | string | 是 | 市场标识 |
| salt | string | 是 | 订单盐值 |

**响应：**

```json
{
  "success": true,
  "data": {
    "orderId": "ord_123456",
    "status": "cancelled"
  }
}
```

### GET /api/orderbook/orders

获取用户订单列表。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |
| status | string | 否 | 状态：open, filled, cancelled |
| marketKey | string | 否 | 市场标识 |
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |

### GET /api/orderbook/trades

获取交易历史。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| marketKey | string | 否 | 市场标识 |
| outcomeIndex | number | 否 | 结果索引 |
| limit | number | 否 | 数据条数，默认 50 |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": "t_123456",
      "marketKey": "137-1",
      "outcomeIndex": 0,
      "price": "0.52",
      "amount": "1000000",
      "maker": "0x...",
      "taker": "0x...",
      "timestamp": 1706100000
    }
  ]
}
```

---

## 市场模块

### GET /api/markets/map

获取市场地图。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| category | string | 否 | 分类 |
| status | string | 否 | 状态：open, closed, resolved |
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "marketKey": "137-1",
      "title": "Will ETH reach $5000 in 2024?",
      "category": "Crypto",
      "status": "open",
      "bestBid": "0.45",
      "bestAsk": "0.55",
      "volume24h": "1000000000"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### GET /api/markets/summary

获取市场摘要。

---

## 用户模块

### GET /api/user-profiles

获取用户资料。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |

**响应：**

```json
{
  "success": true,
  "data": {
    "id": "0x...",
    "address": "0x...",
    "email": "user@example.com",
    "username": "username",
    "avatarUrl": "https://...",
    "isAdmin": false,
    "isReviewer": false
  }
}
```

### GET /api/user-balance

获取用户余额。

**查询参数：**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |

**响应：**

```json
{
  "success": true,
  "data": {
    "available": "1000000000",
    "locked": "500000000",
    "total": "1500000000"
  }
}
```

---

## API 密钥模块

### POST /api/api-keys

创建 API 密钥。

**请求体：**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| name | string | 是 | 密钥名称 |
| permissions | string[] | 是 | 权限列表 |
| expiresAt | string | 否 | 过期时间（ISO 8601） |

**响应：**

```json
{
  "success": true,
  "data": {
    "id": "key_123456",
    "key": "fk_live_...",
    "name": "My API Key",
    "permissions": ["order:read", "order:write"],
    "createdAt": "2024-01-24T12:00:00Z"
  }
}
```

### GET /api/api-keys

获取 API 密钥列表。

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": "key_123456",
      "name": "My API Key",
      "permissions": ["order:read", "order:write"],
      "createdAt": "2024-01-24T12:00:00Z",
      "lastUsedAt": "2024-01-24T12:30:00Z"
    }
  ]
}
```

### DELETE /api/api-keys

删除 API 密钥。

---

## 错误代码参考

| 代码 | 描述 |
|------|------|
| UNAUTHORIZED | 未认证 |
| INVALID_SIGNATURE | 签名无效 |
| SESSION_EXPIRED | 会话过期 |
| VALIDATION_ERROR | 参数验证错误 |
| INVALID_ADDRESS | 地址格式无效 |
| NOT_FOUND | 资源不存在 |
| ALREADY_EXISTS | 资源已存在 |
| FORBIDDEN | 无权限访问 |
| ORDER_EXPIRED | 订单已过期 |
| INSUFFICIENT_BALANCE | 余额不足 |
| MARKET_CLOSED | 市场已关闭 |
| INTERNAL_ERROR | 服务器内部错误 |
| RATE_LIMIT | 请求过于频繁 |
