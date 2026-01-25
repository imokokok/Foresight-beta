# 📚 Foresight 개발자 문서

> 스마트 계약, 프론트엔드 아키텍처, API 설계 및 배포를 다루는 완전한 기술 참조 매뉴얼.

---

## 📑 목차

- [아키텍처 개요](#아키텍처-개요)
- [스마트 계약](#스마트-계약)
- [프론트엔드 아키텍처](#프론트엔드-아키텍처)
- [API 참조](#api-참조)
- [데이터베이스 설계](#데이터베이스-설계)
- [배포 가이드](#배포-가이드)
- [보안 규범](#보안-규범)

---

## 아키텍처 개요

Foresight는 **오프체인 매칭 + 온체인 정산** 하이브리드 아키텍처를 채택하여 중앙화 거래소에 가까운 사용자 경험을 달성합니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              사용자 인터페이스 계층                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (Future)   │  │  (REST)     │  │  (Future)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                서비스 계층                                 │
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
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               블록체인 계층                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  MarketFactory | OutcomeToken1155 | UMAOracleAdapterV2             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 스마트 계약

### 계약 아키텍처

```
contracts/
├── MarketFactory.sol              # 시장 공장 (UUPS)
├── templates/
│   ├── OffchainBinaryMarket.sol   # 이진 시장
│   └── OffchainMultiMarket8.sol   # 다중 결과 시장
├── tokens/
│   └── OutcomeToken1155.sol       # ERC-1155 토큰
└── oracles/
    └── UMAOracleAdapterV2.sol     # UMA 오라클 어댑터
```

### 보안 기능

- ✅ 재진입 보호 ReentrancyGuard
- ✅ 플래시 론 공격 보호
- ✅ 배치 작업 크기 제한
- ✅ ECDSA 변형 보호
- ✅ 비상 정지 메커니즘

---

## 프론트엔드 아키텍처

### 기술 스택

| 카테고리   | 기술                 | 버전   |
| ---------- | -------------------- | ------ |
| 프레임워크 | Next.js (App Router) | 15.5.4 |
| UI         | React                | 19     |
| 언어       | TypeScript           | 5.0    |
| 스타일     | Tailwind CSS         | 3.4    |
| 상태       | React Query          | 5      |
| Web3       | ethers.js            | 6      |

###国际化

지원 언어:

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

---

## API 참조

### 인증 (SIWE)

- **GET /api/siwe/nonce**: 논스 생성
- **POST /api/siwe/verify**: 서명 검증

### 요청 제한

| 레벨     | 요청/분 |
| -------- | ------- |
| strict   | 5       |
| moderate | 20      |
| relaxed  | 60      |
| lenient  | 120     |

### 소셜 시스템

```text
# 사용자 팔로우
POST /api/user-follows/user
GET  /api/user-follows/counts

# 토론
GET  /api/discussions?proposalId=1
POST /api/discussions
```

### 포럼 시스템

```text
GET  /api/forum?eventId=1       # 스레드 가져오기
POST /api/forum                 # 스레드 생성
POST /api/forum/comments        # 댓글 생성
POST /api/forum/vote            # 투표
```

---

## 데이터베이스 설계

### 주요 테이블

```sql
-- 주문
CREATE TABLE public.orders (
  id BIGINT PRIMARY KEY,
  verifying_contract TEXT NOT NULL,
  maker_address TEXT NOT NULL,
  outcome_index INTEGER NOT NULL,
  is_buy BOOLEAN NOT NULL,
  price TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT DEFAULT 'open'
);

-- 거래
CREATE TABLE public.trades (
  id BIGINT PRIMARY KEY,
  market_address TEXT NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  maker_address TEXT NOT NULL,
  taker_address TEXT NOT NULL
);

-- 캔들 (OHLCV)
CREATE TABLE public.candles (
  id BIGINT PRIMARY KEY,
  market_address TEXT NOT NULL,
  resolution TEXT NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC NOT NULL
);
```

---

## 배포 가이드

### 스마트 계약

```bash
# 환경 변수 설정
export PRIVATE_KEY=your_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# 컴파일
npx hardhat compile

# 배포
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy
```

### 프론트엔드

```bash
cd apps/web
npm run build
vercel deploy --prod
```

### Relayer

```bash
cd services/relayer
npm run build
pm2 start dist/index.js --name foresight-relayer
```

---

## 보안 규범

### 스마트 계약

1. **재진입 보호**: `ReentrancyGuard` 사용
2. **접근 제어**: OpenZeppelin AccessControl
3. **플래시 론 보호**: 블록당 제한
4. **서명 보안**: ECDSA 변형 검사
5. **비상 정지**: 긴급 일시 중지

### 프론트엔드

1. **입력 검증**: `validateAndSanitize` 사용
2. **XSS 방지**: 원시 입력 직접 렌더링 금지
3. **CSRF 방지**: 서명 검증
4. **속도 제한**: `withRateLimit` 래퍼

---

## 추가 리소스

- [Next.js 문서](https://nextjs.org/docs)
- [React Query 문서](https://tanstack.com/query/latest)
- [OpenZeppelin 계약](https://docs.openzeppelin.com/contracts)
- [UMA 프로토콜](https://docs.uma.xyz)

---

**마지막 업데이트**: 2025-12-29

---

**언어 / Languages / 语言切换 / Idioma / Langue:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
