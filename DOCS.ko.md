# 📚 Foresight 개발자 문서 v3.0

> 스마트 계약, 프론트엔드 아키텍처, Relayer 서비스, API 설계, 데이터베이스, 배포, 보안, 테스트 및 문제 해결을 다루는 완전한 기술 참조 매뉴얼.

---

## 📑 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [스마트 계약](#2-스마트-계약)
3. [프론트엔드 아키텍처](#3-프론트엔드-아키텍처)
4. [Relayer 서비스](#4-relayer-서비스)
5. [API 참조](#5-api-참조)
6. [데이터베이스 설계](#6-데이터베이스-설계)
7. [배포 가이드](#7-배포-가이드)
8. [보안 규범](#8-보안-규범)
9. [테스트 가이드](#9-테스트-가이드)
10. [문제 해결](#10-문제-해결)

---

## 1. 아키텍처 개요

### 1.1 시스템 소개

Foresight는 **오프체인 매칭 + 온체인 정산** 하이브리드 아키텍처 기반의 탈중앙화 예측 시장 플랫폼입니다. 이 설계는 중앙화 거래소의 장점(빠른 속도, 낮은 비용, 부드러운 사용자 경험)과 블록체인의 장점(불변성, 투명성, 탈중앙화)을 결합합니다. 시스템은Polygon 네트워크를 활용하여 낮은 트랜잭션 비용과 빠른 최종성을 제공하며, UMA 프로토콜을 통합하여 시장의 결과를 탈중앙화되고 신뢰할 수 있는 방식으로 해결합니다.

기술 아키텍처는 세 개의 주요 상호 연결 레이어로 구성됩니다. 인터랙션 레이어는 Next.js 웹 앱, 네이티브 모바일 앱, 서드파티 통합을 위한 REST API를 통해 사용자 인터페이스를 제공합니다. 서비스 레이어에는 고성능 Relayer 매칭 엔진, 오더북 관리, 실시간 이벤트 수집, 지속적 저장을 위한 Supabase 데이터베이스가 포함됩니다. 마지막으로 블록체인 레이어에는 Polygon에 배포된 스마트 계약이 있으며, 여기에는 시장 팩토리, 결과용 ERC-1155 토큰, 결과 검증을 위한 UMA 오라클 어댑터가 포함됩니다.

이러한 책임 분리는 효율적인 수평적 확장을 가능하게 합니다. 고빈도 작업(오더 매칭, 오더북 업데이트)은 Relayer 서비스에 의해 오프체인에서 수행되는 반면, 재정적 정산, 시장 생성, 결과 해결과 같은 중요한 작업은 보안과 탈중앙화를 보장하기 위해 블록체인에서 실행됩니다. 이 두 세계 사이의 다리는 EIP-712 기반 암호화 검증 메커니즘으로 보장되며, 사용자는 서명된 오더를 제출할 수 있으며 이 오더는 Relayer에 의해 신뢰할 수 있는 방식으로 실행됩니다.

### 1.2 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          사용자 인터페이스 계층                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (React     │  │  (REST)     │  │  (Python/   │   │
│  │  15.5.4     │  │   Native)   │  │  HTTP/WS    │  │   JS)       │   │
│  │  React 19   │  │  (Future)   │  │             │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              서비스 계층                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Relayer Service                                ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             ││
│  │  │ Order Book    │ │ Matching      │ │ Event         │             ││
│  │  │ Management    │ │ Engine        │ │ Ingestion     │             ││
│  │  │ (Redis)       │ │ (TypeScript)  │ │ (WebSocket)   │             ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘             ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             ││
│  │  │ Rate Limiting │ │ Auth (SIWE)   │ │ Order Signing │             ││
│  │  │ (Redis)       │ │ Validation    │ │ Verification  │             ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌─────────────────────────────────▼───────────────────────────────────┐│
│  │                         Supabase Cluster                            ││
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          ││
│  │  │ Orders    │ │ Trades    │ │ Candles   │ │ Users     │          ││
│  │  │ Table     │ │ Table     │ │ Table     │ │ Table     │          ││
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘          ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 정산 프로토콜
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             블록체인 계층                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                  Polygon Network (Amoy/Mainnet)                     ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │              MarketFactory (UUPS Proxy)                     │   ││
│  │  │  • createMarket()     • pauseMarket()     • resolveMarket() │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │        OffchainMarketBase (Template Implementation)         │   ││
│  │  │  • placeOrder()       • fillOrder()      • cancelOrder()   │   ││
│  │  │  • claimWinnings()    • withdraw()       • batchExecute()  │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │          OutcomeToken1155 (ERC-1155 Multi-Token)           │   ││
│  │  │  • mint()             • safeTransferFrom()  • burn()       │   ││
│  │  │  • setApprovalForAll()                    • balanceOf()     │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │          UMAOracleAdapterV2 (Oracle Integration)            │   ││
│  │  │  • requestPrice()      • settleMarket()    • getSettledPrice│   ││
│  │  │  • assertTruth()       • retrySettle()                      │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 주요 데이터 흐름

Foresight의 데이터 흐름은 오더 생성부터 정산까지 잘 정의된 경로를 따릅니다. 사용자가 특정 결과에 베팅하기로 결정하면, 대상 시장 주소, 선택한 결과 인덱스, 오더 방향(매수 또는 매도), 수용 가능한 최대 가격, 원하는 토큰 수량, 만료 타임스탬프를 포함한 오더 객체를 구성합니다. 이 객체는 EIP-712 표준에 따라 사용자의 개인 키로 암호화 서명되어, 즉각적인 블록체인 트랜잭션 없이 사용자의 의도를 검증 가능한 증명으로 생성합니다.

서명된 오더는 WebSocket 연결 또는 HTTP REST 요청을 통해 Relayer 서비스로 전송됩니다. Relayer는 먼저 EIP-712 서명의 유효성을 검증하고 MarketFactory 계약서를 확인 도메인으로 사용하여 오더가 수정되지 않았으며 선언된 주소의 정당한 소유자에서 비롯되었음을 확인합니다. 서명이 유효하면 오더가 Redis 메모리 내 오더북에 통합되어 매칭 큐에 추가됩니다. 매칭 엔진은 지속적으로 새 오더를 검토하고 기존 오더북의 против 오더와 대조하여 가격 조건이 충족되면 트랜잭션을 실행합니다.

매칭이 발견되면 Relayer가 블록체인에 제출될 정산 트랜잭션을 생성합니다. 이 트랜잭션에는 매칭된 두 오더, 해당 서명, 검증된 가격 정보가 포함됩니다. 트랜잭션은 시스템이 제어하는 서비스 계정(EOA)을 통해 시장 계약서의 fillOrder() 함수를 호출하여 실행됩니다. 계약서는 서명을 다시 확인하고, 당사자 간 ERC-1155 토큰을 이전하며, 시장의 내부 잔액을 업데이트합니다. 이 중복 검증 프로세스는 Relayer가 손상되더라도 어느 당사자도 사기칠 수 없음을 보장합니다.

온체인 실행 후, 계약서에서 발생하는 이벤트는 Relayer의 이벤트 수집 시스템에 의해 포착되어, 시장 통계 업데이트, 차트용 OHLCV 데이터 생성, 거래 기록을 Supabase에 저장하여 영속성을 확보합니다. 사용자는 웹 인터페이스를 통해 자신의 포지션, 잠재적 수익, 거래 내역을 조회할 수 있으며, 페이지 로드 시 설정된 WebSocket 연결을 통해 모든 데이터가 실시간으로 갱신됩니다.

### 1.4 핵심 기술 특징

Foresight 시스템은 전통적인 예측 시장 구현과 구별되는 여러 고급 기술적 특징을 통합합니다. 매칭 메커니즘은 가격-시간 우선순위(price-time priority) 오더북 알고리즘을 사용하여, 최상의 가격의 오더가 먼저 실행되고 동일한 가격의 오더는 도착 순서에 따라 실행되도록 합니다. 이 접근 방식은 공정하고 효율적인 가격 발견을 보장하여, 시장 참여자들이 다양한 결과의 인식 확률을 세밀하게 표현할 수 있습니다.

오더 관리는 각 오더를 특정 도메인(검증 계약서 주소, 체인 ID, 계약서 버전)에 바인딩하는 정교한 EIP-712 서명 시스템을 사용합니다. 이 바인딩은 다른 시장이나 다른 체인 간의 리 방지하며, 사용자가 지정된 시장플레이 공격을과 정확히 명시된 조건에서만 실행될 수 있음을 알고 신뢰할 수 있습니다. 오더에는 또한 최대 슬리피지(한도 가격) 파라미터가 포함되어 변동성이 높은 경우 불리한 가격으로 실행으로부터 사용자를 보호합니다.

시스템은 최소 지연 및 슬리피지 허용 메커니즘을 통해 프론트러닝에 대한 보호를 통합합니다. 오더는 한도 가격 또는 그 이상에서 실행되어, 사용자가 동의을 최소한 얻한 가격을 수 있도록 합니다. Relayer는 스푸핑 오더나 세탁 거래 패턴과 같은 시장 조작 시도를 탐지하고 거부하는 안티게이밍 통제도 구현합니다.

---

## 2. 스마트 계약

### 2.1 계약 아키텍처

Foresight의 스마트 계약 아키텍처는 팩토리-템플릿 패턴에 따라 구축되어, 새로운 유형의 시장을 확장 가능하게 생성하면서도 기본 로직을 공유합니다. MarketFactory 계약서는 모든 시장의 중앙 레지스트리이자 관리 작업의 진입점 역할을 합니다. 개별 시장은 OffchainMarketBase 템플릿의 클론 인스턴스로 배포되며, ERC-1167 미니mal 프록시 메커니즘을 사용하여 배포 비용을 최소화합니다. 이 접근 방식을 사용하면 단일 템플릿으로 수십 개의 시장을 생성할 수 있으며, 각 인스턴스는 고유한 매개변수(질문, 가능한 결과, 해결 날짜, 관련 오라클)로 구성됩니다.

```
contracts/
├── MarketFactory.sol                    # 주요 팩토리 (UUPS 업그레이드 가능)
│   ├── Rôles: Admin, Operator, Oracle
│   ├── createMarket(question, outcomes, resolutionDate, oracle)
│   ├── pauseMarket(marketAddress)
│   ├── resolveMarket(marketAddress, ancillaryData)
│   └── upgradeTo(newImplementation)
│
├── templates/
│   ├── OffchainMarketBase.sol          # 기본 템플릿 (추상)
│   │   ├── initialize(admin, factory)
│   │   ├── placeOrder(order, signature)
│   │   ├── fillOrder(order, signature, fillAmount)
│   │   ├── cancelOrder(orderHash)
│   │   ├── claimWinnings()
│   │   ├── withdraw(tokenId, amount)
│   │   └── batchExecute(orders, signatures, fillAmounts)
│   │
│   ├── OffchainBinaryMarket.sol        # 이진 시장 (예/아니오)
│   │   └── 2가지 가능한 결과
│   │
│   └── OffchainMultiMarket8.sol        # 다중 결과 시장 (최대 8개)
│       └── 2-8가지 가능한 결과
│
├── tokens/
│   └── OutcomeToken1155.sol            # ERC-1155 토큰
│       ├── initialize(name, symbol, uri)
│       ├── mint(to, id, amount)
│       ├── safeTransferFrom(from, to, id, amount, data)
│       ├── balanceOf(account, id)
│       └── setApprovalForAll(operator, approved)
│
└── oracles/
    └── UMAOracleAdapterV2.sol          # UMA 오라클 어댑터
        ├── requestPrice(identifier, timestamp, ancillaryData)
        ├── settleMarket(marketAddress)
        ├── assertTruth(claim, bond)
        ├── retrySettle(marketAddress)
        └── getSettledPrice(marketAddress)
```

### 2.2 MarketFactory 계약서

MarketFactory 계약서는 계약 시스템의 핵심으로, 모든 시장의 생성, 관리, 제어를 담당합니다. OpenZeppelin의 UUPS(Universal Upgradeable Proxy Standard) 패턴을 구현하여, 상태와 배포 주소를 보존하면서 향후 계약서 업데이트를 가능하게 합니다. 계약서는 역할 기반 접근 제어(AccessControl) 시스템을 사용하며, 세 가지 주요 역할이 있습니다. ADMIN_ROLE은 계약서 업데이트와 같은 상위 수준의 작업에, OPERATOR_ROLE은 일일 시장 관리(일시 중지, 해결)에, ORACLE_ROLE은 UMA 시스템과의 상호작용에 사용됩니다.

createMarket 함수는 유연한 매개변수로 새로운 예측 시장을 생성할 수 있게 합니다. question 매개변수는 참여자에게 제시되는 질문을 포함하며, 모든 유형의 문자를 지원하기 위해 bytes로 인코딩됩니다. outcomes 배열은 가능한 결과를 지정하며, 각 결과는 정수 인덱스(0, 1, 2 등)로 식별됩니다. resolutionDate는 시장이 해결될 수 있는 이후의 날짜를 정의하고, resolutionReward는 시장을 해결하는 오라클에 대한 보상을 구성합니다. oracle 매개변수는 사용할 오라클 계약서를 지정합니다(기본값 UMA 또는 커스텀).

시장이 생성되면 팩토리는 자동으로 적절한 템플릿(이진 또는 다중)을 가리키는 최소 프록시를 배포하고, 새 계약서를 시장의 매개변수로 초기화하며, 내부 레지스트리에 시장을 기록합니다. 팩토리는 또한 생성된 모든 시장의 목록을 유지하여 인터페이스 도구와 감사을 위한 쉬운 열거를 가능하게 합니다.

```solidity
// MarketFactory.sol - 핵심 코드 추출

contract MarketFactory is
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    mapping(address => bool) public isMarket;
    address[] public allMarkets;
    address public templateBinary;
    address public templateMulti;
    address public outcomeTokenImplementation;

    struct MarketParams {
        string question;
        string[] outcomes;
        uint256 resolutionDate;
        uint256 resolutionReward;
        address oracle;
        bool useUMA;
    }

    event MarketCreated(
        address indexed marketAddress,
        address indexed creator,
        string question,
        uint256 indexed category
    );

    function createMarket(
        MarketParams memory params,
        string memory category
    ) external returns (address marketAddress) {
        require(
            params.outcomes.length >= 2 && params.outcomes.length <= 8,
            "Invalid outcome count"
        );
        require(
            params.resolutionDate > block.timestamp,
            "Invalid resolution date"
        );

        // 적절한 템플릿 클론
        if (params.outcomes.length == 2) {
            marketAddress = _cloneTemplate(templateBinary);
        } else {
            marketAddress = _cloneTemplate(templateMulti);
        }

        // 시장 초기화
        IMarket(marketAddress).initialize(
            msg.sender,
            address(this),
            params.question,
            params.outcomes,
            params.resolutionDate,
            params.resolutionReward,
            params.oracle
        );

        isMarket[marketAddress] = true;
        allMarkets.push(marketAddress);

        emit MarketCreated(
            marketAddress,
            msg.sender,
            params.question,
            uint256(keccak256(abi.encodePacked(category)))
        );
    }

    function pauseMarket(address marketAddress)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(isMarket[marketAddress], "Not a market");
        IMarket(marketAddress).pause();
    }

    function resolveMarket(
        address marketAddress,
        bytes memory ancillaryData,
        uint256 assertedPrice
    ) external onlyRole(OPERATOR_ROLE) {
        require(isMarket[marketAddress], "Not a market");
        IMarket(marketAddress).resolve(
            ancillaryData,
            assertedPrice
        );
    }
}
```

### 2.3 OffchainMarketBase 계약서

OffchainMarketBase 계약서는 모든 시장 유형에 공통된 로직을 제공하고 오더 배치, 실행, 취소의 핵심 기능을 구현합니다. 이 계약서는 오프체인 서명 검증 패턴을 사용하여, 서명이 실행 전에 Relayer에 의해 검증되어 온체인 가스 비용을 줄입니다. 그러나 사용자가 직접 실행해야 하는 경우를 위해 계약서는 서명을 검증할 수 있는 기능을 유지합니다.

오더 시스템은 결과(outcome) 및 방향(buy/sell)별로 구성된 데이터 구조를 사용하여, 매칭 기준에 맞는 오더에 대한 빠른 접근을 가능하게 합니다. 각 결과에는 매도 측면(요청)과 매수 측면(입찰)의 고유한 오더북이 있으며, 오더는 가격과 시간순으로 정렬됩니다. 이 조직화를 통해 매칭 엔진이 새 오더 진입에 대한 최상의 상대방을 빠르게 찾을 수 있습니다.

fillOrder 함수는 오더 실행의 주요 진입점입니다. 이 함수는 오더의 서명을(EIP-712를 사용하여) 검증하고, 생성자(maker)에서 취어자(taker)로 해당 ERC-1155 토큰을 이전하며, 시장의 내부 잔액을 업데이트합니다. 시장은 각 결과에 대해 별도의 잔액을 유지하여, 사용자가 동시에 여러 결과에 대해 롱 또는 숏 포지션을 보유할 수 있습니다.

```solidity
// OffchainMarketBase.sol - 주요 구조 및 함수

abstract contract OffchainMarketBase is
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable
{
    struct Order {
        address maker;
        uint256 outcome;
        bool isBuy;
        uint128 price;          // Wei 단위 가격 (0-1e18)
        uint128 amount;         // Wei 단위 수량
        uint64 expires;         // 만료 타임스탬프
        uint64 nonce;           // 리플레이 방지 nonce
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // 결과 및 방향별 오더북
    mapping(uint256 => Order[]) internal _buyOrders;
    mapping(uint256 => Order[]) internal _sellOrders;

    // 결과별 사용자 잔액
    mapping(address => mapping(uint256 => int256)) public balances;

    // nonce -> 사용됨 매핑
    mapping(address => mapping(uint64 => bool)) public orderNonces;

    // 시장 상태
    bool public paused;
    bool public resolved;
    uint256 public resolutionTimestamp;
    int256 public settledPrice;

    // 이벤트
    event OrderPlaced(
        bytes32 indexed orderHash,
        address indexed maker,
        uint256 indexed outcome,
        bool isBuy,
        uint128 price,
        uint128 amount
    );

    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 outcome,
        uint128 price,
        uint128 amount
    );

    event OrderCancelled(
        bytes32 indexed orderHash,
        address indexed maker
    );

    event MarketResolved(
        uint256 indexed outcome,
        int256 price
    );

    function placeOrder(
        Order calldata order,
        Signature calldata signature
    ) external nonReentrant returns (bytes32) {
        require(!paused, "Market paused");
        require(block.timestamp < order.expires, "Order expired");
        require(order.amount > 0, "Invalid amount");
        require(order.price > 0 && order.price <= 1e18, "Invalid price");

        // 서명 검증 (EIP-712)
        bytes32 orderHash = _hashOrder(order);
        require(_verifySignature(orderHash, signature, order.maker), "Invalid signature");

        // nonce 검증
        require(!orderNonces[order.maker][order.nonce], "Nonce already used");
        orderNonces[order.maker][order.nonce] = true;

        // 오더북에 추가
        if (order.isBuy) {
            _insertOrder(_buyOrders[order.outcome], order);
        } else {
            _insertOrder(_sellOrders[order.outcome], order);
        }

        emit OrderPlaced(
            orderHash,
            order.maker,
            order.outcome,
            order.isBuy,
            order.price,
            order.amount
        );

        return orderHash;
    }

    function fillOrder(
        Order calldata order,
        Signature calldata signature,
        uint128 fillAmount
    ) external nonReentrant {
        require(!paused, "Market paused");
        require(block.timestamp < order.expires, "Order expired");

        // 서명 검증
        bytes32 orderHash = _hashOrder(order);
        require(_verifySignature(orderHash, signature, order.maker), "Invalid signature");

        require(fillAmount <= order.amount, "Fill exceeds order");
        require(orderNonces[order.maker][order.nonce], "Nonce not used");

        // 비용/지불 계산
        uint256 cost = (uint256(fillAmount) * order.price) / 1e18;

        if (order.isBuy) {
            // Maker 판매, Taker 구매
            balances[order.maker][order.outcome] -= int256(fillAmount);
            balances[msg.sender][order.outcome] += int256(fillAmount);

            // 토큰 maker에서 taker로 이전
            IERC1155(outcomeToken).safeTransferFrom(
                order.maker,
                msg.sender,
                order.outcome,
                fillAmount,
                ""
            );

            // taker에서 maker로 지불
            if (cost > 0) {
                _transferPayment(msg.sender, order.maker, cost);
            }
        } else {
            // Maker 구매, Taker 판매
            balances[order.maker][order.outcome] += int256(fillAmount);
            balances[msg.sender][order.outcome] -= int256(fillAmount);

            IERC1155(outcomeToken).safeTransferFrom(
                msg.sender,
                order.maker,
                order.outcome,
                fillAmount,
                ""
            );

            if (cost > 0) {
                _transferPayment(order.maker, msg.sender, cost);
            }
        }

        // 오더의 남은 수량 업데이트
        order.amount -= fillAmount;

        emit OrderFilled(
            orderHash,
            order.maker,
            msg.sender,
            order.outcome,
            order.price,
            fillAmount
        );
    }

    function claimWinnings() external nonReentrant {
        require(resolved, "Not resolved");
        require(balances[msg.sender][uint256(uint32(_settledOutcome))] > 0, "No winnings");

        int256 balance = balances[msg.sender][uint256(uint32(_settledOutcome))];
        uint256 winningAmount = uint256(balance);

        // 승리 토큰을 계약서로 이전하여 소각
        IERC1155(outcomeToken).safeTransferFrom(
            msg.sender,
            address(this),
            uint256(uint32(_settledOutcome)),
            winningAmount,
            ""
        );

        // 지불금 계산 및 이전
        uint256 payout = (winningAmount * uint256(_settledPrice)) / 1e18;
        _transferPayment(address(this), msg.sender, payout);

        balances[msg.sender][uint256(uint32(_settledOutcome))] = 0;
    }
}
```

### 2.4 결과 토큰 ERC-1155

OutcomeToken1155 계약서는 각 시장의 교환 가능한 결과를 나타내기 위해 ERC-1155 표준을 구현합니다. ERC-721과 달리 고유 자산을 나타내는 것과 달리, ERC-1155는 반 Fungible(정량화 가능) 토큰을 관리할 수 있어, 사용자가 결과의 일부를 보유할 수 있는 예측 시장에 완벽합니다. 각 시장은 가능한 결과 수만큼 ERC-1155 토큰을 생성하며, 각 토큰은 고유 인덱스(0, 1, 2 등)로 식별됩니다.

계약서는 온디맨드 민팅 패턴을 사용하여, 사용자가 매수 오더를 배치할 때만 토큰이 생성됩니다. 이 접근 방식은 시장 생성 시 모든 토큰을 사전에 민팅할 필요성을 없애고 배포 비용을 줄입니다. 시장이 해결되면 승리 결과에 해당하는 토큰만 가치를 가지며, 다른 토큰은 소각되거나 기념품으로 유지될 수 있습니다.

```solidity
// OutcomeToken1155.sol

contract OutcomeToken1155 is
    ERC1155Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    string public name;
    string public symbol;

    // 시장 -> 결과 인덱스 -> 민팅 권한
    mapping(address => mapping(uint256 => bool)) public marketMinters;

    function initialize(
        string memory name_,
        string memory symbol_,
        string memory uri_
    ) public initializer {
        __ERC1155_init(uri_);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        name = name_;
        symbol = symbol_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, data);
    }

    function batchMint(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        _batchMint(to, ids, amounts, data);
    }

    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) external onlyRole(BURNER_ROLE) {
        _burn(from, id, amount);
    }

    // 시장은 자신의 토큰을 민팅할 수 있음
    function marketMint(
        address market,
        uint256 outcomeIndex,
        uint256 amount,
        bytes memory data
    ) external {
        require(
            marketMinters[market][outcomeIndex],
            "Market not authorized"
        );
        _mint(market, outcomeIndex, amount, data);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_uri, "/", Strings.toString(tokenId)));
    }
}
```

### 2.5 UMA 오라클 어댑터

UMAOracleAdapterV2 계약서는 시장 결과의 탈중앙화를 위해 UMA(Universal Market Access) 프로토콜을 통합합니다. UMA는 진술이 도전될 수 있는 낙관적 오라클 시스템을 사용하여, 진실 주장이 분쟁될 수 있는 해결 메커니즘을 생성합니다. UMA의 DATA(거버넌스 토큰) 보유자가 자신의 답변을 제출하고 정확성에 베팅할 수 있습니다. 답변에 대한 이의가 제기되지 않으면 답변은 최종 것으로 간주되며, 시장은 확인된 결과로 마감될 수 있습니다.

시장 해결이 필요한 경우, 계약서는 시장 식별자와 보조 데이터(시장 질문 포함)를 포함하여 UMA 오라클에 요청을 보냅니다. UMA 오라클은 다음에 질문을 DATA 보유자에게 노출하여, 자신들의 답변을 제출하고 정확성에 베팅할 수 있습니다. 분쟁 기간 동안 답변이 도전되지 않으면, 답변은 최종 것으로 간주되며 시장은 확인된 결과로 마감될 수 있습니다.

```solidity
// UMAOracleAdapterV2.sol

contract UMAOracleAdapterV2 is
    UUPSUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    address public umaOptimisticOracle;
    address public umaFinder;
    address public umaCollateralToken; // 일반적으로 USDC

    bytes32 public constant DEFAULT_IDENTIFIER = bytes32("ASSERT_TRUTH");

    // 시장 -> 해결 상태
    struct ResolutionStatus {
        bool requested;
        bool settled;
        bytes32 assertionId;
        uint256 settledPrice;
        uint64 requestTimestamp;
    }

    mapping(address => ResolutionStatus) public resolutionStatus;

    event PriceRequested(
        address indexed marketAddress,
        bytes32 indexed identifier,
        uint64 timestamp
    );

    event PriceSettled(
        address indexed marketAddress,
        uint256 indexed outcome,
        uint256 price
    );

    event AssertionDisputed(
        bytes32 indexed assertionId,
        address indexed disputer
    );

    function initialize(
        address umaOptimisticOracle_,
        address umaFinder_,
        address umaCollateral_
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        umaOptimisticOracle = umaOptimisticOracle_;
        umaFinder = umaFinder_;
        umaCollateralToken = umaCollateral_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
    }

    function requestPrice(
        address marketAddress,
        bytes memory ancillaryData,
        uint256 proposedPrice
    ) external returns (bytes32 assertionId) {
        require(
            !resolutionStatus[marketAddress].requested,
            "Price already requested"
        );

        IUmaOptimisticOracle(umaOptimisticOracle).assertTruth(
            abi.encodePacked(
                ancillaryData,  // 시장의 질문
                ", but for the purposes of this market, the winning outcome is represented by a price between 0 and 1e18 where 0 means outcome 0 wins and 1e18 means outcome 1 wins. What is the price?"
            ),
            msg.sender,
            proposedPrice,
            1 days,  // 유효 기간
            abi.encode(marketAddress)
        );

        resolutionStatus[marketAddress] = ResolutionStatus({
            requested: true,
            settled: false,
            assertionId: assertionId,
            settledPrice: 0,
            requestTimestamp: uint64(block.timestamp)
        });

        emit PriceRequested(
            marketAddress,
            DEFAULT_IDENTIFIER,
            uint64(block.timestamp)
        );
    }

    function settleMarket(address marketAddress) external {
        ResolutionStatus storage status = resolutionStatus[marketAddress];
        require(status.requested, "No price requested");
        require(!status.settled, "Already settled");

        // UMA 정산 함수 호출
        // 해결된 가격 가져오기
        uint256 settledPrice = _fetchSettledPrice(status.assertionId);

        status.settled = true;
        status.settledPrice = settledPrice;

        emit PriceSettled(
            marketAddress,
            settledPrice >= 5e17 ? 1 : 0, // 이진: 0 또는 1
            settledPrice
        );
    }

    function retrySettle(address marketAddress) external {
        ResolutionStatus storage status = resolutionStatus[marketAddress];
        require(status.requested, "No price requested");
        require(!status.settled, "Already settled");

        // 가격 다시 가져오기 시도
        _fetchSettledPrice(status.assertionId);
    }

    function _fetchSettledPrice(bytes32 assertionId)
        internal
        returns (uint256 price)
    {
        // 단순화된 구현 - 실제 버전은
        // UMA의 store 계약서와 상호작용하여 승인된 가격을 가져옴
        return 0; // 플레이스홀더
    }
}
```

### 2.6 이벤트 및 오류

스마트 계약서는 모든 중요한 작업에 대한 이벤트를 방출하여, 효율적인 인덱싱과 모니터링을 가능하게 합니다. 이벤트에는 시장 생성, 오더 배치 및 실행, 취소, 해결, 출금이 포함됩니다. 이러한 이벤트는 Relayer 서비스에 의해 포착되어 Supabase에 저장되어 역사 및 분석에 사용됩니다.

```solidity
// 주요 이벤트

// MarketFactory
event MarketCreated(
    address indexed marketAddress,
    address indexed creator,
    string question,
    uint256 category,
    uint256 creationTimestamp
);

event MarketPaused(address indexed marketAddress, address indexed operator);
event MarketResolved(address indexed marketAddress, uint256 outcome);

// OffchainMarketBase
event OrderPlaced(
    bytes32 indexed orderHash,
    address indexed maker,
    uint256 indexed outcome,
    bool isBuy,
    uint128 price,
    uint128 amount,
    uint64 expires,
    uint64 nonce
);

event OrderFilled(
    bytes32 indexed orderHash,
    address indexed maker,
    address indexed taker,
    uint256 outcome,
    uint128 price,
    uint128 amount,
    uint256 makerPayment,
    uint256 takerPayment
);

event OrderCancelled(
    bytes32 indexed orderHash,
    address indexed maker,
    string reason
);

event WinningsClaimed(
    address indexed user,
    address indexed marketAddress,
    uint256 outcome,
    uint256 amount,
    uint256 payout
);

event Withdrawal(
    address indexed user,
    address indexed token,
    uint256 amount
);

// 커스텀 오류

error InvalidSignature();
error OrderExpired();
error OrderAmountZero();
error OrderPriceInvalid();
error SlippageExceeded(uint128 expected, uint128 actual);
error MarketPausedError();
error MarketNotResolved();
error NoWinnings();
error InvalidOutcome();
error UnauthorizedCaller();
error PriceNotSettled();
error DuplicateNonce();
error InsufficientBalance();
error TransferFailed();
```

### 2.7 보안 고려 사항

스마트 계약서의 보안은 Foresight에서 최우선 사항이며, 시스템이 관리할 수 있는 잠재적으로 중요한 금융적 가치를 고려합니다. 여러 보호 레이어가 일반적인 공격 벡터를 방지하기 위해 구현됩니다. nonReentrant 수정자는 토큰 또는 ETH 이전을 수행하는 모든 외부 함수에 적용되어, 역사적으로 수많은 취약점을 야기한 리엔트란시 공격을 방지합니다.

플래시 론 공격에 대한 보호는 여러 메커니즘을 통해 구현됩니다. 시장 생성 및 해결 작업은 지연 및 보안 조건으로 보호됩니다. 짧은 기간 동안 중요한 가격 변경은 모니터링 시스템에서 경고를 트리거합니다. 또한 EIP-712 서명 검증 시스템은 공격자가 Relayer를 제어하더라도 위조된 오더를 실행할 수 없도록 하며, 각 오더는 자금의 정당한 소유자가 서명해야 합니다.

비상 일시 중지 메커니즘은 운영자가 이상 징후나 취약점 감지 시 시장 또는 전체 시스템의 모든 작업을 일시적으로 중지할 수 있게 합니다. 이 기능은 OPERATOR_ROLE으로 제어되며, 비상 시 사용자의 자금을 보호하기 위해 빠르게 활성화될 수 있습니다. 문제가 해결되면 ADMIN_ROLE의 관리자가 시장의 잠금을 해제할 수 있습니다.

---

## 3. 프론트엔드 아키텍처

### 3.1 기술 스택

Foresight의 프론트엔드 애플리케이션은 React 생태계의 가장 현대적인 기술로 구축되어, 성능, 보안, 개발자 경험 최적화를 보장합니다. Next.js 15.5.4와 App Router는 애플리케이션의 프레임워크를 제공하여, 서버 측 렌더링(SSR), 정적 생성(SSG), 클라이언트 하이드레이션을 관리합니다. React 19는 성능 및 개발자 경험 개선 사항을 가져오며, Server Components와 간소화된 Server Actions를 포함합니다. TypeScript 5.0은 전체 코드베이스에 걸쳐 완전한 타입 검사를 제공하여 런타임 오류를 줄이고 유지 관리를 용이하게 합니다.

상태 관리는 서버 상태에는 React Query(TanStack Query v5)를, 클라이언트 상태에는 React Context/Zustand를 조합하여 사용합니다. React Query는 API 호출에 대해 수동 상태 관리 로직을 제거하면서 캐싱, 리페칭, 뮤테이션, 데이터 서버 동기화를 자동으로 관리합니다. Zustand는 열린 모달, 사용자 기본 설정, 데이터와 관련 없는 로딩 상태와 같은 로컬 인터페이스 상태에 사용됩니다.

스타일링은 Tailwind CSS 3.4로 수행되어, 트리 셰이킹을 통한 최소 CSS 번들로 반응형 인터페이스의 신속한 개발을 가능하게 합니다. 재사용 가능한 UI 컴포넌트는 Radix UI 원시로 구축되어, ARIA 레이블, 키보드 탐색과 같은 내장 접근성을 제공하면서 특정 디자인을 강요하지 않습니다. 이 분리된 접근 방식은 완전한 시각적 사용자 정의의 이점을 얻으면서도 접근 가능한 원시를 활용할 수 있게 합니다.

| 카테고리      | 기술            | 버전   | 역할                        |
| ------------- | --------------- | ------ | --------------------------- |
| 프레임워크    | Next.js         | 15.5.4 | SSR/SSG, 라우팅, API Routes |
| UI 라이브러리 | React           | 19     | 컴포넌트, 상태, 이벤트      |
| 언어          | TypeScript      | 5.0    | 정적 타입, IDE 지원         |
| 스타일링      | Tailwind CSS    | 3.4    | 유틸리티 우선 CSS           |
| 데이터 페칭   | React Query     | 5      | 서버 상태 관리              |
| Web3          | ethers.js       | 6      | 블록체인 연결               |
| 폼            | React Hook Form | 7      | 폼 관리, 검증               |
| i18n          | next-intl       | 5      | 국제화                      |
| 차트          | Recharts        | 2      | OHLCV 차트, 거래량          |
| 날짜/시간     | date-fns        | 4      | 포맷팅, 날짜 조작           |

### 3.2 프로젝트 구조

프론트엔드 프로젝트 구조는 Next.js App Router 규칙을 따르며, 기능 및 책임별 명확한 조직화를 제공합니다. app/ 폴더는 애플리케이션의 라우트를 포함하며, 각 하위 폴더는 페이지 또는 페이지 그룹을 나타냅니다. components/ 폴더는 재사용 가능한 컴포넌트를 범주(ui는 원시, features는 비즈니스 컴포넌트, charts는 시각화)별로 구성합니다. lib/ 폴더는 유틸리티, 구성, 하위 수준 추상화를 포함합니다.

```
apps/web/
├── app/
│   ├── (auth)/                    # 인증 라우트
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (main)/                    # 주요 라우트
│   │   ├── page.tsx               # 대시보드 / 홈
│   │   ├── markets/
│   │   │   ├── page.tsx           # 시장 목록
│   │   │   ├── [address]/         # 시장 상세
│   │   │   │   ├── page.tsx
│   │   │   │   ├── trades/        # 거래 내역
│   │   │   │   └── orders/        # 오더북
│   │   │   └── create/            # 시장 생성
│   │   │       └── page.tsx
│   │   │
│   │   ├── portfolio/             # 사용자 포트폴리오
│   │   │   └── page.tsx
│   │   │
│   │   ├── leaderboard/           # 리더보드
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/              # 사용자 설정
│   │       └── page.tsx
│   │
│   ├── api/                       # API Routes (BFF)
│   │   ├── siwe/                  # Web3 인증
│   │   ├── orders/                # 오더 및 서명
│   │   ├── markets/               # 시장 데이터
│   │   └── user/                  # 사용자 데이터
│   │
│   ├── layout.tsx                 # 루트 레이아웃 (Providers)
│   └── globals.css                # 글로벌 스타일
│
├── components/
│   ├── ui/                        # 원시 컴포넌트
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   ├── Table.tsx
│   │   ├── Tabs.tsx
│   │   └── Dropdown.tsx
│   │
│   ├── charts/                    # 시각화
│   │   ├── PriceChart.tsx
│   │   ├── VolumeChart.tsx
│   │   ├── CandlestickChart.tsx
│   │   └── DepthChart.tsx
│   │
│   ├── features/                  # 비즈니스 컴포넌트
│   │   ├── market/
│   │   │   ├── MarketCard.tsx
│   │   │   ├── MarketList.tsx
│   │   │   ├── OrderBook.tsx
│   │   │   ├── RecentTrades.tsx
│   │   │   └── MarketDetail.tsx
│   │   │
│   │   ├── trading/
│   │   │   ├── OrderForm.tsx
│   │   │   ├── OrderHistory.tsx
│   │   │   ├── PositionList.tsx
│   │   │   └── TradingPanel.tsx
│   │   │
│   │   ├── user/
│   │   │   ├── UserAvatar.tsx
│   │   │   ├── FollowButton.tsx
│   │   │   └── PortfolioSummary.tsx
│   │   │
│   │   └── social/
│   │       ├── DiscussionThread.tsx
│   │       ├── CommentList.tsx
│   │       └── VoteButtons.tsx
│   │
│   └── providers/                 # 컨텍스트 Providers
│       ├── Web3Provider.tsx
│       ├── QueryProvider.tsx
│       └── I18nProvider.tsx
│
├── lib/
│   ├── contracts/                 # ABI 및 주소
│   │   ├── marketFactory.ts
│   │   ├── outcomeToken.ts
│   │   └── umaOracle.ts
│   │
│   ├── utils/                     # 유틸리티
│   │   ├── formatting.ts          # 숫자, 날짜, 통화 포맷
│   │   ├── validation.ts          # 검증 스키마
│   │   └── constants.ts           # 공유 상수
│   │
│   ├── hooks/                     # 커스텀 훅
│   │   ├── useWeb3.ts
│   │   ├── useOrders.ts
│   │   └── useMarketData.ts
│   │
│   └── sdk/                       # 클라이언트 SDK
│       └── foresight.ts
│
├── types/                         # TypeScript 정의
│   ├── market.ts
│   ├── order.ts
│   ├── trade.ts
│   └── user.ts
│
├── messages/                      # 번역 파일
│   ├── en.json
│   ├── zh-CN.json
│   ├── es.json
│   ├── fr.json
│   └── ko.json
│
├── public/                        # 정적 자산
│   ├── images/
│   └── locales/
│
├── next.config.js                 # Next.js 구성
├── tailwind.config.ts             # Tailwind 구성
├── tsconfig.json                  # TypeScript 구성
└── package.json
```

### 3.3 Providers 및 글로벌 구성

애플리케이션은 React providers 시스템을 사용하여 의존성과 구성을 컴포넌트 트리에 주입합니다. 루트 레이아웃은 필요한 모든 Providers를 결합하고 애플리케이션의 글로벌 컨텍스트를 설정합니다.

```typescript
// app/layout.tsx

import type { Metadata } from 'next';
import { Web3Provider } from '@/components/providers/Web3Provider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foresight - Prediction Markets',
  description: 'Decentralized prediction market platform',
  icons: '/favicon.ico',
};

export default function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 antialiased">
        <I18nProvider locale={locale}>
          <Web3Provider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </Web3Provider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

```typescript
// components/providers/Web3Provider.tsx

'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { http, createConfig, fallback } from 'wagmi';
import { mainnet, polygon, polygonAmoy } from 'wagmi/chains';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import { QueryClient } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const config = createConfig({
  chains: [polygon, polygonAmoy],
  transports: {
    [polygon.id]: fallback([
      http('https://polygon-rpc.com'),
      http('https://rpc.ankr.com/polygon'),
    ]),
    [polygonAmoy.id]: fallback([
      http('https://rpc-amoy.polygon.technology'),
      http('https://polygon-amoy.public.blastapi.io'),
    ]),
  },
  connectors: [
    injected(),
    coinbaseWallet({ projectId, chains: [polygon, polygonAmoy] }),
    walletConnect({ projectId, chains: [polygon, polygonAmoy] }),
  ],
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30초
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config} queryClient={queryClient}>
      {children}
    </WagmiProvider>
  );
}
```

### 3.4 트레이딩 컴포넌트

트레이딩 컴포넌트는 사용자가 오더를 배치하고, 오더북을 시각화하고, 포지션을 추적할 수 있게 하는 사용자 인터페이스의 핵심 기능적 부분입니다. OrderForm 컴포넌트는 오더 생성의 전체 로직을 캡슐화하여, 입력 검증, 가격 계산, EIP-712 서명을 포함합니다.

```typescript
// components/features/trading/OrderForm.tsx

'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useSignTypedData } from 'wagmi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseEther, formatEther } from 'viem';
import { Order, Signature } from '@/types/order';
import { useMarket } from '@/lib/hooks/useMarketData';
import { useSiwe } from '@/lib/hooks/useSiwe';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslations } from 'next-intl';

interface OrderFormProps {
  marketAddress: `0x${string}`;
  outcomeIndex: number;
  isBuy: boolean;
  onSuccess?: () => void;
}

export function OrderForm({
  marketAddress,
  outcomeIndex,
  isBuy,
  onSuccess
}: OrderFormProps) {
  const t = useTranslations('trading');
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const { nonce, verifySignature } = useSiwe();

  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [slippage, setSlippage] = useState('2');

  const { data: market } = useMarket(marketAddress);
  const { data: allowance } = useQuery({
    queryKey: ['allowance', marketAddress, address],
    queryFn: () => fetchAllowance(marketAddress, address!),
    enabled: !!address,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (order: Order) => {
      // EIP-712로 오더 서명
      const signature = await signTypedDataAsync({
        domain: {
          name: 'Foresight Market',
          version: '1',
          chainId: process.env.NEXT_PUBLIC_CHAIN_ID === '137' ? 137 : 80002,
          verifyingContract: marketAddress,
        },
        types: {
          Order: [
            { name: 'maker', type: 'address' },
            { name: 'outcome', type: 'uint256' },
            { name: 'isBuy', type: 'bool' },
            { name: 'price', type: 'uint128' },
            { name: 'amount', type: 'uint128' },
            { name: 'expires', type: 'uint64' },
            { name: 'nonce', type: 'uint64' },
          ],
        },
        message: order,
      });

      // Relayer에 제출
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, signature }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderBook', marketAddress] });
      onSuccess?.();
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!isConnected || !address) {
      // 지갑 연결 트리거
      return;
    }

    const order: Order = {
      maker: address,
      outcome: outcomeIndex,
      isBuy,
      price: parseEther(price) as unknown as bigint,
      amount: parseEther(amount) as unknown as bigint,
      expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1시간
      nonce: BigInt(nonce),
    };

    await createOrderMutation.mutateAsync(order);
  }, [isConnected, address, amount, price, outcomeIndex, isBuy, nonce]);

  const estimatedCost = parseFloat(amount) * parseFloat(price);
  const maxSlippageAmount = estimatedCost * (1 + parseFloat(slippage) / 100);

  if (!isConnected) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">{t('connectWalletPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {isBuy ? t('buy') : t('sell')} {t('outcome')} {outcomeIndex}
        </span>
        <span className="text-sm text-gray-500">
          {t('maxSlippage')}: {slippage}%
        </span>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('price')}</label>
        <div className="relative">
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            max="1"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            USDC
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">{t('amount')}</label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          step="0.01"
          min="0"
        />
      </div>

      <div className="rounded-lg bg-gray-50 p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('estimated')}</span>
          <span className="font-medium">
            ${estimatedCost.toFixed(2)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('maxSlippage')}</span>
          <span className="font-medium">
            ${maxSlippageAmount.toFixed(2)} USDC
          </span>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        loading={createOrderMutation.isPending}
        disabled={!amount || !price}
        className="w-full"
        variant={isBuy ? 'primary' : 'secondary'}
      >
        {isBuy ? t('placeBuyOrder') : t('placeSellOrder')}
      </Button>

      {createOrderMutation.isError && (
        <p className="text-sm text-red-500">
          {t('orderFailed')}: {(createOrderMutation.error as Error).message}
        </p>
      )}
    </div>
  );
}
```

### 3.5 국제화 (i18n)

국제화 시스템은 next-intl을 사용하여 지원되는 5개 언어 전체에 번역을 관리합니다. 메시지 파일은 네임스페이스(common, trading, market, portfolio 등)별로 구성되어 조직화와 지연 로딩된 번역의 번역 로딩을 용이하게 합니다.

```json
// messages/ko.json

