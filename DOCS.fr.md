# 📚 Documentation Développeur Foresight

> Manuel de référence technique complet couvrant les contrats intelligents, l'architecture frontend, la conception d'API et le déploiement.

---

## 📑 Contenu

- [Vue d'Ensemble](#vue-densemble)
- [Contrats Intelligents](#contrats-intelligents)
- [Architecture Frontend](#architecture-frontend)
- [Référence API](#référence-api)
- [Conception Base de Données](#conception-base-de-données)
- [Guide de Déploiement](#guide-de-déploiement)
- [Normes de Sécurité](#normes-de-sécurité)

---

## Vue d'Ensemble

Foresight adopte une architecture hybride **撮合 hors chaîne + liquidation sur chaîne**, offrant une expérience utilisateur proche d'un exchange centralisé.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Couche d'Interaction                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Web App    │  │  Mobile App │  │  API Client │  │  Bot/SDK    │   │
│  │  (Next.js)  │  │  (Future)   │  │  (REST)     │  │  (Future)   │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Couche de Service                            │
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
│                           Couche Blockchain                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network                                ││
│  │  MarketFactory | OutcomeToken1155 | UMAOracleAdapterV2             ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Contrats Intelligents

### Architecture des Contrats

```
contracts/
├── MarketFactory.sol              # Usine de marchés (UUPS)
├── templates/
│   ├── OffchainBinaryMarket.sol   # Marché binaire
│   └── OffchainMultiMarket8.sol   # Marché multi-résultat
├── tokens/
│   └── OutcomeToken1155.sol       # Token ERC-1155
└── oracles/
    └── UMAOracleAdapterV2.sol     # Adaptateur oracle UMA
```

### Caractéristiques de Sécurité

- ✅ Protection reentrancy ReentrancyGuard
- ✅ Protection attaques prêt flash
- ✅ Limite taille opérations par lots
- ✅ Protection maleabilité ECDSA
- ✅ Mécanisme coupe-circuit (pause urgence)

---

## Architecture Frontend

### Stack Technologique

| Catégorie | Technologie          | Version |
| --------- | -------------------- | ------- |
| Framework | Next.js (App Router) | 15.5.4  |
| UI        | React                | 19      |
| Langage   | TypeScript           | 5.0     |
| Styles    | Tailwind CSS         | 3.4     |
| État      | React Query          | 5       |
| Web3      | ethers.js            | 6       |

### Internationalisation

Langues supportées:

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇰🇷 한국어

---

## Référence API

### Authentification (SIWE)

- **GET /api/siwe/nonce**: Générer nonce
- **POST /api/siwe/verify**: Vérifier signature

### Limitation de Requêtes

| Niveau   | Requêtes/Minute |
| -------- | --------------- |
| strict   | 5               |
| moderate | 20              |
| relaxed  | 60              |
| lenient  | 120             |

### Système Social

```text
# Suivre utilisateurs
POST /api/user-follows/user
GET  /api/user-follows/counts

# Discussions
GET  /api/discussions?proposalId=1
POST /api/discussions
```

### Système de Forum

```text
GET  /api/forum?eventId=1       # Obtenir fils
POST /api/forum                 # Créer fil
POST /api/forum/comments        # Créer commentaire
POST /api/forum/vote            # Voter
```

---

## Conception Base de Données

### Tables Principales

```sql
-- Ordres
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

-- Transactions
CREATE TABLE public.trades (
  id BIGINT PRIMARY KEY,
  market_address TEXT NOT NULL,
  price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  maker_address TEXT NOT NULL,
  taker_address TEXT NOT NULL
);

-- Bougies (OHLCV)
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

## Guide de Déploiement

### Contrats Intelligents

```bash
# Configurer variables
export PRIVATE_KEY=your_private_key
export RPC_URL=https://rpc-amoy.polygon.technology

# Compiler
npx hardhat compile

# Déployer
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

## Normes de Sécurité

### Contrats Intelligents

1. **Protection Reentrancy**: Utilisation `ReentrancyGuard`
2. **Contrôle Accès**: OpenZeppelin AccessControl
3. **Protection Prêt Flash**: Limite par bloc
4. **Signatures**: Vérification maleabilité ECDSA
5. **Urgence**: Pause d'urgence

### Frontend

1. **Validation**: Utiliser `validateAndSanitize`
2. **XSS**: Ne pas rendre entrée brute
3. **CSRF**: Vérification par signature
4. **Rate Limiting**: Wrapper `withRateLimit`

---

## Plus de Ressources

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation React Query](https://tanstack.com/query/latest)
- [Contrats OpenZeppelin](https://docs.openzeppelin.com/contracts)
- [Protocole UMA](https://docs.uma.xyz)

---

**Dernière Mise à Jour**: 2025-12-29

---

**Langues / Languages / 语言切换 / Idioma /:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
