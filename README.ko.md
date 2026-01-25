<p align="center">
  <img src="apps/web/public/images/logo.png" alt="Foresight Logo" width="120" />
</p>

<h1 align="center">🔮 Foresight</h1>

<p align="center">
  <strong>차세대 분산 예측 시장 프로토콜</strong><br/>
  <em>전문가급 거래 경험 × UMA 오라클 분산 정산 × Web3 네이티브 아키텍처</em>
</p>

<p align="center">
  <a href="https://foresight.market">웹사이트</a> •
  <a href="./DOCS.md">문서</a> •
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

## 🌟 왜 Foresight인가?

### 핵심 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Foresight 기술 아키텍처                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   사용자 인터페이스 (Next.js 15)                                          │
│   ├── 반응형 디자인, 모바일 우선                                           │
│   ├── 실시간 주문북 깊이 표시                                              │
│   └── 원활한 Web3 지갑 통합                                               │
│                     │                                                    │
│                     ▼                                                    │
│   오프체인 주문북 (Relayer 서비스)                                        │
│   ├── EIP-712 서명 주문                                                   │
│   ├── 고성능 매칭 엔진                                                    │
│   └── Supabase 실시간 데이터 동기화                                       │
│                     │                                                    │
│                     ▼                                                    │
│   스마트 계약 계층 (Polygon)                                              │
│   ├── MarketFactory: 시장 공장 (UUPS 업그레이드 가능)                     │
│   ├── OffchainBinaryMarket: 이진 시장 템플릿                             │
│   ├── OffchainMultiMarket8: 다중 결과 시장 템플릿 (최대 8개)              │
│   ├── OutcomeToken1155: ERC-1155 결과 토큰                               │
│   └── UMAOracleAdapterV2: UMA 오라클 어댑터                             │
│                     │                                                    │
│                     ▼                                                    │
│   정산 계층 (UMA 프로토콜)                                                │
│   ├── 낙관적 오라클 메커니즘                                              │
│   ├── 분산 분쟁 중재                                                      │
│   └── 경제적 인센티브로 진실성 보장                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ 제품 기능

### 🎯 예측 시장

- **이진 시장**: YES/NO 간단하고 직관적인 예측
- **다중 결과 시장**: 2-8개 옵션의 복잡한 이벤트
- **실시간 확률**: 주문북 기반 동적 가격 책정
- **가스 없는 거래**: 오프체인 서명, 온체인 정산

### 🤝 소셜, 채팅 및 게이미피케이션

- **팔로우 시스템**: 상위 거래자 추적 및 실시간 활동 알림
- **사용자 카드**: 호버 시 승률, 수익률, 전문 데이터 확인
- **리더보드**: 실시간 수익 순위, 다차원 필터링 지원

### 💰 전문가급 거래 경험

- **지정가 주문**: 정확한 진입 가격 통제
- **시장가 주문**: 최상의 가격으로 즉시 체결
- **심도 차트**: 매수/매도 주문 분포 시각화
- **캔들스틱 차트**: 전문적인 가격 추세 분석

### 🔐 보안 및 분산화

- **UMA 오라클**: 분산된 결과 검증
- **다중 서명 거버넌스**: 3/5 다중서명 + 24시간 타임락
- **플래시 론 보호**: 단일 블록 거래 제한
- **서명 보안**: ECDSA 변형 보호

### 👛 지갑 지원

- MetaMask
- Coinbase Wallet
- WalletConnect
- 더 많은 지갑 지원 예정...

### 🌍 국제화

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇫🇷 Français
- 🇰🇷 한국어
- 🇪🇸 Español

---

## 🚀 빠른 시작

### 전제 조건

- Node.js 18+
- npm (권장)
- Git

### 설치 및 실행

```bash
# 저장소 복제
git clone https://github.com/Foresight-builder/Foresight-beta.git
cd Foresight-beta

# 의존성 설치
npm install

# 환경 변수 구성
cp .env.example .env.local

# Web + Relayer 시작 (권장)
npm run dev

# http://localhost:3000 방문
```

---

## 🏗️ 프로젝트 아키텍처