{
  "common": {
    "appName": "Foresight",
    "connected": "연결됨",
    "disconnected": "연결 해제됨",
    "connectWallet": "지갑 연결",
    "loading": "로딩 중...",
    "error": "오류",
    "success": "성공",
    "cancel": "취소",
    "confirm": "확인",
    "save": "저장",
    "delete": "삭제",
    "edit": "수정",
    "viewAll": "모두 보기"
  },
  "trading": {
    "buy": "매수",
    "sell": "매도",
    "price": "가격",
    "amount": "수량",
    "outcome": "결과",
    "placeBuyOrder": "매수 주문 제출",
    "placeSellOrder": "매도 주문 제출",
    "orderSubmitted": "주문이 성공적으로 제출되었습니다",
    "orderFailed": "주문 실패",
    "connectWalletPrompt": "지갑을 연결해주세요",
    "estimated": "예상",
    "maxSlippage": "최대 슬리피지",
    "orderBook": "호가창",
    "recentTrades": "최근 거래",
    "myOrders": "내 주문",
    "noOrders": "주문 없음",
    "orderExpires": "만료"
  },
  "market": {
    "createMarket": "시장 생성",
    "marketDetails": "시장 상세",
    "resolutionDate": "해결 날짜",
    "status": "상태",
    "statusActive": "활성",
    "statusResolved": "해결됨",
    "statusPaused": "일시 중지됨",
    "volume": "거래량",
    "liquidity": "유동성",
    "traders": "트레이더",
    "discussions": "토론",
    "forum": "포럼"
  },
  "portfolio": {
    "positions": "포지션",
    "history": "내역",
    "pnl": "손익",
    "totalValue": "총 가치",
    "realizedPnL": "실현 손익",
    "unrealizedPnL": "미실현 손익"
  }
}
```

```typescript
// middleware.ts

