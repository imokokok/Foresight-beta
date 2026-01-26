# 📚 Documentación del Desarrollador Foresight

> Manual de referencia técnica completo que cubre contratos inteligentes, arquitectura frontend, diseño de API y despliegue.

---

## 📑 Contenido

- [Arquitectura General](#arquitectura-general)
- [Contratos Inteligentes](#contratos-inteligentes)
- [Arquitectura Frontend](#arquitectura-frontend)
- [Servicio Relayer](#servicio-relayer)
- [Referencia API](#referencia-api)
- [Diseño de Base de Datos](#diseño-de-base-de-datos)
- [Guía de Despliegue](#guía-de-despliegue)
- [Normas de Seguridad](#normas-de-seguridad)
- [Guía de Pruebas](#guía-de-pruebas)
- [Solución de Problemas](#solución-de-problemas)

---

## Arquitectura General

Foresight adopta una arquitectura híbrida **撮合 fuera de cadena + liquidación en cadena**, logrando una experiencia de usuario cercana a un exchange centralizado mientras mantiene una liquidación descentralizada completa.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Capa de Interacción                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (Future)   │  │  (REST)     │  │  (Future)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Capa de Servicio                             │
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
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │  Órdenes    │  │ Transacciones│ │  Velas     │                 ││
│  │  │ (Pendientes)│  │  (Historia) │  │  (OHLCV)   │                 ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Capa Blockchain                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 ││
│  │  │ Market      │  │ Outcome     │  │ UMA Oracle  │                 ││
│  │  │ Factory     │  │ Token 1155  │  │ Adapter V2  │                 ││
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 ││
│  │         │                │                │                        ││
│  │  ┌──────▼────────────────▼────────────────▼──────┐                 ││
│  │  │              Instancias de Mercados           │                 ││
│  │  └───────────────────────────────────────────────┘                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Contratos Inteligentes

### Arquitectura de Contratos

```
packages/contracts/contracts/
├── MarketFactory.sol              # Fábrica de mercados (UUPS actualizable)
├── interfaces/
│   ├── IMarket.sol                # Interfaz de contrato de mercado
│   ├── IOracle.sol                # Interfaz de oracle
│   └── IOracleRegistrar.sol       # Interfaz de registro de oracle
├── templates/
│   ├── OffchainMarketBase.sol     # Contrato base de mercado
│   ├── OffchainBinaryMarket.sol   # Plantilla de mercado binario
│   └── OffchainMultiMarket8.sol   # Plantilla multi-resultado (2-8 opciones)
├── tokens/
│   ├── OutcomeToken1155.sol       # Token ERC-1155 de resultado
│   └── Foresight.sol              # Token de gobernanza Foresight
├── oracles/
│   ├── ManualOracle.sol           # Oracle manual (para pruebas)
│   └── UMAOracleAdapterV2.sol     # Adaptador de oracle UMA
├── governance/
│   └── ForesightTimelock.sol      # Timelock de gobernanza
└── rewards/
    └── LPFeeStaking.sol           # Staking de comisiones LP
```

### MarketFactory

La fábrica de mercados es responsable de crear y gestionar todas las instancias de mercados de predicción, utilizando el patrón UUPS y proxies mínimos (EIP-1167) para optimización de gas.

**Funciones Principales:**

```solidity
// Registrar plantilla de mercado
function registerTemplate(
    bytes32 templateId,
    address implementation,
    string calldata name
) external onlyRole(ADMIN_ROLE);

// Crear mercado
function createMarket(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256 resolutionTime,
    uint256 feeBps,
    bytes calldata initData
) external returns (address market);

// Crear mercados en lote (admin)
function createMarkets(
    bytes32 templateId,
    address oracle,
    address collateral,
    uint256[] calldata resolutionTimes,
    uint256[] calldata feeBps,
    bytes[] calldata initDataList
) external onlyRole(ADMIN_ROLE) returns (address[] memory markets);

// Establecer comisión
function setFee(uint256 newFeeBps, address newFeeTo) external onlyRole(ADMIN_ROLE);

// Establecer comisión LP
function setLpFee(uint256 newLpFeeBps, address newLpFeeTo) external onlyRole(ADMIN_ROLE);

// Pausar/reasomar mercado
function pauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
function unpauseMarket(address market) external onlyRole(EMERGENCY_ROLE);
```

**Funciones de Consulta:**

```solidity
function getMarket(uint256 marketId) external view returns (MarketInfo memory);
function getMarketAddress(uint256 marketId) external view returns (address);
function isValidMarket(address market) external view returns (bool);
```

**Eventos:**

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

Contrato base para todos los contratos de mercado, proporcionando funcionalidad principal para validación de órdenes, acuñación, redención y liquidación.

**Funciones Principales:**

```solidity
// Acuñar conjunto completo (comprar todos los resultados)
function mintCompleteSets(uint256 amount18) external nonReentrant;

// Redimir conjunto completo (cuando el mercado es inválido)
function redeemCompleteSetsOnInvalid(uint256 amount18PerOutcome) external nonReentrant;

// Redimir resultado ganador
function redeem(uint256 amount18, uint8 outcomeIndex) external nonReentrant;

// Afirmar verdad vía oracle
function assertTruth(
    bytes calldata claim,
    uint8 outcomeIndex,
    bytes32 identifier,
    uint256 bond
) external;
```

**Validación de Firma EIP-712:**

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

**Consultas de Estado:**

```solidity
function getOutcomeCount() external view returns (uint8);
function getOutcomeTokenAddress() external view returns (address);
function getResolutionTime() external view returns (uint256);
```

**Eventos:**

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

### Estructura de Orden

```solidity
struct Order {
    address maker;           // Dirección del creador de orden
    uint256 outcomeIndex;    // Índice de resultado (0 a outcomeCount-1)
    bool isBuy;              // true=comprar YES, false=vender YES
    uint256 price;           // Precio (USDC 1e6 / acciones 1e18)
    uint256 amount;          // Cantidad de acciones (precisión 1e18)
    uint256 expiry;          // Marca de tiempo de expiración
    uint256 salt;            // Identificador único (previene reutilización)
}
```

**Ejemplo de Cálculo de Precio:**

- Precio 0.5 USDC = 500000 (1e6)
- Cantidad 10 acciones = 10 \* 1e18
- Cantidad total = 500000 _ 10 _ 1e12 / 1e6 = 5000000 USDC

### OutcomeToken1155

Contrato compartido de token ERC-1155 de resultados, todos los mercados comparten la misma instancia, distinguidos por Token ID.

**Cálculo de Token ID:**

```solidity
// Token ID = (market_address << 32) | outcomeIndex
function computeTokenId(address market, uint256 outcomeIndex) external pure returns (uint256 tokenId);

// Ejemplo: mercado 0x1234..., resultado 0
// tokenId = 0x1234000000000000000000000000000000000000 << 32 | 0
// = 0x1234000000000000000000000000000000000000000000000000000000000000
```

**Funciones Principales:**

```solidity
function mint(address to, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function burn(address from, uint256 id, uint256 amount) external onlyRole(MINTER_ROLE);
function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts) external onlyRole(MINTER_ROLE);
function grantMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
function revokeMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE);
```

### UMAOracleAdapterV2

Adaptador de UMA Optimistic Oracle V3 para verificación descentralizada de resultados.

**Funciones Principales:**

```solidity
// Registrar mercado
function registerMarket(
    bytes32 marketId,
    uint64 resolutionTime,
    uint8 outcomeCount
) external onlyRole(REGISTRAR_ROLE);

// Afirmar resultado
function assertOutcome(
    bytes32 marketId,
    uint8 outcomeIndex,
    bytes calldata claim
) external onlyRole(REPORTER_ROLE);

// Liquidar aserción (callback de UMA)
function settleAssertion(bytes32 assertionId) external;

// Consultar resultado
function getOutcome(bytes32 marketId) external view returns (uint8 outcomeIndex, bool exists);
```

**Enumeración de Estado:**

```solidity
enum Status {
    NONE,      // No iniciado
    PENDING,   // Esperando confirmación de UMA
    RESOLVED,  // Resuelto
    INVALID    // Mercado inválido
}
```

### Características de Seguridad

- ✅ Protección ReentrancyGuard (todas las funciones de escritura)
- ✅ Protección ataques préstamo flash (límite 1M USDC por bloque)
- ✅ Límite tamaño operaciones en lote (máx 50 órdenes por lote)
- ✅ Tiempo mínimo de vida de orden (30 segundos, previene ataques sandwich)
- ✅ Protección maleabilidad ECDSA (verificación valor s)
- ✅ Soporte ERC-1271 carteras de contrato inteligente (validación en cadena)
- ✅ Mecanismo cortocircuito (pausa de emergencia)
- ✅ Control de Acceso Basado en Roles

### Códigos de Error de Contrato

```solidity
error InvalidOutcomeIndex();           // Índice de resultado inválido
error InvalidState();                  // Estado de mercado inválido
error ResolutionTimeNotReached();      // Tiempo de liquidación no alcanzado
error InvalidExpiry();                 // Orden expirada
error InvalidAmount();                 // Cantidad inválida
error InvalidPrice();                  // Precio inválido
error InvalidSignedRequest();          // Verificación de firma fallida
error OrderCanceled();                 // Orden cancelada
error NoMinterRole();                  // Sin permiso de acuñación
error FeeNotSupported();               // Comisión no soportada
error MarketPaused();                  // Mercado pausado
error NotAuthorized();                 // Operación no autorizada
error ArrayLengthMismatch();           // Longitud de array no coincide
error BatchSizeExceeded();             // Límite de tamaño de lote excedido
error FlashLoanProtection();           // Protección préstamo flash activada
error OrderLifetimeTooShort();         // Tiempo de vida de orden muy corto
error InvalidSignatureS();             // Valor s de firma inválido
```

### OffchainBinaryMarket

Contrato específico de mercado binario (YES/NO), hereda de OffchainMarketBase.

```solidity
// Formato de datos de inicialización
// abi.encode(["Yes", "No"])
```

### OffchainMultiMarket8

Contrato específico de mercado multi-resultado (2-8 opciones), hereda de OffchainMarketBase.

```solidity
// Formato de datos de inicialización
// abi.encode(["Opción 1", "Opción 2", ..., "Opción N"])
// Soporta 2-8 opciones de resultado
```

---

## Arquitectura Frontend

### Stack Tecnológico

| Categoría | Tecnología           | Versión |
| --------- | -------------------- | ------- |
| Framework | Next.js (App Router) | 15.5.4  |
| UI        | React                | 19      |
| Lenguaje  | TypeScript           | 5.0     |
| Estilos   | Tailwind CSS         | 3.4     |
| Animación | Framer Motion        | 11      |
| Estado    | React Query          | 5       |
| Web3      | ethers.js            | 6       |
| i18n      | next-intl            | 3       |

### Internacionalización

El frontend usa `next-intl` para internacionalización. Idiomas soportados:

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

### Estructura de Directorios

```
apps/web/src/
├── app/                           # Páginas de Next.js App Router
│   ├── api/                       # Rutas API (backend)
│   ├── prediction/[id]/           # Página de detalle de mercado
│   ├── trending/                  # Lista de mercados trending
│   ├── profile/                   # Perfil de usuario
│   ├── forum/                     # Foro
│   ├── flags/                     # Mercados de flags
│   ├── proposals/                 # Sistema de propuestas
│   ├── admin/                     # Panel de administración
│   └── leaderboard/               # Clasificación
├── components/                    # Componentes React
│   ├── market/                    # Componentes relacionados con mercado
│   ├── chatPanel/                 # Panel de chat
│   ├── topNavBar/                 # Navegación superior
│   ├── ui/                        # Componentes UI base
│   └── walletModal/               # Modal de cartera
├── contexts/                      # React Context
│   ├── AuthContext.tsx            # Estado de autenticación
│   ├── WalletContext.tsx          # Estado de cartera
│   └── UserContext.tsx            # Estado de usuario
├── hooks/                         # Hooks personalizados
│   ├── useWalletModalLogic.ts    # Lógica de modal de cartera
│   ├── useMarketWebSocket.ts      # Conexión WebSocket
│   └── useInfiniteScroll.ts       # Desplazamiento infinito
├── lib/                           # Bibliotecas de utilidades
│   ├── format.ts                  # Utilidades de formato
│   ├── address.ts                 # Manejo de direcciones
│   ├── jwt.ts                     # Verificación JWT
│   └── database.types.ts          # Tipos de base de datos
└── features/                      # Módulos de características
    ├── flags/                     # Características de flags
    └── predictionAdmin/           # Gestión de mercados de predicción
```

### Componentes Principales

**Panel de Trading:**

```typescript
// Interfaz de parámetros de trade
interface TradeParams {
  outcomeIndex: number; // Índice de resultado
  isBuy: boolean; // Compra/venta
  price: string; // Precio (USDC)
  amount: string; // Cantidad (acciones)
  salt: string; // Número aleatorio
  expiry: number; // Tiempo de expiración
}

// Flujo de envío de orden
async function submitOrder(params: TradeParams, signature: string) {
  const response = await fetch("/api/orderbook/order", {
    method: "POST",
    body: JSON.stringify({ order: params, signature }),
  });
  return response.json();
}
```

---

## Servicio Relayer

### Visión General de Arquitectura

Relayer es la infraestructura principal del mercado de predicción Foresight, usando arquitectura híbrida de撮合 fuera de cadena + liquidación en cadena.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Servicio Relayer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  REST API   │   │  WebSocket  │   │  Métricas   │           │
│  │  /v2/*      │   │  :3006      │   │  /metrics   │           │
│  └──────┬──────┘   └──────┬──────┘   └─────────────┘           │
│         │                 │                                     │
│         ▼                 ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Motor de撮合                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                │    │
│  │  │ Validar  │ │撮合      │ │ Ejecutar │                │    │
│  │  │ Orden    │ │Orden     │ │Trade     │                │    │
│  │  └──────────┘ └──────────┘ └──────────┘                │    │
│  └────────────────────────────────────────────────────────┘    │
│                          │                                      │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Supabase   │  │  Redis      │  │ Blockchain  │            │
│  │  (Órdenes/  │  │  (Cache/    │  │  (Liquidar) │            │
│  │   Trades)   │  │   Pub/Sub)  │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principales

**Validador de Órdenes:** Valida firmas EIP-712, parámetros de orden y protección contra replay.

**Motor de撮合:**撮合 de órdenes de alto rendimiento, soportando órdenes límite, órdenes de mercado y múltiples tipos de órdenes.

**Ejecutor de Trade:** Envía transacciones de liquidación en cadena en lote, gestiona optimización de gas y mecanismo de reintento.

**Ingestión de Eventos:** Escucha eventos en cadena, actualiza estado de órdenes y saldos.

### API del Motor de撮合 v2 (Recomendado)

| Método | Endpoint               | Descripción                                             |
| ------ | ---------------------- | ------------------------------------------------------- |
| POST   | `/v2/orders`           | Enviar orden y撮合 (devuelve resultado y restante)      |
| GET    | `/v2/depth`            | Obtener profundidad del orderbook (snapshot memoria)    |
| GET    | `/v2/stats`            | Obtener estadísticas de mercado (bestBid/bestAsk, etc.) |
| GET    | `/v2/ws-info`          | Obtener info conexión WS y canales suscribibles         |
| POST   | `/v2/register-settler` | Registrar settler/Operator para marketKey               |
| GET    | `/v2/settlement-stats` | Obtener estadísticas de liquidación (agregado)          |
| GET    | `/v2/operator-status`  | Obtener estado Operator para un marketKey               |

### API Compatible (Orderbook basado en DB)

| Método | Endpoint                  | Descripción                                             |
| ------ | ------------------------- | ------------------------------------------------------- |
| POST   | `/orderbook/orders`       | Enviar orden firmado (escribir en tabla orders)         |
| POST   | `/orderbook/cancel-salt`  | Firmar cancelación de salt individual (escribir estado) |
| GET    | `/orderbook/depth`        | Obtener profundidad (preferir depth_levels / fallback)  |
| GET    | `/orderbook/queue`        | Obtener cola de órdenes para un nivel de precio         |
| POST   | `/orderbook/report-trade` | Backfill de trades vía txHash (eventos on-chain)        |

### API de Sistema

| Método | Endpoint   | Descripción         |
| ------ | ---------- | ------------------- |
| GET    | `/health`  | Verificación salud  |
| GET    | `/ready`   | Verificación listo  |
| GET    | `/metrics` | Métricas Prometheus |
| GET    | `/version` | Info de versión     |

**Ejemplo de Respuesta de Health Check:**

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

### Datos WebSocket en Tiempo Real

```javascript
// Conectar
const ws = new WebSocket("ws://relayer.foresight.io:3006");

// Suscribirse a profundidad
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "depth",
    marketKey: "80002:1",
    outcomeIndex: 0,
  })
);

// Suscribirse a trades
ws.send(
  JSON.stringify({
    type: "subscribe",
    channel: "trades",
    marketKey: "80002:1",
  })
);

// Suscribirse a velas
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

**Tipos de Mensajes WebSocket:**

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

### Métricas de Monitoreo Prometheus

| Métrica                              | Descripción              |
| ------------------------------------ | ------------------------ |
| `foresight_orders_total`             | Total órdenes enviadas   |
| `foresight_orders_active`            | Órdenes activas          |
| `foresight_matches_total`            | Total撮合                |
| `foresight_matching_latency_ms`      | Latencia de撮合 (ms)     |
| `foresight_matched_volume_total`     | Volumen de trading       |
| `foresight_settlement_batches_total` | Lotes de liquidación     |
| `foresight_settlement_pending_fills` | Liquidaciones pendientes |
| `foresight_settlement_latency_ms`    | Latencia de liquidación  |
| `foresight_ws_connections_active`    | Conexiones WebSocket     |

### Configuración

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

### Ejecutar Relayer

```bash
# Modo desarrollo
npm run start:dev

# Modo producción
npm run start:prod

# Usando Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 -p 3006:3006 foresight-relayer

# Usando PM2
pm2 start dist/index.js --name foresight-relayer
```

### Panel Grafana

```bash
docker-compose -f docker-compose.monitoring.yml up -d
# Acceder a http://localhost:3030
# Credenciales: admin / foresight123
```

---

## Referencia API

### Autenticación (SIWE)

```text
GET /api/siwe/nonce          # Generar nonce
POST /api/siwe/verify         # Verificar firma y login
GET /api/siwe/logout         # Cerrar sesión
POST /api/siwe/logout        # Cerrar sesión
```

### Autenticación por Email

```text
POST /api/email-otp/request        # Solicitar OTP
POST /api/email-otp/verify         # Verificar OTP
POST /api/email-otp/complete-signup # Completar registro
POST /api/email-magic-link/request  # Solicitar enlace mágico
POST /api/email-magic-link/verify   # Verificar enlace mágico
```

### Autenticación Tradicional

```text
POST /api/auth/login      # Login
POST /api/auth/register   # Registro
GET /api/auth/me          # Obtener usuario actual
GET /api/auth/sessions    # Lista de sesiones
POST /api/auth/sessions   # Crear sesión
DELETE /api/auth/sessions # Eliminar sesión
POST /api/auth/delete-account # Eliminar cuenta
```

### Límite de Peticiones

| Nivel    | Peticiones/Minuto | Caso de Uso              |
| -------- | ----------------- | ------------------------ |
| strict   | 5                 | Operaciones alto riesgo  |
| moderate | 20                | Usuarios regulares       |
| relaxed  | 60                | Lecturas alta frecuencia |
| lenient  | 120               | Consultas datos públicos |

### API de Datos de Mercado

```text
GET /api/markets/map           # Mapa de mercados
GET /api/markets/summary       # Resumen de mercado
GET /api/orderbook/order       # Orderbook
POST /api/orderbook/order      # Enviar orden
GET /api/orderbook/depth       # Profundidad de orden
GET /api/orderbook/candles     # Datos de velas
GET /api/orderbook/trades      # Historial de trades
GET /api/orderbook/quote       # Estimación de cotización
POST /api/orderbook/cancel-salt # Cancelar orden
POST /api/orderbook/report-trade # Reportar trade
POST /api/orderbook/orders/fill # Llenado de orden
GET /api/orderbook/market-plan # Vista previa de plan de mercado
```

### API de Mercados de Predicción

```text
GET /api/predictions           # Lista de mercados
POST /api/predictions          # Crear mercado (admin)
GET /api/predictions/[id]      # Detalle de mercado
GET /api/predictions/[id]/stats # Estadísticas de mercado
```

### API de Activos de Usuario

```text
GET /api/user-balance          # Saldo de usuario
POST /api/user-balance         # Depósito
GET /api/deposits/history      # Historial de depósitos
GET /api/history               # Historial de trades
POST /api/history              # Historial de posiciones
GET /api/user-portfolio        # Portafolio
POST /api/user-portfolio/compute # Calcular PnL
```

### API de Sistema Social

```text
POST /api/follows              # Seguir usuario
DELETE /api/follows            # Dejar de seguir
GET /api/follows               # Lista de seguidos
POST /api/follows/counts       # Contadores de seguidos
GET /api/user-follows          # Seguidores de usuario
POST /api/user-follows/user    # Operación de seguir
GET /api/user-follows/counts   # Contadores
```

### API de Discusiones

```text
GET /api/discussions           # Lista de discusiones
POST /api/discussions          # Crear discusión
PATCH /api/discussions/[id]    # Actualizar discusión
DELETE /api/discussions/[id]   # Eliminar discusión
POST /api/discussions/report   # Reportar discusión
```

### API de Foro

```text
GET /api/forum                 # Lista de foro
POST /api/forum                # Crear hilo
POST /api/forum/comments       # Crear comentario
POST /api/forum/vote           # Votar
GET /api/forum/user-votes      # Votos de usuario
POST /api/forum/report         # Reportar
```

### API de Mercado Flag

```text
GET /api/flags                 # Lista de flags
POST /api/flags                # Crear flag (admin)
POST /api/flags/[id]/checkin   # Check-in
GET /api/flags/[id]/checkins   # Lista de check-ins
POST /api/flags/[id]/settle    # Liquidar flag
POST /api/checkins/[id]/review # Revisar check-in
```

### API de Clasificación

```text
GET /api/leaderboard           # Clasificación
POST /api/leaderboard          # Actualizar clasificación
```

### API de Búsqueda

```text
GET /api/search                # Búsqueda
POST /api/search               # Búsqueda avanzada
```

### API de Perfil de Usuario

```text
GET /api/user-profiles         # Perfil de usuario
POST /api/user-profiles        # Actualizar perfil
```

### API de Categorías

```text
GET /api/categories            # Lista de categorías
GET /api/categories/counts     # Contadores de categorías
```

### API de Notificaciones

```text
GET /api/notifications         # Lista de notificaciones
GET /api/notifications/unread-count # Contador no leídos
POST /api/notifications/read   # Marcar como leído
POST /api/notifications/archive # Archivar
```

### API de Analítica

```text
POST /api/analytics/events     # Reportar evento
GET /api/analytics/events      # Consultar eventos
POST /api/analytics/vitals     # Web Vitals
```

### Verificación de Salud

```text
GET /api/health                # Verificación de salud
```

### Migración de Cuenta AA

```text
POST /api/aa/owner-migration   # Migrar propiedad
POST /api/aa/userop/draft      # Draft UserOperation
POST /api/aa/userop/simulate   # Simular UserOperation
POST /api/aa/userop/submit     # Enviar UserOperation
```

### Cartera Proxy

```text
POST /api/wallets/proxy        # Crear cartera proxy
```

### Emojis y Pegatinas

```text
GET /api/emojis                # Lista de emojis
POST /api/emojis               # Usar emoji
GET /api/stickers              # Lista de pegatinas
POST /api/stickers             # Comprar pegatina
```

### API de Subida

```text
POST /api/upload               # Subir archivo
```

### API de Admin

```text
GET /api/admin/roles           # Lista de roles
POST /api/admin/roles          # Crear rol
GET /api/admin/performance     # Monitoreo de rendimiento
GET /api/review/proposals      # Lista de revisión de propuestas
POST /api/review/proposals     # Revisar propuesta
GET /api/review/proposals/[id] # Detalle de propuesta
```

---

## Diseño de Base de Datos

### Tablas Principales

```sql
-- Órdenes (escritas por Relayer)
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

-- Trades (eventos on-chain)
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

-- Velas (OHLCV)
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

## Guía de Despliegue

### Contratos Inteligentes

```bash
# 1. Configurar variables de entorno
export PRIVATE_KEY=your_deployer_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# 2. Compilar contratos
npx hardhat compile

# 3. Desplegar
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy
```

### Frontend

```bash
# 1. Construir
cd apps/web
npm run build

# 2. Desplegar en Vercel
vercel deploy --prod
```

### Relayer

```bash
# 1. Construir
cd services/relayer
npm run build

# 2. Ejecutar con PM2
pm2 start dist/index.js --name foresight-relayer

# 3. O usar Docker
docker build -t foresight-relayer .
docker run -d -p 3001:3001 foresight-relayer
```

---

## Normas de Seguridad

### Contratos Inteligentes

1. **Protección Reentrancia**: Todas las funciones de modificación de estado usan `ReentrancyGuard`
2. **Control de Acceso**: Usando OpenZeppelin AccessControl
3. **Protección Flash Loan**: Límite de transacciones por bloque
4. **Seguridad de Firmas**: Verificación maleabilidad ECDSA
5. **Cortocircuito**: Funcionalidad de pausa de emergencia

### Frontend

1. **Validación de Entrada**: Usar `validateAndSanitize` para sanitizar entrada de usuario
2. **Protección XSS**: Nunca renderizar entrada cruda directamente
3. **Protección CSRF**: API usa verificación de firma
4. **Rate Limiting**: Usar wrapper `withRateLimit` para rutas API

---

## Guía de Pruebas

### Pruebas de Contratos Inteligentes

```bash
# Ejecutar todas las pruebas
npx hardhat test

# Ejecutar archivo de prueba específico
npx hardhat test test/SecurityTests.test.cjs

# Generar reporte de cobertura
npx hardhat coverage
```

### Pruebas de Frontend

```bash
# Ejecutar pruebas unitarias
npm run test

# Ejecutar pruebas E2E
npm run test:e2e

# Ejecutar pruebas con reporte
npm run test:web -- --run
```

### Pruebas de Relayer

```bash
# Ejecutar pruebas unitarias
npm test

# Ejecutar pruebas de integración
npm run test:integration
```

### Puntos Clave de Prueba

1. **Verificación de Firmas**: Asegurar que la validación de firma EIP-712 funciona correctamente 2.撮合 de Órdenes\*\*: Verificar lógica de撮合 de órdenes límite y de mercado
2. **Proceso de Liquidación**: Probar liquidación de mercado y cálculo de ganancias
3. **Protección de Seguridad**: Verificar protección reentrancy y protección flash loan
4. **Manejo de Concurrencia**: Probar estabilidad bajo escenarios de alta concurrencia

---

## Solución de Problemas

### Problemas Comunes

**Problema: Envío de orden falló**

1. Verificar si la firma es válida y no ha expirado
2. Confirmar formato de parámetros de orden (precisión precio/cantidad)
3. Verificar que el saldo de cuenta es suficiente
4. Comprobar si se activó la protección contra replay

**Problema: Conexión WebSocket desconectada**

1. Verificar estabilidad de conexión de red
2. Confirmar que el puerto WebSocket es correcto (por defecto 3006)
3. Comprobar si el firewall bloquea la conexión
4. Intentar reconectar (implementar mecanismo de reconexión automática)

**Problema: Llamada de contrato falló**

1. Verificar si la URL RPC es accesible
2. Confirmar que el saldo de cartera es suficiente
3. Verificar que la dirección de contrato es correcta
4. Comprobar si se activó el límite de gas

**Problema: Alta latencia de撮合**

1. Verificar estado del servicio Relayer
2. Comprobar rendimiento de consultas Supabase
3. Confirmar que la latencia de red es normal
4. Verificar si hay muchas órdenes pendientes

### Visualización de Logs

```bash
# Logs de Relayer
tail -f services/relayer/logs/app.log

# Logs de frontend (consola del navegador)
# Abrir herramientas de desarrollador del navegador

# Logs de contratos (explorador de blockchain)
# Ver detalles de transacción en PolygonScan
```

### Métricas de Monitoreo

```bash
# Ver métricas Prometheus
curl http://localhost:3001/metrics

# Ver panel Grafana
open http://localhost:3030
```

### Consejos de Optimización de Rendimiento

1. **Consultas de Base de Datos**: Usar índices para optimizar rendimiento de consultas
2. **Estrategia de Cache**: Usar cache Redis para datos frecuentes
3. **Operaciones en Lote**: Usar operaciones en lote para reducir transacciones on-chain
4. **Optimización de Gas**: Usar ERC-1155 para reducir llamadas de contrato
5. **Aceleración CDN**: Usar CDN para recursos estáticos

---

## Más Recursos

- [Documentación Next.js](https://nextjs.org/docs)
- [Documentación React Query](https://tanstack.com/query/latest)
- [Contratos OpenZeppelin](https://docs.openzeppelin.com/contracts)
- [Protocolo UMA](https://docs.uma.xyz)
- [Especificación EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [Documentación Polygon](https://docs.polygon.technology)

---

**Última Actualización**: 2025-01-26  
**Versión de Documentación**: v3.0

---

**Idiomas / Languages / 语言切换 / Langue / 언어:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
