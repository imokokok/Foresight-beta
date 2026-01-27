# 🔐 Security Policy

> Security guidelines, vulnerability reporting process, and best practices for the Foresight protocol.

---

## 📋 Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)
- [Security Response Process](#security-response-process)
- [Security Best Practices](#security-best-practices)
- [Smart Contract Security](#smart-contract-security)
- [Bug Bounty Program](#bug-bounty-program)

---

## Supported Versions

We provide security updates for the following versions:

| Version        | Support Status           |
| -------------- | ------------------------ |
| Latest         | ✅ Supported             |
| Previous Major | ⚠️ Security Updates Only |
| Older          | ❌ Not Supported         |

---

## Reporting Vulnerabilities

### ⚠️ Please Do Not Disclose Publicly

**DO NOT** discuss security vulnerabilities in public channels (GitHub Issues, Discord, Twitter, etc.) before the issue is fixed.

### 📧 Reporting Method

Please report security vulnerabilities through:

**Email**: [security@foresight.market](mailto:security@foresight.market)

### Report Content

Please include the following information in your report:

1. **Vulnerability Description**: Clear description of the vulnerability nature
2. **Impact Scope**: Affected components/functions
3. **Reproduction Steps**: Detailed reproduction steps
4. **Proof of Concept**: PoC code or screenshots (if available)
5. **Severity Assessment**: Your assessment of vulnerability severity
6. **Suggested Fix**: If you have one

### Report Template

```markdown
## Vulnerability Description

[Brief description of the vulnerability]

## Impact Scope

- Component: [e.g., Smart Contracts/Frontend/API]
- Version: [Affected version]
- Severity: [Critical/High/Medium/Low]

## Reproduction Steps

1. [Step 1]
2. [Step 2]
3. ...

## Proof of Concept

[PoC code or detailed explanation]

## Potential Impact

[Describe possible attack scenarios and impact]

## Suggested Fix

[If available]
```

---

## Security Response Process

### Response Time

| Phase                      | Time Target       |
| -------------------------- | ----------------- |
| Initial Response           | Within 24 hours   |
| Vulnerability Confirmation | Within 72 hours   |
| Fix Plan                   | Within 7 days     |
| Fix Release                | Based on severity |

### Severity Definition

| Level        | Description                | Fix Time       |
| ------------ | -------------------------- | -------------- |
| **Critical** | May lead to financial loss | 24-48 hours    |
| **High**     | Severe function impairment | Within 7 days  |
| **Medium**   | Medium impact              | Within 30 days |
| **Low**      | Minor issues               | Next release   |

### Handling Process

```
1. Receive Report
   ↓
2. Acknowledge (24h)
   ↓
3. Vulnerability Verification (72h)
   ↓
4. Assess Severity
   ↓
5. Develop Fix Plan
   ↓
6. Develop Fix Patch
   ↓
7. Internal Security Review
   ↓
8. Release Fix
   ↓
9. Public Disclosure (coordinated)
```

---

## Security Best Practices

### User Security Suggestions

#### 🔑 Private Key Security

- **NEVER** share your private key or seed phrase
- Use hardware wallet for large amounts
- Regularly check authorized DApps

#### 🌐 Network Security

- Only visit official website: [https://foresight.market](https://foresight.market)
- Verify URL and SSL certificate
- Beware of phishing websites and fake social accounts

#### 💳 Transaction Security

- Check transaction details carefully before trading
- Set reasonable slippage protection
- Use small amounts to test before large operations

### Developer Security Suggestions

#### Environment Variables

```bash
# ✅ Correct
cp .env.example .env.local
# Edit .env.local

# ❌ Wrong
# Never commit .env.local to Git
```

#### Dependency Management

```bash
# Regularly check for dependency vulnerabilities
npm audit

# Update vulnerable dependencies
npm audit fix
```

### Runtime Security & Rate Limiting

- Authentication endpoints use SIWE, email OTP, and magic links instead of passwords where possible
- High-risk routes (such as `/api/siwe/verify`) are protected by strict IP-based rate limiting
- Security headers and CSP are configured at the framework level to reduce XSS risk
- Authentication and risk-control events are logged for auditability and anomaly detection

---

## Smart Contract Security

### Implemented Security Measures

#### Access Control

- ✅ OpenZeppelin AccessControl
- ✅ Multi-signature Wallet (Gnosis Safe)
- ✅ 24-hour Timelock

#### Reentrancy Protection

- ✅ ReentrancyGuard on all external calls
- ✅ Checks-Effects-Interactions Pattern

#### Signature Security

- ✅ EIP-712 Structured Signatures
- ✅ ECDSA Malleability Protection
- ✅ Order Salt Uniqueness Check

#### Economic Security

- ✅ Flash Loan Attack Protection (single-block limit)
- ✅ Batch Operation Size Limits
- ✅ Minimum Order Lifetime

#### Emergency Measures

- ✅ Circuit Breaker (Emergency Pause)
- ✅ Hierarchical Permission System

### Audit Status

| Contract             | Audit Status   | Auditor |
| -------------------- | -------------- | ------- |
| MarketFactory        | 🔄 In Progress | -       |
| OffchainBinaryMarket | 🔄 In Progress | -       |
| OffchainMultiMarket8 | 🔄 In Progress | -       |
| OutcomeToken1155     | 🔄 In Progress | -       |
| UMAOracleAdapterV2   | 🔄 In Progress | -       |

### Known Limitations

1. **Oracle Dependency**: Market settlement relies on UMA oracle
2. **Admin Permissions**: Multi-sig can pause contracts and upgrade implementations
3. **Timelock Delay**: Emergency situations require 24-hour wait

---

## Bug Bounty Program

We are preparing a formal bug bounty program. Before that, effective security reports will receive rewards based on severity:

| Severity | Reward Range     |
| -------- | ---------------- |
| Critical | $5,000 - $20,000 |
| High     | $2,000 - $5,000  |
| Medium   | $500 - $2,000    |
| Low      | $100 - $500      |

### Reward Conditions

- ✅ First report of the vulnerability
- ✅ Provide effective reproduction steps
- ✅ Follow responsible disclosure process
- ✅ No actual damage caused

### Exclusion Scope

The following are not eligible for rewards:

- ❌ Known issues or already reported vulnerabilities
- ❌ Social engineering attacks
- ❌ Physical attacks
- ❌ DoS attacks (unless special impact)
- ❌ Third-party service vulnerabilities
- ❌ Issues on testnets

---

## Contact

- **Security Issues**: [security@foresight.market](mailto:security@foresight.market)
- **General Inquiries**: [hello@foresight.market](mailto:hello@foresight.market)
- **Discord**: [Foresight Community](https://discord.gg/foresight)

---

Thank you for helping us protect the Foresight ecosystem! 🛡️

---

**Languages / 语言切换:**

- [🇺🇸 SECURITY.md](./SECURITY.md) - English
- [🇨🇳 SECURITY.zh-CN.md](./SECURITY.zh-CN.md) - 简体中文