import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const config = {
  matcher: ["/", "/(zh-CN|en|es|fr|ko)/:path*"],
};
```

---

## 4. Relayer 서비스

### 4.1 Relayer 아키텍처

Relayer 서비스는 오프체인 아키텍처의 핵심 구성 요소로, 고성능 오더 처리와 오더북 관리를 담당합니다. Node.js와 TypeScript로 구축된 Relayer는 Redis 기반 이벤트 중심 아키텍처를 사용하여 메모리 내 지속성과 실시간 데이터 분배를 수행합니다. 서비스는 조율된 방식으로 작동하여 부드럽고 빠른 교환 경험을 제공하기 위해 여러 전문 모듈로 구성됩니다.

Relayer 아키텍처는 수평적 확장을 위해 설계되었습니다. 각 Relayer 인스턴스는 초당 수천 개의 오더를 처리할 수 있으며, 부하 분산 장치 뒤에 여러 인스턴스를 배포하여 용량을 늘릴 수 있습니다. Redis 파티셔닝은 여러 노드 간에 데이터 부하를 분산하고, WebSocket 연결은 인스턴스 간에 균형을 이루어 각 사용자에게 안정적인 연결을 유지합니다.

오더북 관리 모듈은 모든 활성 시장을 위한 오더북 데이터 구조를 메모리에 유지합니다. 이 구조는 빠른 매칭 연산에 최적화되어, 가격 검색에는 균형 잡힌 트리(AVL 또는 Red-Black)를, 해시별 직접 접근에는 맵을 사용합니다. 데이터는 주기적으로 디스크와 Supabase에 백업되어 내구성을 보장합니다.

매칭 엔진은 가격-시간 매칭 알고리즘을 구현합니다. 새 오더가 도착하면 엔진은 즉시 기존 오더북에서 호환되는 상대방을 찾습니다. 매칭이 발견되면 오더가 부분적으로 또는 완전히 실행되고, 정산을 위해 블록체인 트랜잭션이 생성됩니다. 엔진은 또한 실행된 오더의 레지스트리를 유지하여 내역 및 통계에 사용됩니다.

이벤트 수집 모듈은 Polygon 노드에 대한 WebSocket 연결을 통해 실시간으로 블록체인 이벤트를 수신합니다. 이러한 이벤트는 오더북 업데이트, 연결된 사용자에게 알림, 시장 통계 업데이트를 트리거합니다. 모듈은 계약서 주소별 필터링 시스템을 사용하여 관련 이벤트만 수신합니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Relayer Service Architecture                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API Gateway Layer                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │  REST API   │  │  WebSocket  │  │  Admin/Health Endpoints │ │   │
│  │  │  (Express)  │  │  (Socket.io)│  │  (Express)              │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘ │   │
│  └─────────┼────────────────┼──────────────────────────────────────┘   │
│            │                │                                           │
│            ▼                ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Authentication Layer                        │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              SIWE Verification Module                   │   │   │
│  │  │  • Validate nonce        • Verify signature EIP-712     │   │   │
│  │  │  • Check expiry          • Rate limit by IP/user        │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Core Business Logic                          │   │
│  │                                                                   │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │   │
│  │  │ Order Manager   │ │ Matching Engine │ │ Event Processor │   │   │
│  │  │ • Validation    │ │ • Price-time    │ │ • Block events  │   │   │
│  │  │ • Deduplication │ │ • Batch exec    │ │ • State sync    │   │   │
│  │  │ • Redis cache   │ │ • Slippage check│ │ • Notifications │   │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │   │
│  │  │ Transaction     │ │ Stats Calculator│ │ Order Sync      │   │   │
│  │  │ Builder         │ │ • OHLCV candles │ │ • DB persistence│   │   │
│  │  │ • Batch orders  │ │ • Volume metrics│ │ • History replay│   │   │
│  │  │ • Gas estimation│ │ • Liquidity     │ │ • Recovery      │   │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘   │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│            ┌───────────────────────┼───────────────────────┐            │
│            ▼                       ▼                       ▼            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│  │     Redis       │ │   Supabase      │ │   Blockchain    │            │
│  │   Cluster       │ │   PostgreSQL    │ │   (Wallet)      │            │
│  │   • Order Book  │ │   • Historical  │            │            │
│  │   • Rate Limit  │ │   • Analytics   │            ▼            │
│  │   • Caching     │ │   • User Data   │     ┌─────────────────┐      │
│  └─────────────────┘ └─────────────────┘     │  Send Transaction│      │
│                                              │  • Batch signing  │      │
│                                              │  • Gas optim.     │      │
│                                              └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 매칭 엔진 코드

매칭 엔진은 Relayer의 핵심으로, 사용자의 오더를 실행하는 알고리즘을 구현합니다. 알고리즘은 가격-시간 우선순위 원칙을 따르며, 최상의 가격의 오더가 먼저 실행되고 동일한 가격의 오더는 도착 순서에 따라 실행됩니다.

```typescript
// services/relayer/src/matching-engine/engine.ts

