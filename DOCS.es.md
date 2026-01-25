# 📚 Documentación del Desarrollador Foresight

> Manual de referencia técnica completo que cubre contratos inteligentes, arquitectura frontend, diseño de API y despliegue.

---

## 📑 Contenido

- [Arquitectura General](#arquitectura-general)
- [Contratos Inteligentes](#contratos-inteligentes)
- [Arquitectura Frontend](#arquitectura-frontend)
- [Referencia API](#referencia-api)
- [Diseño de Base de Datos](#diseño-de-base-de-datos)
- [Guía de Despliegue](#guía-de-despliegue)
- [Normas de Seguridad](#normas-de-seguridad)

---

## Arquitectura General

Foresight adopta una arquitectura híbrida **撮合 fuera de cadena + liquidación en cadena**, logrando una experiencia de usuario cercana a un exchange centralizado.

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
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Capa Blockchain                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  MarketFactory | OutcomeToken1155 | UMAOracleAdapterV2             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Contratos Inteligentes

### Arquitectura de Contratos

```
contracts/
├── MarketFactory.sol              # Fábrica de mercados (UUPS)
├── templates/
│   ├── OffchainBinaryMarket.sol   # Mercado binario
│   └── OffchainMultiMarket8.sol   # Mercado multi-resultado
├── tokens/
│   └── OutcomeToken1155.sol       # Token ERC-1155
└── oracles/
    └── UMAOracleAdapterV2.sol     # Adaptador oracle UMA
```

### Características de Seguridad

- ✅ ReentrancyGuard protección
- ✅ Protección ataques préstamo flash
- ✅ Límite tamaño operaciones por lotes
- ✅ Protección maleabilidad ECDSA
- ✅ Mecanismo cortocircuito (pausa emergencia)

---

## Arquitectura Frontend

### Stack Tecnológico

| Categoría | Tecnología           | Versión |
| --------- | -------------------- | ------- |
| Framework | Next.js (App Router) | 15.5.4  |
| UI        | React                | 19      |
| Lenguaje  | TypeScript           | 5.0     |
| Estilos   | Tailwind CSS         | 3.4     |
| Estado    | React Query          | 5       |
| Web3      | ethers.js            | 6       |

### Internacionalización

Idiomas soportados:

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

---

## Referencia API

### Autenticación (SIWE)

- **GET /api/siwe/nonce**: Generar nonce
- **POST /api/siwe/verify**: Verificar firma

### Límite de Peticiones

| Nivel    | Peticiones/Minuto |
| -------- | ----------------- |
| strict   | 5                 |
| moderate | 20                |
| relaxed  | 60                |
| lenient  | 120               |

### Sistema Social

```text
# Seguir usuarios
POST /api/user-follows/user
GET  /api/user-follows/counts

# Discusiones
GET  /api/discussions?proposalId=1
POST /api/discussions
```

### Sistema de Foro

```text
GET  /api/forum?eventId=1       # Obtener hilos
POST /api/forum                 # Crear hilo
POST /api/forum/comments        # Crear comentario
POST /api/forum/vote            # Votar
```

---

## Diseño de Base de Datos

### Tablas Principales

```sql
-- Órdenes
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

-- Transacciones
CREATE TABLE public.trades (
  id BIGINT PRIMARY KEY,
  market_address TEXT NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  maker_address TEXT NOT NULL,
  taker_address TEXT NOT NULL
);

-- Velas (OHLCV)
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

## Guía de Despliegue

### Contratos Inteligentes

```bash
# Configurar variables
export PRIVATE_KEY=your_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# Compilar
npx hardhat compile

# Desplegar
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy
```

### Frontend

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

## Normas de Seguridad

### Contratos Inteligentes

1. **Protección Reentrancia**: Uso de `ReentrancyGuard`
2. **Control Acceso**: OpenZeppelin AccessControl
3. **Protección Flash Loan**: Límite por bloque
4. **Firmas**: Comprobación maleabilidad ECDSA
5. **Emergencia**: Pausa de emergencia

### Frontend

1. **Validación**: Usar `validateAndSanitize`
2. **XSS**: No renderizar entrada cruda
3. **CSRF**: Verificación por firma
4. **Rate Limiting**: Wrapper `withRateLimit`

---

## Más Recursos

- [Documentación Next.js](https://nextjs.org/docs)
- [Documentación React Query](https://tanstack.com/query/latest)
- [Contratos OpenZeppelin](https://docs.openzeppelin.com/contracts)
- [Protocolo UMA](https://docs.uma.xyz)

---

**Última Actualización**: 2025-12-29

---

**Idiomas / Languages / 语言切换 / Langue / 언어:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
