# Foresight 多签治理配置指南

本文档说明如何配置 Polymarket 风格的多签治理系统。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Gnosis Safe                            │
│                    (3/5 多签钱包)                            │
│                                                             │
│  签名者:                                                     │
│  ├── 创始人 A (EOA)                                         │
│  ├── 创始人 B (EOA)                                         │
│  ├── 技术负责人 (EOA)                                        │
│  ├── 法务顾问 (EOA)                                         │
│  └── 冷钱包备份 (硬件钱包)                                   │
│                                                             │
│  阈值: 3/5 (任意3人签名即可执行)                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ForesightTimelock                        │
│                   (24小时延迟执行)                           │
│                                                             │
│  作用:                                                       │
│  ├── 关键操作需要等待24小时                                  │
│  ├── 社区有时间审查和反对                                    │
│  └── 防止多签被盗后立即造成损失                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      受控合约                                │
│                                                             │
│  MarketFactory          UMAOracleAdapterV2                  │
│  ├── 注册模板            ├── 设置 Oracle 参数               │
│  ├── 设置费用            ├── 重置 INVALID 市场              │
│  └── 更改默认 Oracle     └── 更改 Reporter                  │
└─────────────────────────────────────────────────────────────┘
```

## 第一步：创建 Gnosis Safe

### 1.1 访问 Gnosis Safe

前往 [https://app.safe.global](https://app.safe.global)

### 1.2 创建新 Safe

1. 点击 **Create new Safe**
2. 选择你的网络（如 Polygon）
3. 输入 Safe 名称（如 "Foresight Governance"）

### 1.3 添加签名者

推荐配置 **5 个签名者**：

| 角色 | 说明 |
|------|------|
| 创始人 A | 日常运营决策 |
| 创始人 B | 业务决策 |
| 技术负责人 | 技术变更审核 |
| 法务顾问 | 合规审核 |
| 冷钱包 | 应急备份（Ledger/Trezor） |

### 1.4 设置阈值

选择 **3 of 5**（任意3人签名即可执行）

- 太低（如 1/5）：安全性不足
- 太高（如 5/5）：运营效率低，一人不可用则瘫痪

### 1.5 部署 Safe

支付 gas 费用，等待 Safe 创建完成。

**记录 Safe 地址**：`0x...`

---

## 第二步：部署 Timelock

### 2.1 设置环境变量

```bash
export SAFE_ADDRESS=0x你的Safe地址
export TIMELOCK_DELAY=86400  # 24小时（秒）

# 如果要配置现有合约
export MARKET_FACTORY_ADDRESS=0x...
export UMA_ADAPTER_ADDRESS=0x...
```

### 2.2 运行部署脚本

```bash
npx hardhat run scripts/deploy_governance.ts --network polygon
```

### 2.3 验证输出

脚本会输出：
- Timelock 合约地址
- 已配置的角色

---

## 第三步：验证配置

### 3.1 在区块浏览器验证

访问 Polygonscan，确认：
- Timelock 合约已部署
- MarketFactory 的 ADMIN_ROLE 包含 Timelock 地址
- UMAOracleAdapterV2 的 REPORTER_ROLE 包含 Safe 地址

### 3.2 测试一笔交易

通过 Safe 提交一个测试交易（如修改一个无害参数），验证流程：

1. 在 Safe 中创建交易
2. 收集签名（达到阈值）
3. 提交到 Timelock（进入队列）
4. 等待延迟期（测试时可设短一点，如 60 秒）
5. 执行交易

---

## 第四步：撤销部署者权限

⚠️ **重要**：验证一切正常后，必须撤销部署者的管理员权限！

### 4.1 通过 Safe + Timelock 撤销

在 Safe 中创建交易调用：

```solidity
// 撤销 MarketFactory 的部署者权限
factory.revokeRole(DEFAULT_ADMIN_ROLE, 部署者地址);

// 撤销 UMAOracleAdapterV2 的部署者权限
umaAdapter.revokeRole(DEFAULT_ADMIN_ROLE, 部署者地址);
umaAdapter.revokeRole(REPORTER_ROLE, 部署者地址);
```

---

## 角色分配总结

| 合约 | 角色 | 持有者 | 说明 |
|------|------|--------|------|
| MarketFactory | ADMIN_ROLE | Timelock | 通过 Timelock 延迟执行 |
| UMAOracleAdapterV2 | DEFAULT_ADMIN_ROLE | Timelock | 通过 Timelock 延迟执行 |
| UMAOracleAdapterV2 | REPORTER_ROLE | Safe | 直接执行（有 UMA liveness 保护） |
| UMAOracleAdapterV2 | REGISTRAR_ROLE | Timelock | 通过 Timelock 延迟执行 |

---

## 日常操作流程

### 提交市场结算断言

1. Reporter（Safe）收集 3/5 签名
2. Safe 调用 `umaAdapter.requestOutcome(marketId, outcomeIndex, claim)`
3. UMA liveness 期间（如 2 小时）可被争议
4. 无争议则自动生效

### 修改系统参数

1. Safe 创建交易调用目标函数
2. 收集 3/5 签名
3. 交易进入 Timelock 队列
4. 等待 24 小时
5. 任何人可执行

---

## 紧急情况处理

### 如果发现漏洞

1. 多签持有者立即在 Safe 中提交 `pause()` 交易
2. 收集签名后直接执行（暂停不需要 Timelock，因为市场有 `onlyFactoryOrCreator`）
3. 修复漏洞
4. 通过 Timelock 执行 `unpause()`

### 如果 Timelock 队列中有恶意交易

在 24 小时延迟期内：
1. 公开披露问题
2. 准备撤销交易
3. 联系社区审查

---

## 安全检查清单

- [ ] Safe 有 5 个签名者
- [ ] 阈值设置为 3/5
- [ ] Timelock 延迟至少 24 小时
- [ ] 部署者权限已撤销
- [ ] 所有签名者的私钥分开保管
- [ ] 至少 1 个硬件钱包签名者
- [ ] 测试过完整的治理流程