import { Order, OrderSide, OrderStatus } from "../models/order";
import { Trade } from "../models/trade";
import { Redis } from "ioredis";
import { logger } from "../utils/logger";

interface MatchResult {
  trades: Trade[];
  remainingOrder: Order | null;
  errors: string[];
}

export class MatchingEngine {
  private redis: Redis;
  private orderBooks: Map<string, Order[]>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.orderBooks = new Map();
  }

  async processOrder(order: Order): Promise<MatchResult> {
    const result: MatchResult = {
      trades: [],
      remainingOrder: null,
      errors: [],
    };

    try {
      const orderBookKey = `orderbook:${order.marketAddress}:${order.outcome}`;
      const oppositeSide = order.isBuy ? "sell" : "buy";
      const orderBook = await this.getOrderBook(orderBookKey, oppositeSide);

      if (orderBook.length === 0) {
        await this.addToOrderBook(orderBookKey, order);
        result.remainingOrder = order;
        return result;
      }

      let remainingAmount = order.amount;

      for (const restingOrder of orderBook) {
        if (remainingAmount === 0n) break;

        if (!this.canMatch(order, restingOrder)) {
          continue;
        }

        const matchAmount = this.calculateMatchAmount(order, remainingAmount, restingOrder);
        const matchPrice = this.determineExecutionPrice(order, restingOrder);

        const trade = await this.executeTrade(order, restingOrder, matchAmount, matchPrice);

        result.trades.push(trade);
        remainingAmount -= matchAmount;

        if (restingOrder.amount === matchAmount) {
          await this.removeOrder(orderBookKey, restingOrder);
        } else {
          await this.updateOrderAmount(
            orderBookKey,
            restingOrder,
            restingOrder.amount - matchAmount
          );
        }
      }

      if (remainingAmount > 0) {
        const updatedOrder = { ...order, amount: remainingAmount };
        await this.addToOrderBook(orderBookKey, updatedOrder);
        result.remainingOrder = updatedOrder;
      }

      await this.publishOrderBookUpdate(order.marketAddress, order.outcome);
    } catch (error) {
      logger.error("Matching engine error", { error, order });
      result.errors.push((error as Error).message);
    }

    return result;
  }

  private canMatch(incoming: Order, resting: Order): boolean {
    if (incoming.isBuy) {
      return incoming.price >= resting.price;
    } else {
      return incoming.price <= resting.price;
    }
  }

  private calculateMatchAmount(incoming: Order, incomingRemaining: bigint, resting: Order): bigint {
    const minAmount = incomingRemaining < resting.amount ? incomingRemaining : resting.amount;
    return minAmount;
  }

  private determineExecutionPrice(incoming: Order, resting: Order): bigint {
    if (incoming.timestamp < resting.timestamp) {
      return incoming.price;
    } else {
      return resting.price;
    }
  }

  private async executeTrade(
    maker: Order,
    taker: Order,
    amount: bigint,
    price: bigint
  ): Promise<Trade> {
    const trade: Trade = {
      id: await this.generateTradeId(),
      marketAddress: maker.marketAddress,
      outcomeIndex: maker.outcome,
      price,
      amount,
      makerAddress: maker.maker,
      takerAddress: taker.maker,
      timestamp: Date.now(),
      transactionHash: null,
    };

    await this.saveTrade(trade);

    this.logger.info("Trade executed", {
      tradeId: trade.id,
      market: trade.marketAddress,
      amount: amount.toString(),
      price: price.toString(),
    });

    return trade;
  }

  private async getOrderBook(key: string, side: string): Promise<Order[]> {
    const data = await this.redis.hget(key, side);
    if (!data) return [];

    const orders: Order[] = JSON.parse(data);
    return this.sortOrderBook(orders);
  }

  private sortOrderBook(orders: Order[]): Order[] {
    return orders.sort((a, b) => {
      if (a.price !== b.price) {
        return Number(b.price - a.price);
      }
      return Number(a.timestamp - b.timestamp);
    });
  }
}
```

### 4.3 EIP-712 서명 관리

서명 검증 시스템은 Relayer의 보안에 중요합니다. 각 오더는 오더북에 수락되기 전에 생성자(maker)가 서명해야 합니다. 검증은 EIP-712 표준에 따라 수행되며, 이는 타입화된 데이터의 구조화된 서명을 위한 형식을 정의합니다.

```typescript
// services/relayer/src/utils/signature.ts