```
Foresight-beta/
├── apps/web/                 # Next.js 15 프론트엔드 애플리케이션
├── packages/contracts/       # Solidity 스마트 계약
├── services/relayer/         # 오프체인 주문북 서비스
├── infra/supabase/           # 데이터베이스 스크립트
└── scripts/                  # 배포 스크립트
```

---

## 📊 기술 사양

### 스마트 계약

| 계약                   | 설명                        | 감사 상태  |
| ---------------------- | --------------------------- | ---------- |
| `MarketFactory`        | UUPS 업그레이드 가능한 시장 | 🔄 진행 중 |
| `OffchainBinaryMarket` | 이진 시장 (YES/NO)          | 🔄 진행 중 |
| `OffchainMultiMarket8` | 다중 결과 (2-8개)           | 🔄 진행 중 |
| `OutcomeToken1155`     | ERC-1155 결과 토큰          | 🔄 진행 중 |
| `UMAOracleAdapterV2`   | UMA 오라클 통합             | 🔄 진행 중 |

### 보안 기능

- ✅ 재진입 보호 ReentrancyGuard
- ✅ 플래시 론 공격 보호
- ✅ 배치 작업 크기 제한
- ✅ ECDSA 변형 보호
- ✅ 비상 정지 메커니즘

### 성능 목표

| 지표 | 목표    |
| ---- | ------- |
| LCP  | < 2.5초 |
| INP  | < 200ms |
| CLS  | < 0.1   |

---

## 🔗 배포된 계약

### Polygon Amoy 테스트넷

| 계약               | 주소                                         |
| ------------------ | -------------------------------------------- |
| MarketFactory      | `0x0762A2EeFEB20f03ceA60A542FfC8EC85FE8A30`  |
| OutcomeToken1155   | `0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087` |
| UMAOracleAdapterV2 | `0x5e42fce766Ad623cE175002B7b2528411C47cc92` |

---

## 🛣️ 로드맵

### 1단계: 인프라 ✅

- [x] 핵심 스마트 계약 개발
- [x] 오프체인 주문북 서비스
- [x] 프론트엔드 거래 인터페이스
- [x] UMA 오라클 통합

### 2단계: 보안 ✅

- [x] 다중 서명 거버넌스 시스템
- [x] 타임락 메커니즘
- [x] 보안 감사 준비

### 3단계: 기능 ✅

- [x] 소셜 기능 강화
- [x] 게이미피케이션 플래그 시스템
- [x] 다차원 리더보드

### 4단계: 생태계 확장 🔄

- [ ] 모바일 앱
- [ ] 오픈 API 플랫폼
- [ ] 다중 체인 배포
- [ ] DAO 거버넌스

---

## 📚 문서 탐색

| 문서                                       | 설명                     |
| ------------------------------------------ | ------------------------ |
| [README.en.md](./README.en.md)             | 영어 문서                |
| [README.zh-CN.md](./README.zh-CN.md)       | 简体中文文档             |
| [README.es.md](./README.es.md)             | 문서 (스페인어)          |
| [README.fr.md](./README.fr.md)             | Documentation (프랑스어) |
| [README.ko.md](./README.ko.md)             | 한국어 문서              |
| [DOCS.md](./DOCS.md)                       | 기술 문서                |
| [SECURITY.md](./SECURITY.md)               | 보안 정책                |
| [CHANGELOG.md](./CHANGELOG.md)             | 변경 로그                |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | 행동 강령                |

---

## 🤝 기여

커뮤니티 기여를 환영합니다!

```bash
# 이 저장소 포크
# 기능 브랜치 생성
git checkout -b feature/amazing-feature

# 변경 사항 커밋
git commit -m 'feat(market): add amazing feature'

# 브랜치에 푸시
git push origin feature/amazing-feature

# Pull Request 생성
```

---

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](./LICENSE)를 따릅니다.

---

## 📞 연락처

<p align="center">
  <a href="https://foresight.market">🌐 웹사이트</a> •
  <a href="https://twitter.com/ForesightMarket">🐦 Twitter</a> •
  <a href="https://discord.gg/foresight">💬 Discord</a> •
  <a href="mailto:hello@foresight.market">📧 이메일</a>
</p>

---

<p align="center">
  <strong>Foresight 팀이 ❤️로 만들었습니다</strong><br/>
  <em>한 번에 하나의 시장으로 미래를 예측합니다.</em>
</p>