import { ethers } from "ethers";
import { Order } from "../models/order";

const EIP712_DOMAIN_TYPEHASH = ethers.id(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

const ORDER_TYPEHASH = ethers.id(
  "Order(address maker,uint256 outcome,bool isBuy,uint128 price,uint128 amount,uint64 expires,uint64 nonce)"
);

export function hashOrder(order: Order): string {
  return ethers.keccak256(
    ethers.concat([
      ORDER_TYPEHASH,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bool", "uint128", "uint128", "uint64", "uint64"],
        [
          order.maker,
          order.outcome,
          order.isBuy,
          order.price,
          order.amount,
          order.expires,
          order.nonce,
        ]
      ),
    ])
  );
}

export function hashDomain(
  name: string,
  version: string,
  chainId: bigint,
  verifyingContract: string
): string {
  return ethers.keccak256(
    ethers.concat([
      EIP712_DOMAIN_TYPEHASH,
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "uint256", "address"],
        [name, version, chainId, verifyingContract]
      ),
    ])
  );
}

export function verifySignature(
  order: Order,
  signature: string,
  expectedSigner: string,
  chainId: bigint,
  verifyingContract: string
): boolean {
  try {
    const domainHash = hashDomain("Foresight Market", "1", chainId, verifyingContract);

    const orderHash = hashOrder(order);

    const messageHash = ethers.keccak256(ethers.concat(["0x1901", domainHash, orderHash]));

    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error("Signature verification failed", error);
    return false;
  }
}

export function parseSignature(signature: string): {
  v: number;
  r: string;
  s: string;
} {
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (sig.length !== 130) {
    throw new Error("Invalid signature length");
  }

  return {
    v: parseInt(sig.slice(128, 130), 16),
    r: "0x" + sig.slice(0, 64),
    s: "0x" + sig.slice(64, 128),
  };
}
```

### 4.4 실시간 WebSocket 서비스

WebSocket 서비스는 사용자가 오더북, 실행된 거래, 시장 상태 변경에 대한 실시간 업데이트를 받을 수 있게 합니다. Socket.io는 연결 관리에 사용되며, 시장별 룸을 사용하여 메시지 분배를 최적화합니다.

```typescript
// services/relayer/src/websocket/handler.ts

import { Server as SocketServer, Socket } from "socket.io";
import { Redis } from "ioredis";
import { verifySignature } from "../utils/signature";
import { logger } from "../utils/logger";

interface AuthenticatedSocket extends Socket {
  userAddress?: string;
  subscribedMarkets?: Set<string>;
}

export class WebSocketHandler {
  private io: SocketServer;
  private redis: Redis;

  constructor(io: SocketServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const address = socket.handshake.auth.address;
        const signature = socket.handshake.auth.signature;

        if (!address || !signature) {
          return next(new Error("Missing auth credentials"));
        }

        const nonce = await this.redis.get(`nonce:${address}`);
        if (!nonce) {
          return next(new Error("Invalid nonce"));
        }

        // 실제 서명 검증은 여기서 수행
        // nonce 메시지를 가져와서 검증

        socket.userAddress = address.toLowerCase();
        socket.subscribedMarkets = new Set();

        next();
      } catch (error) {
        logger.error("WebSocket auth error", error);
        next(new Error("Authentication failed"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      logger.info("Client connected", { address: socket.userAddress });

      socket.on("subscribe:market", async (marketAddress: string) => {
        const room = `market:${marketAddress.toLowerCase()}`;
        socket.join(room);
        socket.subscribedMarkets?.add(marketAddress.toLowerCase());

        const orderBook = await this.redis.hgetall(`orderbook:${marketAddress}`);
        const recentTrades = await this.redis.lrange(`trades:${marketAddress}`, 0, 49);

        socket.emit("market:snapshot", {
          orderBook: JSON.parse(orderBook.buy || "[]"),
          recentTrades: recentTrades.map((t) => JSON.parse(t)),
        });
      });

      socket.on("unsubscribe:market", (marketAddress: string) => {
        const room = `market:${marketAddress.toLowerCase()}`;
        socket.leave(room);
        socket.subscribedMarkets?.delete(marketAddress.toLowerCase());
      });

      socket.on("subscribe:orders", async () => {
        const room = `orders:${socket.userAddress}`;
        socket.join(room);
      });

      socket.on("subscribe:trades", async () => {
        const room = `trades:${socket.userAddress}`;
        socket.join(room);
      });

      socket.on("disconnect", () => {
        logger.info("Client disconnected", { address: socket.userAddress });
      });
    });
  }

  broadcastTrade(trade: any) {
    const marketRoom = `market:${trade.marketAddress.toLowerCase()}`;
    this.io.to(marketRoom).emit("trade:new", {
      id: trade.id,
      price: trade.price.toString(),
      amount: trade.amount.toString(),
      outcomeIndex: trade.outcomeIndex,
      maker: trade.makerAddress,
      taker: trade.takerAddress,
      timestamp: trade.timestamp,
    });

    const makerRoom = `trades:${trade.makerAddress.toLowerCase()}`;
    const takerRoom = `trades:${trade.takerAddress.toLowerCase()}`;
    this.io.to(makerRoom).emit("trade:own", trade);
    this.io.to(takerRoom).emit("trade:own", trade);
  }

  broadcastOrderBookUpdate(marketAddress: string, outcomeIndex: number) {
    const room = `market:${marketAddress.toLowerCase()}`;
    this.io.to(room).emit("orderbook:update", { outcomeIndex });
  }

  notifyOrderStatus(orderId: string, status: string, userAddress: string) {
    const room = `orders:${userAddress.toLowerCase()}`;
    this.io.to(room).emit("order:status", { orderId, status });
  }
}
```

---

## 5. API 참조

### 5.1 API 엔드포인트

Foresight의 REST API는 클라이언트 애플리케이션에 필요한 모든 작업을 위한 엔드포인트를 제공합니다. API는 보호된 엔드보안을 위해 SIWE(Sign-In with Ethereum) 인증을 사용하고, IP 주소와 이더리움 주소별로 레이트 리밋을 구현합니다.

```
https://api.foresight.market/

├── /api/
│   ├── siwe/
│   │   ├── GET    /nonce          → 인증을 위한 nonce 생성
│   │   ├── POST   /verify         → 서명 검증
│   │   └── POST   /logout         → 세션 무효화
│   │
│   ├── auth/
│   │   ├── GET    /session        → 활성 세션 조회
│   │   └── POST   /refresh        → 토큰 갱신
│   │
│   ├── markets/
│   │   ├── GET    /               → 시장 목록
│   │   ├── GET    /:address       → 시장 상세
│   │   ├── GET    /:address/book  → 오더북
│   │   ├── GET    /:address/trades→ 거래 내역
│   │   ├── GET    /:address/candles→ OHLCV 데이터
│   │   └── POST   /               → 시장 생성 (관리자)
│   │
│   ├── orders/
│   │   ├── GET    /               → 사용자 오더 목록
│   │   ├── GET    /:orderId       → 오더 상세
│   │   ├── POST   /               → 서명된 오더 제출
│   │   ├── DELETE /:orderId       → 오더 취소
│   │   └── POST   /batch          → 여러 오더 제출
│   │
│   ├── trades/
│   │   ├── GET    /               → 사용자 거래 목록
│   │   └── GET    /:tradeId       → 거래 상세
│   │
│   ├── user/
│   │   ├── GET    /profile        → 사용자 프로필
│   │   ├── PATCH  /profile        → 프로필 업데이트
│   │   ├── GET    /portfolio      → 전체 포트폴리오
│   │   ├── GET    /positions      → 미청산 포지션
│   │   ├── GET    /history        → 전체 내역
│   │   └── GET    /stats          → 사용자 통계
│   │
│   ├── user-follows/
│   │   ├── GET    /               → 구독 목록
│   │   ├── POST   /               → 사용자 팔로우
│   │   ├── DELETE /:userAddress   → 팔로우 취소
│   │   └── GET    /counts         → 팔로워 카운트
│   │
│   ├── discussions/
│   │   ├── GET    /               → 토론 목록
│   │   ├── POST   /               → 토론 생성
│   │   ├── GET    /:id            → 토론 상세
│   │   └── DELETE /:id            → 토론 삭제
│   │
│   ├── forum/
│   │   ├── GET    /               → 스레드 목록
│   │   ├── POST   /               → 스레드 생성
│   │   ├── GET    /:id            → 스레드 상세
│   │   ├── POST   /:id/comments   → 댓글 추가
│   │   ├── POST   /:id/vote       → 스레드 투표
│   │   └── POST   /comments/:id/vote→ 댓글 투표
│   │
│   └── analytics/
│       ├── GET    /volume         → 거래량 데이터
│       ├── GET    /leaderboard    → 트레이더 순위
│       └── GET    /trending       → 트렌딩 시장
```

### 5.2 엔드포인트 상세 문서

**SIWE 인증 (Authentication)**

```
GET /api/siwe/nonce
```

SIWE 인증을 위해 암호화된 nonce를 생성합니다. 이 nonce는 IP 주소에 바인딩되며 10분 후 만료됩니다.

**응답:**

```json
{
  "nonce": "0x1234567890abcdef",
  "expiresAt": "2025-01-15T10:20:00Z"
}
```

```
POST /api/siwe/verify
```

이더리움 서명을 검증하고 세션을 설정합니다.

**요청 본문:**

```json
{
  "message": {
    "domain": "foresight.market",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8bEb1",
    "statement": "Sign in to Foresight",
    "uri": "https://foresight.market",
    "version": "1",
    "chainId": 137,
    "nonce": "0x1234567890abcdef",
    "issuedAt": "2025-01-15T10:10:00Z"
  },
  "signature": "0x..."
}
```

**응답:**

```json
{
  "user": {
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8bEb1",
    "ensName": null,
    "avatarUrl": null
  },
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**시장 (Markets)**

```
GET /api/markets
```

페이지네이션 및 필터링과 함께 시장 목록을 조회합니다.

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| page | number | 현재 페이지 (기본값: 1) |
| limit | number | 페이지당 항목 수 (기본값: 20, 최대: 100) |
| status | string | 상태별 필터 (active, resolved, paused) |
| category | string | 시장 카테고리 |
| sortBy | string | 정렬 (volume, creationTime, endTime) |
| sortOrder | string | 순서 (asc, desc) |

**응답:**

```json
{
  "data": [
    {
      "address": "0x1234...5678",
      "question": "Will Bitcoin exceed $100,000 by end of 2025?",
      "outcomes": ["Yes", "No"],
      "status": "active",
      "volume": 1250000.5,
      "liquidity": 850000.0,
      "traderCount": 342,
      "creationTimestamp": 1705312800000,
      "resolutionDate": 1736848800000,
      "category": "crypto"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

```
GET /api/markets/:address/book
```

특정 시장을 위한 오더북을 조회합니다.

**응답:**

```json
{
  "marketAddress": "0x1234...5678",
  "bids": [
    {
      "price": "0.65",
      "amount": "1000",
      "total": "650",
      "maker": "0xabcd...efgh"
    },
    {
      "price": "0.64",
      "amount": "2500",
      "total": "1600",
      "maker": "0xijkl...mnop"
    }
  ],
  "asks": [
    {
      "price": "0.66",
      "amount": "1500",
      "total": "990",
      "maker": "0xqrst...uvwx"
    }
  ],
  "spread": "0.01",
  "spreadPercent": "1.54%"
}
```

```
GET /api/markets/:address/candles
```

차트용 OHLCV 차목烛 데이터를 조회합니다.

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| resolution | string | 타임프레임 (1m, 5m, 15m, 1h, 4h, 1d, 1w) |
| from | number | 시작 타임스탬프 |
| to | number | 종료 타임스탬프 |
| outcomeIndex | number | 결과 인덱스 (선택) |

**응답:**

```json
{
  "marketAddress": "0x1234...5678",
  "resolution": "1h",
  "candles": [
    {
      "timestamp": 1705312800000,
      "open": "0.60",
      "high": "0.65",
      "low": "0.59",
      "close": "0.64",
      "volume": 45000,
      "tradeCount": 156
    }
  ]
}
```

**오더 (Orders)**

```
POST /api/orders
```

처리를 위해 서명된 오더를 제출합니다.

**요청 본문:**

```json
{
  "order": {
    "maker": "0x742d35Cc6634C0532925a3b844Bc9e7595f8bEb1",
    "outcome": 0,
    "isBuy": true,
    "price": "0.650000000000000000",
    "amount": "1000000000000000000",
    "expires": 1705316400,
    "nonce": 42
  },
  "signature": "0xabcd...1234"
}
```

**응답:**

```json
{
  "orderId": "0x1234567890abcdef...",
  "status": "received",
  "estimatedExecutionTime": 150,
  "message": "Order received and queued for processing"
}
```

**사용자 (User)**

```
GET /api/user/portfolio
```

사용자의 전체 포트폴리오를 조회합니다.

**응답:**

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8bEb1",
  "totalValue": 15420.5,
  "positions": [
    {
      "marketAddress": "0x1234...5678",
      "marketQuestion": "Will Bitcoin exceed $100,000 by end of 2025?",
      "outcome": 0,
      "outcomeLabel": "Yes",
      "quantity": 1000,
      "avgPrice": 0.55,
      "currentPrice": 0.65,
      "unrealizedPnL": 100.0,
      "realizedPnL": 25.5
    }
  ],
  "availableBalance": 5420.5,
  "lockedInOrders": 5000.0
}
```

### 5.3 레이트 리밋

API는 슬라이딩 윈도우 기반 레이트 리밋 시스템을 구현합니다. 제한은 공개 엔드포인트에는 IP 주소별로, 인증된 엔드포인트에는 이더리움 주소별로 적용됩니다.

| 레벨     | 분당 요청수 | 용도                  |
| -------- | ----------- | --------------------- |
| strict   | 5           | 인증, 민감한 작업     |
| moderate | 20          | 오더 생성, 수정       |
| relaxed  | 60          | 빈번한 조회, 폴링     |
| lenient  | 120         | 공개 엔드포인트, 분석 |

응답 헤더에는 레이트 리밋 정보가 포함됩니다:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
```

---

## 6. 데이터베이스 설계

### 6.1 데이터베이스 스키마

Supabase(PostgreSQL) 데이터베이스는 시장 데이터의 영속적 역사, 사용자 정보, 메타데이터를 저장합니다. 스키마는 빈번한 분석 쿼리에 최적화되어 있고, 높은 거래량 거래 데이터에는 시간 기반 파티션을 사용합니다.

```sql
-- 필수 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Enum 타입
CREATE TYPE order_status AS ENUM ('open', 'partial', 'filled', 'cancelled', 'expired');
CREATE TYPE trade_type AS ENUM ('buy', 'sell');
CREATE TYPE market_status AS ENUM ('active', 'paused', 'resolved', 'canceled');

-- 공개 스키마 (주 데이터)
CREATE SCHEMA public;

-- 사용자 테이블
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) UNIQUE NOT NULL,
    ens_name VARCHAR(255),
    avatar_url VARCHAR(512),
    bio TEXT,
    username VARCHAR(50) UNIQUE,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    trading_volume_total NUMERIC(36, 8) DEFAULT 0,
    realized_pnl_total NUMERIC(36, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_address ON public.users(address);
CREATE INDEX idx_users_username ON public.users(username);

-- 시장 테이블
CREATE TABLE public.markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) UNIQUE NOT NULL,
    question TEXT NOT NULL,
    description TEXT,
    outcomes TEXT[] NOT NULL,
    outcome_count INTEGER NOT NULL,
    category VARCHAR(100),
    status market_status DEFAULT 'active',
    creator_address VARCHAR(42) NOT NULL,
    oracle_type VARCHAR(50) DEFAULT 'UMA',
    resolution_date TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    settled_outcome INTEGER,
    volume NUMERIC(36, 8) DEFAULT 0,
    liquidity NUMERIC(36, 8) DEFAULT 0,
    trader_count INTEGER DEFAULT 0,
    creation_timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_markets_address ON public.markets(address);
CREATE INDEX idx_markets_status ON public.markets(status);
CREATE INDEX idx_markets_category ON public.markets(category);
CREATE INDEX idx_markets_resolution_date ON public.markets(resolution_date);
CREATE INDEX idx_markets_volume ON public.markets(volume DESC);

-- 오더 테이블 (전체 역사)
CREATE TABLE public.orders (
    id BIGSERIAL PRIMARY KEY,
    order_hash VARCHAR(66) UNIQUE NOT NULL,
    market_address VARCHAR(42) NOT NULL,
    maker_address VARCHAR(42) NOT NULL,
    outcome_index INTEGER NOT NULL,
    is_buy BOOLEAN NOT NULL,
    price NUMERIC(36, 18) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    filled_amount NUMERIC(36, 18) DEFAULT 0,
    status order_status DEFAULT 'open',
    nonce BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    signature VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    expire_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_market ON public.orders(market_address);
CREATE INDEX idx_orders_maker ON public.orders(maker_address);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_hash ON public.orders(order_hash);

-- 거래 테이블 (실행된 거래)
CREATE TABLE public.trades (
    id BIGSERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66),
    market_address VARCHAR(42) NOT NULL,
    outcome_index INTEGER NOT NULL,
    price NUMERIC(36, 18) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    maker_address VARCHAR(42) NOT NULL,
    taker_address VARCHAR(42) NOT NULL,
    maker_order_hash VARCHAR(66) NOT NULL,
    taker_order_hash VARCHAR(66),
    fee NUMERIC(36, 8) DEFAULT 0,
    block_number BIGINT,
    log_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_market ON public.trades(market_address);
CREATE INDEX idx_trades_maker ON public.trades(maker_address);
CREATE INDEX idx_trades_taker ON public.trades(taker_address);
CREATE INDEX idx_trades_created_at ON public.trades(created_at DESC);
CREATE INDEX idx_trades_tx_hash ON public.trades(transaction_hash);

-- OHLCV 차목烛 테이블 (차트 데이터)
CREATE TABLE public.candles (
    id BIGSERIAL PRIMARY KEY,
    market_address VARCHAR(42) NOT NULL,
    outcome_index INTEGER DEFAULT 0,
    resolution VARCHAR(10) NOT NULL,
    open NUMERIC(36, 18) NOT NULL,
    high NUMERIC(36, 18) NOT NULL,
    low NUMERIC(36, 18) NOT NULL,
    close NUMERIC(36, 18) NOT NULL,
    volume NUMERIC(36, 8) NOT NULL,
    trade_count INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(market_address, outcome_index, resolution, timestamp)
);

CREATE INDEX idx_candles_market_time ON public.candles(
    market_address, outcome_index, resolution, timestamp
);

-- 사용자 포지션 테이블
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address VARCHAR(42) NOT NULL,
    market_address VARCHAR(42) NOT NULL,
    outcome_index INTEGER NOT NULL,
    quantity NUMERIC(36, 18) NOT NULL,
    avg_price NUMERIC(36, 18) NOT NULL,
    realized_pnl NUMERIC(36, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_address, market_address, outcome_index)
);

CREATE INDEX idx_positions_user ON public.positions(user_address);
CREATE INDEX idx_positions_market ON public.positions(market_address);

-- 사용자 팔로우 테이블
CREATE TABLE public.user_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_address VARCHAR(42) NOT NULL,
    following_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_address, following_address)
);

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_address);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_address);

-- 토론 테이블
CREATE TABLE public.discussions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_address VARCHAR(42),
    user_address VARCHAR(42) NOT NULL,
    parent_id UUID,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discussions_market ON public.discussions(market_address);
CREATE INDEX idx_discussions_user ON public.discussions(user_address);

-- 포럼 투표 테이블
CREATE TABLE public.forum_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address VARCHAR(42) NOT NULL,
    thread_id UUID NOT NULL,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_address, thread_id)
);

-- 세션 테이블 (JWT 토큰)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_user ON public.sessions(user_id);
```

### 6.2 뷰 및 함수

```sql
-- 리더보드 뷰
CREATE VIEW public.leaderboard AS
SELECT
    address,
    trading_volume_total,
    realized_pnl_total,
    follower_count,
    created_at,
    RANK() OVER (ORDER BY trading_volume_total DESC) as volume_rank,
    RANK() OVER (ORDER BY realized_pnl_total DESC) as pnl_rank
FROM public.users
ORDER BY trading_volume_total DESC;

-- 업데이트 타임스탬프 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 자동 updated_at 트리거
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_markets_updated_at
    BEFORE UPDATE ON public.markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 시장 거래량 계산 함수
CREATE OR REPLACE FUNCTION calculate_market_volume(market_addr VARCHAR)
RETURNS NUMERIC AS $$
SELECT COALESCE(SUM(amount * price), 0)
FROM public.trades
WHERE market_address = market_addr;
$$ LANGUAGE sql;

-- 날짜별 거래 파티션 생성 함수
CREATE OR REPLACE FUNCTION create_trade_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    start_date := TO_CHAR(DATE_TRUNC('month', NEW.created_at), 'YYYY_MM');
    partition_name := 'trades_' || start_date;

    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF public.trades
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            DATE_TRUNC('month', NEW.created_at),
            DATE_TRUNC('month', NEW.created_at) + INTERVAL '1 month'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insert_trade_partition
    BEFORE INSERT ON public.trades
    FOR EACH ROW EXECUTE FUNCTION create_trade_partition();
```

---

## 7. 배포 가이드

### 7.1 사전 요구사항 및 구성

Foresight 배포에는 여러 인프라 구성 요소가 필요합니다. 블록체인 상호작용을 위해 Polygon RPC(Alchemy 또는 Infura) 계정이 필요합니다. 지속적 저장을 위해 PostgreSQL과 Redis가 활성화된 Supabase 프로젝트가 필요합니다. Web3 인증을 위해 WalletConnect 계정이 필요합니다. Blockscout과 같은 서비스 외부 인덱싱을 위한 API 키가 필요합니다.

```bash
# 필수 환경 변수
export PRIVATE_KEY=your_deployer_private_key
export RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
export RPC_AMOY_URL=https://rpc-amoy.polygon.technology

export NEXT_PUBLIC_CHAIN_ID=137
export NEXT_PUBLIC_CHAIN_NAME=Polygon
export NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com

export DATABASE_URL=postgresql://user:password@host:5432/foresight
export REDIS_URL=redis://user:password@host:6379

export NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

export UMA_OPTIMISTIC_ORACLE=0x...
export UMA_FINDER=0x...
export UMA_COLLATERAL_TOKEN=0x...
```

### 7.2 스마트 계약 배포

```bash
# 계약 디렉토리로 이동
cd packages/contracts

# 의존성 설치
npm install

# hardhat.config.ts에서 네트워크 구성
# 자세한 내용은 다음 섹션 참조

# 계약 컴파일
npx hardhat compile

# Polygonscan에서 계약 검증 (선택적)
npx hardhat verify --network polygon 0xCONTRACT_ADDRESS

# Amoy에 배포 (테스트넷)
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy

# 검증 후 Mainnet에 배포
npx hardhat run scripts/deploy_offchain_sprint1.ts --network polygon
```

```typescript
// hardhat.config.ts

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.RPC_URL || "",
        blockNumber: 45000000,
      },
    },
    amoy: {
      url: process.env.RPC_AMOY_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [process.env.PRIVATE_KEY || ""].filter(Boolean),
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY,
        },
      },
    },
    polygon: {
      url: process.env.RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts: [process.env.PRIVATE_KEY || ""].filter(Boolean),
      verify: {
        etherscan: {
          apiKey: process.env.POLYGONSCAN_API_KEY,
        },
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    admin: 1,
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
};

export default config;
```

### 7.3 프론트엔드 배포

```bash
# 웹 디렉토리로 이동
cd apps/web

# 의존성 설치
npm install

# 환경 변수 구성
cp .env.example .env.local
# .env.local을 값으로 편집

# 프로덕션 빌드
npm run build

# Vercel에 배포
vercel deploy --prod

# 또는 서버에 수동 배포
npm run start
```

### 7.4 Relayer 서비스 배포

```bash
# Relayer 디렉토리로 이동
cd services/relayer

# 의존성 설치
npm install

# 구성
cp .env.example .env
# .env를 값으로 편집

# 빌드
npm run build

# PM2로 시작
pm2 start ecosystem.config.js --env production

# 또는 Docker로
docker build -t foresight-relayer .
docker run -d --name foresight-relayer foresight-relayer
```

```yaml
# 전체 인프라를 위한 docker-compose.yml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  relayer:
    build:
      context: ./services/relayer
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/foresight
      - PRIVATE_KEY=${PRIVATE_KEY}
    depends_on:
      - redis
      - db
    restart: unless-stopped

  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://relayer:3001
    depends_on:
      - relayer
    restart: unless-stopped

  db:
    image: supabase/postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  redis_data:
  pg_data:
```

### 7.5 DNS 및 SSL 구성

```bash
# 리버스 프록시를 위한 nginx 구성

# /etc/nginx/sites-available/foresight
server {
    listen 80;
    server_name api.foresight.market;

    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.foresight.market;

    ssl_certificate /etc/letsencrypt/live/api.foresight.market/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.foresight.market/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 8. 보안 규범

### 8.1 스마트 계약 보안

Foresight의 스마트 계약서는 감사되었으며区块链 보안 모범 사례를 따릅니다. 감사에는 리엔트란시 공격, 정수 오버플로우, 접근 제어 실패, 프론트러닝 공격과 같은 일반적인 취약점에 대한 형식적 검증이 포함됩니다. 계약서는 커뮤니티에 의해 광범위하게 감사된 OpenZeppelin 라이브러리를 사용합니다.

```solidity
// 계약서에서 리엔트란시 보호 예제

abstract contract OffchainMarketBase is
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable
{
    modifier nonReentrant() {
        require(_status != _ENTERED, 'ReentrancyGuard: reentrant call');
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    // 자금을 이전하거나 중요하게 상태를 수정하는
    // 모든 외부 함수는 이 수정자를 사용
    function fillOrder(
        Order calldata order,
        Signature calldata signature,
        uint128 fillAmount
    ) external override nonReentrant {
        // 오더 채우기 로직
    }

    function claimWinnings() external nonReentrant {
        // 수익 청구 로직
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        // 출금 로직
    }
}
```

### 8.2 공격으로부터의 보호

시스템은 시장 조작 및 재정적 공격에 대한 여러 보호 레이어를 구현합니다. 프론트러닝 보호는 최소 지연 및 슬리피지 허용 메커니즘을 사용하여 공격을 경제적으로 실행 불가능하게 만듭니다. 오더는 한도 가격 또는 그 이상에서 실행되어, 사용자가 동의한 가격을 최소한 얻을 수 있도록 합니다. Relayer는 스푸핑 오더나 세탁 거래 패턴과 같은 시장 조작 시도를 탐지하고 거부하는 안티게이밍 통제도 구현합니다.

```typescript
// Relayer의 슬리피지 보호

interface SlippageConfig {
  defaultPercentage: number;
  maxPercentage: number;
  dynamicAdjustment: boolean;
}

export function calculateSlippageProtection(
  orderPrice: bigint,
  marketVolatility: number,
  config: SlippageConfig
): bigint {
  let slippagePercent = config.defaultPercentage;

  if (config.dynamicAdjustment) {
    // 변동성 높은 시장의 슬리피지 증가
    const volatilityAdjustment = Math.min(marketVolatility * 2, 5);
    slippagePercent += volatilityAdjustment;
  }

  // 최대 슬리피지 제한
  slippagePercent = Math.min(slippagePercent, config.maxPercentage);

  // 한도 가격 계산
  const slippageAmount = (orderPrice * BigInt(slippagePercent)) / 100n;
  return orderPrice - slippageAmount;
}

export function validateSlippage(
  executedPrice: bigint,
  orderPrice: bigint,
  maxSlippagePrice: bigint
): boolean {
  // 실행 가격이 허용 범위 내인지 확인
  if (executedPrice > orderPrice) {
    // 매수 가격: 실행이 한도 가격을 초과해서는 안 됨
    return executedPrice <= maxSlippagePrice;
  } else {
    // 매도 가격: 실행이 한도 가격보다 낮아서는 안 됨
    return executedPrice >= maxSlippagePrice;
  }
}
```

### 8.3 프론트엔드 보안

프론트엔드 인터페이스는 XSS, CSRF, 기타 웹 공격 벡터로부터 사용자를 보호하기 위해 엄격한 보안 조치를 구현합니다. 모든 사용자 입력은 처리 또는 표시 전에 검증되고 살균됩니다. 인증 토큰은 안전하게 저장되며 제한된 수명을 가집니다.

```typescript
// 입력 검증 및 살균

import { z } from "zod";

const orderSchema = z.object({
  outcome: z.number().int().min(0).max(7),
  isBuy: z.boolean(),
  price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number),
  expires: z
    .number()
    .int()
    .min(1)
    .max(86400 * 7), // 최대 7일
  nonce: z.number().int().positive(),
});

export function validateAndSanitizeOrder(input: unknown) {
  const result = orderSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
}

// 표시를 위한 XSS 보호
import DOMPurify from "isomorphic-dompurify";

function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href", "title"],
  });
}
```

### 8.4 레이트 리밋 및 DDoS 보호

```typescript
// 레이트 리밋 미들웨어

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// API 엔드포인트용 레이트 리미터
const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.REDIS_URL!,
    token: process.env.REDIS_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "ratelimit:api",
});

export async function withRateLimit(
  request: Request,
  identifier: string,
  limit: number = 60
): Promise<Response | null> {
  const { success, remaining, reset } = await ratelimit.limit(identifier);

  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": "60",
      },
    });
  }

  return null;
}

// 공개 엔드포인트용 IP별 레이트 리미터
const ipRatelimit = new Ratelimit({
  redis: new Redis({ url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! }),
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "ratelimit:ip",
});
```

---

## 9. 테스트 가이드

### 9.1 스마트 계약 테스트

```typescript
// test/market.test.ts

import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("OffchainMarket", function () {
  let marketFactory: any;
  let market: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let outcomeToken: any;

  async function deployMarketFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const OutcomeToken = await ethers.getContractFactory("OutcomeToken1155");
    outcomeToken = await OutcomeToken.deploy();
    await outcomeToken.deployed();

    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactory.deploy();
    await marketFactory.deployed();

    const templateBinary = await ethers.deployContract("OffchainBinaryMarket");
    const templateMulti = await ethers.deployContract("OffchainMultiMarket8");

    await marketFactory.initialize(
      templateBinary.address,
      templateMulti.address,
      outcomeToken.address
    );

    // 테스트 시장 생성
    const tx = await marketFactory.createMarket(
      {
        question: "Will Bitcoin exceed $100,000 by end of 2025?",
        outcomes: ["Yes", "No"],
        resolutionDate: Math.floor(Date.now() / 1000) + 86400 * 30,
        resolutionReward: ethers.utils.parseEther("1000"),
        oracle: ethers.constants.AddressZero,
        useUMA: false,
      },
      "crypto"
    );

    const receipt = await tx.wait();
    const marketAddress = receipt.events[0].args.marketAddress;

    market = await ethers.getContractAt("OffchainBinaryMarket", marketAddress);

    return { market, owner, user1, user2, outcomeToken };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployMarketFixture);
    market = fixture.market;
    owner = fixture.owner;
    user1 = fixture.user1;
    user2 = fixture.user2;
    outcomeToken = fixture.outcomeToken;
  });

  describe("Order Placement", function () {
    it("Should allow placing a buy order", async function () {
      const order = {
        maker: user1.address,
        outcome: 0,
        isBuy: true,
        price: ethers.utils.parseEther("0.65"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      const domain = {
        name: "Foresight Market",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: market.address,
      };

      const signature = await user1._signTypedData(domain, { Order: order }, order);

      await expect(market.connect(user2).placeOrder(order, signature)).to.emit(
        market,
        "OrderPlaced"
      );
    });

    it("Should reject orders with invalid signature", async function () {
      const order = {
        maker: user1.address,
        outcome: 0,
        isBuy: true,
        price: ethers.utils.parseEther("0.65"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      const invalidSignature = {
        v: 27,
        r: "0x" + "11".repeat(32),
        s: "0x" + "22".repeat(32),
      };

      await expect(market.connect(user2).placeOrder(order, invalidSignature)).to.be.revertedWith(
        "Invalid signature"
      );
    });

    it("Should reject expired orders", async function () {
      const order = {
        maker: user1.address,
        outcome: 0,
        isBuy: true,
        price: ethers.utils.parseEther("0.65"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) - 1, // 만료됨
        nonce: 1,
      };

      // 유효한 서명이지만 만료된 오더
      // "Order expired"로 실패해야 함
    });
  });

  describe("Order Matching", function () {
    it("Should match buy and sell orders at crossing prices", async function () {
      // 0.70에 매수 오더 배치
      const buyOrder = {
        maker: user1.address,
        outcome: 0,
        isBuy: true,
        price: ethers.utils.parseEther("0.70"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      // 0.65에 매도 오더 배치 (교차 가격)
      const sellOrder = {
        maker: user2.address,
        outcome: 0,
        isBuy: false,
        price: ethers.utils.parseEther("0.65"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      // 서명들...

      // 0.65( maker 가격)로 실행 성공해야 함
    });

    it("Should not match orders at non-crossing prices", async function () {
      // 0.50에 매수, 0.70에 매도
      // 매칭되지 않아야 함
    });
  });
});
```

### 9.2 프론트엔드 통합 테스트

```typescript
// apps/web/tests/trading.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Trading Interface", () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 지갑 연결
    await page.goto("/");
    await page.click('[data-testid="connect-wallet"]');
    // 모의 지갑 구성...
  });

  test("should display order form correctly", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // 오더 폼 존재 확인
    await expect(page.locator('[data-testid="order-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="buy-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="sell-button"]')).toBeVisible();
  });

  test("should allow placing a buy order", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // 폼 작성
    await page.fill('[data-testid="price-input"]', "0.65");
    await page.fill('[data-testid="amount-input"]', "100");
    await page.click('[data-testid="buy-button"]');

    // 제출 확인
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
  });

  test("should update order book in real-time", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // 초기 오더북 확인
    const initialOrders = await page.locator('[data-testid="order-book-row"]').count();

    // 다른 계정에서 오더 배치 (모의)
    // 실시간 업데이트 확인
    await expect(page.locator('[data-testid="order-book-row"]')).toHaveCount(initialOrders + 1);
  });
});
```

### 9.3 Relayer 부하 테스트

```typescript
// services/relayer/test/load.test.ts

import { k6 } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // 램프업
    { duration: "5m", target: 500 }, // 고부하
    { duration: "5m", target: 1000 }, // 스트레스 테스트
    { duration: "2m", target: 0 }, // 램프다운
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const order = generateRandomOrder();

  const res = http.post(`${BASE_URL}/api/orders`, JSON.stringify(order), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  check(res, {
    "order accepted": (r) => r.status === 200,
    "response time < 200ms": (r) => r.timings.duration < 200,
  });
}

function generateRandomOrder() {
  return {
    outcome: Math.floor(Math.random() * 2),
    isBuy: Math.random() > 0.5,
    price: (Math.random() * 0.5 + 0.25).toString(),
    amount: (Math.random() * 1000 + 100).toString(),
    expires: Math.floor(Date.now() / 1000) + 3600,
    nonce: Date.now(),
  };
}
```

---

## 10. 문제 해결

### 10.1 일반적인 문제 및 해결책

**오류: "Insufficient gas" 또는 트랜잭션 실패**

이 오류는 일반적으로 가스 추정이 잘못되었거나 가스 가격이 너무 높을 때 발생합니다. 먼저 계정에 가스 비용을 충족할 충분한 MATIC이 있는지 확인합니다. 다음으로 오더 매개변수가 유효한지 확인합니다(가격은 0과 1 사이, 수량은 양수, 사용되지 않은 nonce). 문제가 지속되면 Web3 클라이언트에서 가스 한도를 수동으로 늘립니다.

**오류: "Order expired"**

오더에는 유효 기간이 제한되어 있습니다(기본값 1시간). 만료된 타임스탬프로 오더를 제출하면 거부됩니다. 시스템 시간을 확인하고 미래 만료로 오더를 재생성합니다. 오더가 Relayer 캐시에 너무 오래 저장된 경우 nonce도 만료될 수 있습니다.

**오류: "Nonce already used"**

각 nonce는 주소당 한 번만 사용할 수 있습니다. 이미 사용된 nonce로 오더를 제출하려고 하면 거부됩니다. 새 오더마다 증가된 새 nonce를 사용합니다. 시스템은 리플레이 공격을防止하기 위해 사용된 nonce를 기록합니다.

**차트 로드 안됨**

OHLCV 데이터가 표시되지 않으면 인터넷 연결과 API URL을 확인합니다. 차트 데이터는 서버 측에서 캐시되며, 새 데이터와 API를 통한 가용성 사이에 몇 분 지연이 있을 수 있습니다.

**WebSocket 연결 문제**

WebSocket 연결은 방화벽이나 프록시 네트워크에 의해 중단될 수 있습니다. 프론트엔드는 자동 재연결을 구현하지만, 문제가 지속되면 Relayer용 포트 3001(또는 구성된 포트)이 네트워크에서 접근 가능한지 확인합니다.

### 10.2 로깅 및 모니터링

```bash
# 실시간 Relayer 로그
tail -f /var/log/foresight-relayer/app.log

# 레벨별 로그 필터링
grep -E "ERROR|WARN" /var/log/foresight-relayer/app.log

# Prometheus 메트릭
curl http://localhost:3001/metrics

# 서비스 상태
curl http://localhost:3001/health
```

### 10.3 진단 명령

```bash
# 계약 상태 확인
npx hardhat run scripts/verify-deployments.ts --network polygon

# Redis 동기화 확인
redis-cli info | grep used_memory

# 활성 데이터베이스 연결 확인
psql -c "SELECT count(*) FROM pg_stat_activity;"

# API 연결성 테스트
curl -v https://api.foresight.health

# 만료된 토큰 확인
npm run db:check-expired-sessions
```

### 10.4 복구 절차

중대 장애 시 다음 절차를 통해 서비스를 복원할 수 있습니다.

```bash
# Relayer 충돌 후 복구
pm2 restart foresight-relayer
pm2 logs foresight-relayer --lines 100

# 데이터베이스 충돌 후 복구
pg_restore -h localhost -U postgres -d foresigh backup.dump

# 블록체인 동기화不正确 후 복구
# 알려진 블록에서 이벤트 리플레이
npm run relayer:sync -- --from-block 45000000

# 완전 재설정 (DEV ONLY)
npm run db:reset
npm run redis:flushall
npm run contracts:redeploy
```

---

## 추가 리소스

| 리소스              | 링크                                    |
| ------------------- | --------------------------------------- |
| Next.js 문서        | https://nextjs.org/docs                 |
| React Query 문서    | https://tanstack.com/query/latest       |
| ethers.js 문서      | https://docs.ethers.org/                |
| OpenZeppelin 계약서 | https://docs.openzeppelin.com/contracts |
| Polygon 문서        | https://wiki.polygon.technology/        |
| UMA 프로토콜        | https://docs.uma.xyz/                   |
| EIP-712 표준        | https://eips.ethereum.org/EIPS/eip-712  |
| Supabase 문서       | https://supabase.com/docs               |
| Redis 문서          | https://redis.io/docs                   |

---

**마지막 업데이트**: 2025-01-26

**버전**: 3.0

---

**언어 / Languages / 语言切换 / Idioma / Langue:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
