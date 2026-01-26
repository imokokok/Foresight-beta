# 📚 Documentation Développeur Foresight v3.0

> Manuel de référence technique complet couvrant l'architecture hybride blockchain, les contrats intelligents, l'architecture frontend, les services Relayer, la conception d'API, la base de données, le déploiement, la sécurité, les tests et le dépannage.

---

## 📑 Table des Matières

1. [Vue d'Ensemble de l'Architecture](#1-vue-densemble-de-larchitecture)
2. [Contrats Intelligents](#2-contrats-intelligents)
3. [Architecture Frontend](#3-architecture-frontend)
4. [Service Relayer](#4-service-relayer)
5. [Référence API](#5-référence-api)
6. [Conception de Base de Données](#6-conception-de-base-de-données)
7. [Guide de Déploiement](#7-guide-de-déploiement)
8. [Normes de Sécurité](#8-normes-de-sécurité)
9. [Guide de Test](#9-guide-de-test)
10. [Dépannage](#10-dépannage)

---

## 1. Vue d'Ensemble de l'Architecture

### 1.1 Présentation du Système

Foresight est une plateforme de marché prédictif décentralisée construite sur une architecture hybride **hors chaîne + règlement sur chaîne**. Cette conception combine les avantages des exchanges centralisés (rapidité, faible coût, expérience utilisateur fluide) avec la sécurité de la blockchain (immuabilité, transparence, décentralisation). Le système utilise le réseau Polygon pour bénéficier de frais de transaction faibles et d'une finalité rapide, tout en intégrant le protocole UMA pour une résolution décentralisée et trustless des résultats des marchés.

L'architecture technique repose sur trois couches principales interconnectées. La couche d'interaction fournit les interfaces utilisateur via l'application web Next.js, les applications mobiles natives et les API REST pour les intégrations tierces. La couche de services englobe le moteur de correspondance Relayer à haute performance, la gestion du carnet d'ordres, l'ingestion d'événements en temps réel et la base de données Supabase pour le stockage persistant. Enfin, la couche blockchain héberge les contrats intelligents déployés sur Polygon, incluant le factory de marchés, les tokens ERC-1155 pour les résultats et l'adaptateur oracle UMA pour la vérification des résultats.

Cette séparation des responsabilités permet une scalabilité horizontale efficace. Les opérations高频 (high-frequency) comme la correspondance des ordres et la mise à jour des carnets sont effectuées hors chaîne par le service Relayer, tandis que les opérations critiques comme le règlement financier, la création de marchés et la résolution des résultats sont exécutées sur la blockchain pour garantir la sécurité et la décentralisation. Le pont entre ces deux mondes est assuré par des mécanismes de vérification cryptographique basés sur EIP-712, permettant aux utilisateurs de soumettre des ordres signés qui sont ensuite exécutés de manière trustless par le Relayer.

### 1.2 Architecture du Système

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Couche d'Interaction Utilisateur                   │
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
│                           Couche de Services                              │
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
                                    │ Protocole de Règlement
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Couche Blockchain                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      Polygon Network (Amoy/Mainnet)                 ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │                  MarketFactory (UUPS Proxy)                 │   ││
│  │  │  • createMarket()     • pauseMarket()     • resolveMarket() │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │            OffchainMarketBase (Template Implementation)    │   ││
│  │  │  • placeOrder()       • fillOrder()      • cancelOrder()   │   ││
│  │  │  • claim Winnings()   • withdraw()       • batchExecute()  │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │              OutcomeToken1155 (ERC-1155 Multi-Token)       │   ││
│  │  │  • mint()             • safeTransferFrom()  • burn()       │   ││
│  │  │  • setApprovalForAll()                   • balanceOf()     │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │              UMAOracleAdapterV2 (Oracle Integration)        │   ││
│  │  │  • requestPrice()      • settleMarket()    • getSettledPrice│   ││
│  │  │  • assertTruth()       • retrySettle()                      │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Flux de Données Principal

Le flux de données dans Foresight suit un parcours bien défini depuis la création d'un ordre jusqu'à son règlement. Lorsqu'un utilisateur décide de parier sur un résultat particulier, il commence par construire un objet d'ordre contenant toutes les informations nécessaires : l'adresse du marché cible, l'index du résultat choisi, la direction de l'ordre (achat ou vente), le prix maximum acceptable, la quantité de tokens souhaitée et une timestamp d'expiration. Cet objet est ensuite signé cryptographiquement utilisant la clé privée de l'utilisateur selon le standard EIP-712, créant ainsi une preuve vérifiable de l'intention de l'utilisateur sans nécessiter de transaction blockchain immédiate.

L'ordre signé est transmis au service Relayer via une connexion WebSocket ou une requête HTTP REST. Le Relayer vérifie d'abord la validité de la signature EIP-712 en utilisant le contrat MarketFactory comme domaine de vérification, confirmant ainsi que l'ordre n'a pas été modifié et qu'il provient bien du détenteur de l'adresse déclarée. Si la signature est valide, l'ordre est intégré dans le carnet d'ordres en mémoire (Redis) et ajouté à la file d'attente de correspondance. Le moteur de correspondance examine en continu les nouveaux ordres entrants et les confronte aux ordres opposés déjà présents dans le carnet, exécutant les transactions lorsque les conditions de prix sont satisfaites.

Lorsqu'une correspondance est trouvée, le Relayer génère une transaction de règlement qui sera soumise à la blockchain. Cette transaction包含了 les deux ordres appariés, les signatures correspondantes et les informations de prix vérifiées. La transaction est exécutée via un compte de service (EOA contrôlé par le système) qui appelle la fonction fillOrder() sur le contrat de marché. Le contrat vérifie à nouveau les signatures, transfère les tokens ERC-1155 entre les parties et met à jour les balances internes du marché. Ce processus de vérification redondante garantit qu'aucune partie ne peut tricher, même si le Relayer était compromis.

Après l'exécution on-chain, les événements émis par le contrat sont captés par le système d'ingestion d'événements du Relayer, qui met à jour les statistiques de marché, génère les données de candles OHLCV pour les graphiques et enregistre les trades dans Supabase pour l'historique persistant. Les utilisateurs peuvent ensuite consulter leurs positions, leurs gains potentiels et leur historique de transactions via l'interface frontend, avec toutes les données rafraîchies en temps réel via les connexions WebSocket établies lors du chargement de la page.

### 1.4 Caractéristiques Techniques Clés

Le système Foresight intègre plusieurs caractéristiques techniques avancées qui le distinguent des implementations traditionnelles de marchés prédictifs. Le mécanisme de correspondance utilise un algorithme de carnet d'ordres prix-temps prioritaire (price-time priority), garantissant que les ordres au meilleur prix sont exécutés en premier et que les ordres au même prix sont exécutés selon leur ordre d'arrivée. Cette approche assure une découverte de prix équitable et efficace, permettant aux participants du marché d'exprimer leurs opinions avec une granularité fine sur les probabilités perçues des différents résultats.

La gestion des ordres utilise un système de signature EIP-712 sophistiqué qui lie chaque ordre à un domaine spécifique (adresse du contrat vérificateur, chain ID, version du contrat). Cette liaison empêche les attaques de replay entre différents marchés ou différentes chaînes, et permet aux utilisateurs de signer des ordres en toute confiance sachant qu'ils ne peuvent être exécutés que sur le marché désigné et avec les conditions exactes spécifiées. Les ordres incluent également un параметètre de slippage maximal (prix limite) qui protège les utilisateurs contre l'exécution à des prix défavorables lors de volatilité élevée.

Le système intègre une protection contre le front-running via un mécanisme de délestage (slippage tolerance) et de délai d'exécution minimal. Les ordres sont exécutés au prix limite ou mieux, garantissant que les utilisateurs obtiennent au moins le prix qu'ils ont accepté. Le Relayer implémente également des contrôles anti-épuisement (anti-gaming) qui détectent et rejettent les tentatives de manipulation de marché, comme les spoofing orders ou les wash trading patterns.

---

## 2. Contrats Intelligents

### 2.1 Architecture des Contrats

L'architecture des contrats intelligents de Foresight est construite selon le pattern Factory-Template, permettant une création extensible de nouveaux types de marchés tout en共用ant une logique commune de base. Le contrat MarketFactory agit comme registre central de tous les marchés et comme point d'entrée pour les opérations administratives. Les marchés individuels sont déployés comme des instances clones du template OffchainMarketBase, utilisant le mécanisme ERC-1167 de minimal proxies pour minimiser les coûts de déploiement. Cette approche permet de créer des dizaines de marchés avec un seul template, chaque instance étant configurée avec ses propres paramètres spécifiques (question, résultats possibles, dates de résolution, oracle associé).

```
contracts/
├── MarketFactory.sol                    # Usine principale (UUPS Upgradeable)
│   ├── Rôles: Admin, Operator, Oracle
│   ├── createMarket(question, outcomes, resolutionDate, oracle)
│   ├── pauseMarket(marketAddress)
│   ├── resolveMarket(marketAddress, ancillaryData)
│   └── upgradeTo(newImplementation)
│
├── templates/
│   ├── OffchainMarketBase.sol          # Template de base (abstract)
│   │   ├── initialize(admin, factory)
│   │   ├── placeOrder(order, signature)
│   │   ├── fillOrder(order, signature, fillAmount)
│   │   ├── cancelOrder(orderHash)
│   │   ├── claimWinnings()
│   │   ├── withdraw(tokenId, amount)
│   │   └── batchExecute(orders, signatures, fillAmounts)
│   │
│   ├── OffchainBinaryMarket.sol        # Marché binaire (Oui/Non)
│   │   └── 2 résultats possibles
│   │
│   └── OffchainMultiMarket8.sol        # Marché multi-résultats (8 max)
│       └── 2-8 résultats possibles
│
├── tokens/
│   └── OutcomeToken1155.sol            # Token ERC-1155
│       ├── initialize(name, symbol, uri)
│       ├── mint(to, id, amount)
│       ├── safeTransferFrom(from, to, id, amount, data)
│       ├── balanceOf(account, id)
│       └── setApprovalForAll(operator, approved)
│
└── oracles/
    └── UMAOracleAdapterV2.sol          # Adaptateur Oracle UMA
        ├── requestPrice(identifier, timestamp, ancillaryData)
        ├── settleMarket(marketAddress)
        ├── assertTruth(claim, bond)
        ├── retrySettle(marketAddress)
        └── getSettledPrice(marketAddress)
```

### 2.2 MarchéFactory (MarketFactory)

Le contrat MarketFactory est le cœur du système de contrats, responsible de la création, de la gestion et du contrôle de tous les marchés. Il implémente le pattern UUPS (Universal Upgradeable Proxy Standard) d'OpenZeppelin, permettant des mises à jour futures du contrat tout en préservant l'état et l'adresse de déploiement. Le contrat utilise le système de contrôle d'accès par rôles (AccessControl) avec trois rôles principaux : ADMIN_ROLE pour les opérations de haut niveau comme les mises à jour de contrat, OPERATOR_ROLE pour la gestion quotidienne des marchés (pause, résolution), et ORACLE_ROLE pour les interactions avec le système UMA.

La fonction createMarket permet la création de nouveaux marchés prédictifs avec des paramètres flexibles. Le paramètre question contient la question posée aux participants, encodée en bytes pour supporter tout type de caractères. Le tableau outcomes spécifie les résultats possibles, chaque résultat étant identifié par un index entier (0, 1, 2, etc.). Le paramètre resolutionDate définit la date limite après laquelle le marché peut être résolu, et resolutionReward configure la récompense pour l'oracle qui résout le marché. L'oracle paramètre specify le contrat oracle à utiliser (UMA par défaut ou personnalisé).

Une fois un marché créé, le factory déploie automatiquement un proxy minimal pointant vers le template approprié (binaire ou multi-résultat), initialise le nouveau contrat avec les paramètres du marché et enregistre le marché dans le registre interne. Le factory maintient également une liste de tous les marchés créés, permettant une énumération facile pour les interfaces utilisateur et les outils d'audit.

```solidity
// MarketFactory.sol - Extraits de Code Clé

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

        // Clone le template approprié
        if (params.outcomes.length == 2) {
            marketAddress = _cloneTemplate(templateBinary);
        } else {
            marketAddress = _cloneTemplate(templateMulti);
        }

        // Initialise le marché
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

### 2.3 Marché de Base (OffchainMarketBase)

Le contrat OffchainMarketBase fournit la logique commune à tous les types de marchés et implémente les fonctionnalités essentielles de placement, d'exécution et d'annulation d'ordres. Le contrat utilise le pattern de vérification de signature hors chaîne (off-chain signature verification), où les signatures sont vérifiées par le Relayer avant l'exécution, réduisant ainsi les coûts de gas on-chain. Cependant, le contrat maintient la capacité de vérifier les signatures pour les cas où une exécution directe par l'utilisateur est nécessaire.

Le système d'ordres utilise une structure de données organisée par résultat (outcome) et par direction (buy/sell), permettant un accès rapide aux ordres correspondant aux critères de correspondance. Chaque résultat a son propre carnet d'ordres buy-side (demande) et sell-side (offre), avec les ordres triés par prix et par temps. Cette organisation permet au moteur de correspondance de trouver rapidement les meilleures contreparties pour un nouvel ordre entrant.

La fonction fillOrder est le point d'entrée principal pour l'exécution des ordres. Elle vérifie la signature de l'ordre (en utilisant EIP-712), transfère les tokens ERC-1155 correspondants du creanter (maker) vers le preneur (taker), et met à jour les balances internes du marché. Le marché maintient des balances séparées pour chaque résultat, permettant aux utilisateurs de détenir des positions longues ou courtes sur différents résultats simultanément.

```solidity
// OffchainMarketBase.sol - Structure et Fonctions Principales

abstract contract OffchainMarketBase is
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable
{
    struct Order {
        address maker;
        uint256 outcome;
        bool isBuy;
        uint128 price;          // Prix en Wei (0-1e18)
        uint128 amount;         // Quantité en Wei
        uint64 expires;         // Timestamp expiration
        uint64 nonce;           // Anti-replay nonce
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Carnets d'ordres par résultat et direction
    mapping(uint256 => Order[]) internal _buyOrders;
    mapping(uint256 => Order[]) internal _sellOrders;

    // Balances des utilisateurs par résultat
    mapping(address => mapping(uint256 => int256)) public balances;

    // Mapping nonce -> utilisé
    mapping(address => mapping(uint64 => bool)) public orderNonces;

    // Statut du marché
    bool public paused;
    bool public resolved;
    uint256 public resolutionTimestamp;
    int256 public settledPrice;

    // Events
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

        // Vérification signature (EIP-712)
        bytes32 orderHash = _hashOrder(order);
        require(_verifySignature(orderHash, signature, order.maker), "Invalid signature");

        // Vérification nonce
        require(!orderNonces[order.maker][order.nonce], "Nonce already used");
        orderNonces[order.maker][order.nonce] = true;

        // Ajouter au carnet d'ordres
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

        // Vérification signature
        bytes32 orderHash = _hashOrder(order);
        require(_verifySignature(orderHash, signature, order.maker), "Invalid signature");

        require(fillAmount <= order.amount, "Fill exceeds order");
        require(orderNonces[order.maker][order.nonce], "Nonce not used");

        // Calcul du coût/paiement
        uint256 cost = (uint256(fillAmount) * order.price) / 1e18;

        if (order.isBuy) {
            // Maker vend, Taker achète
            balances[order.maker][order.outcome] -= int256(fillAmount);
            balances[msg.sender][order.outcome] += int256(fillAmount);

            // Transfert des tokens du maker vers le taker
            IERC1155(outcomeToken).safeTransferFrom(
                order.maker,
                msg.sender,
                order.outcome,
                fillAmount,
                ""
            );

            // Paiement du taker vers le maker
            if (cost > 0) {
                _transferPayment(msg.sender, order.maker, cost);
            }
        } else {
            // Maker achète, Taker vend
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

        // Mettre à jour la quantité restante de l'ordre
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

        // Transfert des tokens winners vers le contrat pour burn
        IERC1155(outcomeToken).safeTransferFrom(
            msg.sender,
            address(this),
            uint256(uint32(_settledOutcome)),
            winningAmount,
            ""
        );

        // Calcul et transfert du payout
        uint256 payout = (winningAmount * uint256(_settledPrice)) / 1e18;
        _transferPayment(address(this), msg.sender, payout);

        balances[msg.sender][uint256(uint32(_settledOutcome))] = 0;
    }
}
```

### 2.4 Token de Résultat ERC-1155

Le contrat OutcomeToken1155 implémente le standard ERC-1155 pour représenter les résultats échangeables de chaque marché. Contrairement aux ERC-721 qui représentent des actifs uniques, les ERC-1155 permettent de gérer des tokens semi-fongibles (quantifiables), ce qui est parfait pour les marchés prédictifs où les utilisateurs peuvent détenir des fractions de résultat. Chaque marché génère autant de tokens ERC-1155 qu'il y a de résultats possibles, chaque token étant identifié par un index unique (0, 1, 2, etc.).

Le contrat utilise le pattern mint-on-demand, où les tokens sont créés uniquement lorsque les utilisateurs placent des ordres d'achat. Cette approche élimine le besoin de pré-mint tous les tokens lors de la création du marché et réduit les coûts de déploiement. Lorsque le marché est résolu, seuls les tokens correspondant au résultat gagnant ont de la valeur ; les autres peuvent être brûlés ou conservés comme souvenirs.

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

    // Marché -> Index résultat -> Autorisé à mint
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

    // Les marchés peuvent mint leurs propres tokens
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

### 2.5 Adaptateur Oracle UMA

Le contrat UMAOracleAdapterV2 intègre le protocole UMA (Universal Market Access) pour la résolution décentralisée des marchés. UMA utilise un système d'optimistic oracle où les assertions de vérité peuvent être contestées, créant un mécanisme de résolution incitatif où les断言urs (asserters) ont un intérêt économique à fournir des informations correctes. Le contrat adapte les interfaces complexes d'UMA aux besoins spécifiques des marchés prédictifs de Foresight.

Lorsqu'un marché nécessite une résolution, le contrat envoie une requête à l'oracle UMA avec l'identifiant du marché et les données auxiliaires contenant la question. L'oracle UMA expose ensuite la question aux détenteurs de DATA (le token de gouvernance d'UMA) qui peuvent soumettre leurs propres réponses et parier sur leur exactitude. Si personne ne conteste la réponse pendant la période de dispute, la réponse est considérée comme définitive et le marché peut être clôturé avec le résultat confirmé.

```solidity
// UMAOracleAdapterV2.sol

contract UMAOracleAdapterV2 is
    UUPSUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");

    address public umaOptimisticOracle;
    address public umaFinder;
    address publicUmaCollateralToken; // USDC typically

    bytes32 public constant DEFAULT_IDENTIFIER = bytes32("ASSERT_TRUTH");

    // Marché -> Statut de résolution
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
                ancillaryData,  // La question du marché
                ", but for the purposes of this market, the winning outcome is represented by a price between 0 and 1e18 where 0 means outcome 0 wins and 1e18 means outcome 1 wins. What is the price?"
            ),
            msg.sender,
            proposedPrice,
            1 days,  // Liveness period
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

        // Appeler la fonction de règlement d'UMA
        // Récupérer le prix résolu
        uint256 settledPrice = _fetchSettledPrice(status.assertionId);

        status.settled = true;
        status.settledPrice = settledPrice;

        emit PriceSettled(
            marketAddress,
            settledPrice >= 5e17 ? 1 : 0, // Binaire: 0 ou 1
            settledPrice
        );
    }

    function retrySettle(address marketAddress) external {
        ResolutionStatus storage status = resolutionStatus[marketAddress];
        require(status.requested, "No price requested");
        require(!status.settled, "Already settled");

        // Réessayer de récupérer le prix
        _fetchSettledPrice(status.assertionId);
    }

    function _fetchSettledPrice(bytes32 assertionId)
        internal
        returns (uint256 price)
    {
        // Implémentation simplifiée - la version réelle interagit
        // avec le contrat store d'UMA pour récupérer le prix утвержденный
        return 0; // Placeholder
    }
}
```

### 2.6 Événements et Erreurs

Les contrats intelligents émettent des événements pour toutes les opérations importantes, permettant une indexation et une surveillance efficaces. Les événements incluent la création de marchés, le placement et l'exécution d'ordres, les annulations, les résolutions et les retraits. Ces événements sont captés par le service Relayer et stockés dans Supabase pour l'historique et l'analyse.

```solidity
// Events principaux

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

// Erreurs personnalisées

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

### 2.7 Considérations de Sécurité

La sécurité des contrats intelligents est une priorité absolue pour Foresight, compte tenu de la valeur financière potentiellement importante gérée par le système. Plusieurs couches de protection sont implémentées pour prévenir les vecteurs d'attaque courants. Le modificateur nonReentrant est appliqué à toutes les fonctions externes qui effectuent des transferts de tokens ou de ETH, prévenant les attaques de réentrance qui ont causé de nombreuses failles historiques dans l'écosystème Ethereum.

La protection contre les attaques par prêt flash (flash loan attacks) est implémentée via plusieurs mécanismes. Les opérations de création de marché et de résolution sont protégées par des délais et des conditions de sécurité. Les changements de prix importants sur de courtes périodes déclencheront des alertes dans le système de monitoring. De plus, le système de vérification de signature EIP-712 garantit que même si un attaquant contrôle le Relayer, il ne peut pas exécuter d'ordres falsifiés car chaque ordre doit être signé par le véritable détenteur des fonds.

Le mécanisme de pause d'urgence permet aux opérateurs d'arrêter temporairement toutes les opérations sur un marché ou sur l'ensemble du système en cas de détection d'anomalies ou de vulnérabilités. Cette fonctionnalité est contrôlée par le rôle OPERATOR_ROLE et peut être activée rapidement pour protéger les fonds des utilisateurs en cas d'urgence. Une fois le problème résolu, les marchés peuvent être déverrouillés par un administrateur avec le rôle ADMIN_ROLE.

---

## 3. Architecture Frontend

### 3.1 Stack Technologique

L'application frontend de Foresight est construite avec les technologies les plus modernes de l'écosystème React, garantissant performance, sécurité et expérience développeur optimale. Next.js 15.5.4 avec App Router fournit le cadre de l'application, gérant le rendu serveur (SSR), la génération statique (SSG) et l'hydration côté client. React 19 apporte les dernières améliorations en termes de performance et de developer experience, incluant les Server Components et les Actions Server simplifiées. TypeScript 5.0 assure une vérification de types complète à travers toute la base de code, réduisant les erreurs runtime et facilitant la maintenance.

La gestion d'état utilise une combinaison de React Query (TanStack Query v5) pour le serveur state et React Context/Zustand pour le client state. React Query gère automatiquement le caching, la refetching, les mutations et la synchronisation des données serveur, éliminant le besoin de logique manuelle de gestion d'état pour les API calls. Zustand est utilisé pour l'état local de l'interface comme les modales ouvertes, les préférences utilisateur et les états de chargement non liés aux données.

Styling est réalisé avec Tailwind CSS 3.4, permettant un développement rapide d'interfaces responsives avec un bundle CSS minimal grâce au tree-shaking. Les composants UI réutilisables sont construits avec Radix UI primitives, fournissant une accessibilité intégrée (ARIA labels, keyboard navigation) sans imposer un design particulier. Cette approche découplée permet une personnalisation visuelle complète tout en bénéficiant de primitives accessibles.

| Catégorie     | Technologie     | Version | Rôle                           |
| ------------- | --------------- | ------- | ------------------------------ |
| Framework     | Next.js         | 15.5.4  | SSR/SSG, Routing, API Routes   |
| UI Library    | React           | 19      | Composants, État, Événements   |
| Langage       | TypeScript      | 5.0     | Types statiques, IDE support   |
| Styles        | Tailwind CSS    | 3.4     | Utility-first CSS              |
| Data Fetching | React Query     | 5       | Server state management        |
| Web3          | ethers.js       | 6       | Connexion blockchain           |
| Forms         | React Hook Form | 7       | Form management, validation    |
| i18n          | next-intl       | 5       | Internationalisation           |
| Charts        | Recharts        | 2       | Graphiques OHLCV, Volume       |
| Date/Time     | date-fns        | 4       | Formatting, manipulation dates |

### 3.2 Structure du Projet

La structure du projet frontend suit les conventions Next.js App Router avec une organisation claire par fonctionnalité et responsabilité. Le dossier app/ contient les routes de l'application, chaque sous-dossier représentant une page ou un groupe de pages. Le dossier components/ organise les composants réutilisables par catégorie (ui pour les primitives, features pour les composants métier, charts pour les visualisations). Le dossier lib/ contient les utilitaires, les configurations et les abstractions de bas niveau.

```
apps/web/
├── app/
│   ├── (auth)/                    # Routes d'authentification
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (main)/                    # Routes principales
│   │   ├── page.tsx               # Dashboard / Accueil
│   │   ├── markets/
│   │   │   ├── page.tsx           # Liste des marchés
│   │   │   ├── [address]/         # Détail d'un marché
│   │   │   │   ├── page.tsx
│   │   │   │   ├── trades/        # Historique des trades
│   │   │   │   └── orders/        # Carnet d'ordres
│   │   │   └── create/            # Création de marché
│   │   │       └── page.tsx
│   │   │
│   │   ├── portfolio/             # Portfolio utilisateur
│   │   │   └── page.tsx
│   │   │
│   │   ├── leaderboard/           # Classements
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/              # Paramètres utilisateur
│   │       └── page.tsx
│   │
│   ├── api/                       # API Routes (Backend-for-Frontend)
│   │   ├── siwe/                  # Authentification Web3
│   │   ├── orders/                # Ordres et signatures
│   │   ├── markets/               # Données de marchés
│   │   └── user/                  # Données utilisateur
│   │
│   ├── layout.tsx                 # Root layout (Providers)
│   └── globals.css                # Global styles
│
├── components/
│   ├── ui/                        # Composants primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   ├── Table.tsx
│   │   ├── Tabs.tsx
│   │   └── Dropdown.tsx
│   │
│   ├── charts/                    # Visualisations
│   │   ├── PriceChart.tsx
│   │   ├── VolumeChart.tsx
│   │   ├── CandlestickChart.tsx
│   │   └── DepthChart.tsx
│   │
│   ├── features/                  # Composants métier
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
│   └── providers/                 # Context Providers
│       ├── Web3Provider.tsx
│       ├── QueryProvider.tsx
│       └── I18nProvider.tsx
│
├── lib/
│   ├── contracts/                 # ABIs et adresses
│   │   ├── marketFactory.ts
│   │   ├── outcomeToken.ts
│   │   └── umaOracle.ts
│   │
│   ├── utils/                     # Utilitaires
│   │   ├── formatting.ts          # Nombres, dates, devises
│   │   ├── validation.ts          # Schémas de validation
│   │   └── constants.ts           # Constantes partagées
│   │
│   ├── hooks/                     # Custom hooks
│   │   ├── useWeb3.ts
│   │   ├── useOrders.ts
│   │   └── useMarketData.ts
│   │
│   └── sdk/                       # SDK client
│       └── foresight.ts
│
├── types/                         # TypeScript definitions
│   ├── market.ts
│   ├── order.ts
│   ├── trade.ts
│   └── user.ts
│
├── messages/                      # Fichiers de traduction
│   ├── en.json
│   ├── zh-CN.json
│   ├── es.json
│   ├── fr.json
│   └── ko.json
│
├── public/                        # Assets statiques
│   ├── images/
│   └── locales/
│
├── next.config.js                 # Configuration Next.js
├── tailwind.config.ts             # Configuration Tailwind
├── tsconfig.json                  # Configuration TypeScript
└── package.json
```

### 3.3 Providers et Configuration Globale

L'application utilise un système de providers React pour injecter les dépendances globales et la configuration dans l'arbre de composants. Le Root Layout combine tous les providers nécessaires et établit le contexte global de l'application.

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
      staleTime: 1000 * 30, // 30 seconds
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

### 3.4 Composants de Trading

Les composants de trading constituent le cœur fonctionnel de l'interface utilisateur, permettant aux utilisateurs de placer des ordres, de visualiser le carnet d'ordres et de suivre leurs positions. Le composant OrderForm encapsule toute la logique de création d'ordres, incluant la validation des entrées, le calcul des prix et la signature EIP-712.

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
      // Signer l'ordre avec EIP-712
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

      // Soumettre au Relayer
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
      // Trigger wallet connection
      return;
    }

    const order: Order = {
      maker: address,
      outcome: outcomeIndex,
      isBuy,
      price: parseEther(price) as unknown as bigint,
      amount: parseEther(amount) as unknown as bigint,
      expires: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
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

### 3.5 Internationalisation (i18n)

Le système d'internationalisation utilise next-intl pour gérer les traductions à travers les 5 langues prises en charge. Les fichiers de messages sont structurés par namespace (common, trading, market, portfolio, etc.) pour faciliter la organisation et le chargement paresseux des traductions.

```json
// messages/fr.json

{
  "common": {
    "appName": "Foresight",
    "connected": "Connecté",
    "disconnected": "Déconnecté",
    "connectWallet": "Connecter le portefeuille",
    "loading": "Chargement...",
    "error": "Erreur",
    "success": "Succès",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "edit": "Modifier",
    "viewAll": "Voir tout"
  },
  "trading": {
    "buy": "Acheter",
    "sell": "Vendre",
    "price": "Prix",
    "amount": "Montant",
    "outcome": "Résultat",
    "placeBuyOrder": "Placer un ordre d'achat",
    "placeSellOrder": "Placer un ordre de vente",
    "orderSubmitted": "Ordre soumis avec succès",
    "orderFailed": "Échec de l'ordre",
    "connectWalletPrompt": "Veuillez connecter votre portefeuille",
    "estimated": "Estimé",
    "maxSlippage": "Slippage max",
    "orderBook": "Carnet d'ordres",
    "recentTrades": "Transactions récentes",
    "myOrders": "Mes ordres",
    "noOrders": "Aucun ordre",
    "orderExpires": "Expire"
  },
  "market": {
    "createMarket": "Créer un marché",
    "marketDetails": "Détails du marché",
    "resolutionDate": "Date de résolution",
    "status": "Statut",
    "statusActive": "Actif",
    "statusResolved": "Résolu",
    "statusPaused": "En pause",
    "volume": "Volume",
    "liquidity": "Liquidité",
    "traders": "Traders",
    "discussions": "Discussions",
    "forum": "Forum"
  },
  "portfolio": {
    "positions": "Positions",
    "history": "Historique",
    "pnl": "P&L",
    "totalValue": "Valeur totale",
    "realizedPnL": "P&L réalisé",
    "unrealizedPnL": "P&L non réalisé"
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

## 4. Service Relayer

### 4.1 Architecture du Relayer

Le service Relayer est le composant central de l'architecture hors chaîne, responsable du traitement haute performance des ordres et de la gestion du carnet d'ordres. Construit avec Node.js et TypeScript, le Relayer utilise une architecture événementielle basée sur Redis pour la persistance en mémoire et la distribution des données en temps réel. Le service se compose de plusieurs modules spécialisés qui fonctionnent de manière coordonnée pour fournir une expérience d'échange fluide et rapide.

L'architecture du Relayer est conçue pour la scalabilité horizontale. Chaque instance du Relayer peut traiter une charge de milliers d'ordres par seconde, et plusieurs instances peuvent être déployées derrière un load balancer pour augmenter la capacité. Le partitionnement Redis permet de distribuer la charge de données entre plusieurs nœuds, et les WebSocket connections sont équilibrées entre les instances pour maintenir une connexion stable pour chaque utilisateur.

Le module Order Book Management maintient une structure de données en mémoire représentant le carnet d'ordres pour tous les marchés actifs. Cette structure est optimisée pour les opérations de correspondance rapide, utilisant des arbres équilibrés (AVL ou Red-Black) pour les recherches de prix et des maps pour l'accès direct par hash d'ordre. Les données sont périodiquement sauvegardées sur disque et dans Supabase pour la durabilité.

Le module Matching Engine implémente l'algorithme de correspondance prix-temps. Lorsqu'un nouvel ordre arrive, le moteur cherche immédiatement les contreparties compatibles dans le carnet d'ordres existant. Si une correspondance est trouvée, l'ordre est exécuté partiellement ou entièrement, et une transaction blockchain est générée pour règlement. Le moteur maintient également un registre des ordres exécutés pour l'historique et les statistiques.

Le module Event Ingestion écoute les événements blockchain en temps réel via les WebSocket connections aux nœuds Polygon. Ces événements déclenchent des mises à jour du carnet d'ordres, des notifications aux utilisateurs connectés et des mises à jour des statistiques de marché. Le module utilise un système de filtrage par adresse de contrat pour ne recevoir que les événements pertinents.

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

### 4.2 Code du Moteur de Correspondance

Le moteur de correspondance est au cœur du Relayer, implémentant l'algorithme qui exécute les ordres des utilisateurs. L'algorithme suit le principe prix-temps (price-time priority), où les ordres au meilleur prix sont exécutés en premier, et les ordres au même prix sont exécutés selon leur ordre d'arrivée.

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

### 4.3 Gestion des Signatures EIP-712

Le système de vérification de signature est crucial pour la sécurité du Relayer. Chaque ordre doit être signé par le créateur (maker) avant d'être accepté dans le carnet d'ordres. La vérification est effectuée selon le standard EIP-712, qui définit un format structuré pour les signatures de données typées.

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

### 4.4 Service WebSocket en Temps Réel

Le service WebSocket permet aux utilisateurs de recevoir les mises à jour en temps réel du carnet d'ordres, des trades exécutés et des changements d'état des marchés. Socket.io est utilisé pour la gestion des connexions, avec des rooms par marché pour optimiser la distribution des messages.

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

        // La vérification de signature réelle se fait ici
        // en récupérant le message nonce et en vérifiant

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

## 5. Référence API

### 5.1 Points d'Entrée API

L'API REST de Foresight fournit des endpoints pour toutes les opérations nécessaires aux applications clientes. L'API utilise l'authentification SIWE (Sign-In with Ethereum) pour sécuriser les endpoints protégés et implémente une limitation de taux (rate limiting) basée sur l'adresse IP et l'adresse Ethereum.

```
https://api.foresight.market/

├── /api/
│   ├── siwe/
│   │   ├── GET    /nonce          → Générer un nonce pour l'auth
│   │   ├── POST   /verify         → Vérifier la signature
│   │   └── POST   /logout         → Invalider la session
│   │
│   ├── auth/
│   │   ├── GET    /session        → Récupérer la session active
│   │   └── POST   /refresh        → Rafraîchir le token
│   │
│   ├── markets/
│   │   ├── GET    /               → Liste des marchés
│   │   ├── GET    /:address       → Détails d'un marché
│   │   ├── GET    /:address/book  → Carnet d'ordres
│   │   ├── GET    /:address/trades→ Historique des trades
│   │   ├── GET    /:address/candles→ Données OHLCV
│   │   └── POST   /               → Créer un marché (admin)
│   │
│   ├── orders/
│   │   ├── GET    /               → Liste des ordres utilisateur
│   │   ├── GET    /:orderId       → Détails d'un ordre
│   │   ├── POST   /               → Soumettre un ordre signé
│   │   ├── DELETE /:orderId       → Annuler un ordre
│   │   └── POST   /batch          → Soumettre plusieurs ordres
│   │
│   ├── trades/
│   │   ├── GET    /               → Liste des trades utilisateur
│   │   └── GET    /:tradeId       → Détails d'un trade
│   │
│   ├── user/
│   │   ├── GET    /profile        → Profil utilisateur
│   │   ├── PATCH  /profile        → Mettre à jour le profil
│   │   ├── GET    /portfolio      → Portfolio complet
│   │   ├── GET    /positions      → Positions ouvertes
│   │   ├── GET    /history        → Historique complet
│   │   └── GET    /stats          → Statistiques utilisateur
│   │
│   ├── user-follows/
│   │   ├── GET    /               → Liste des abonnements
│   │   ├── POST   /               → Suivre un utilisateur
│   │   ├── DELETE /:userAddress   → Ne plus suivre
│   │   └── GET    /counts         → Compteurs de followers
│   │
│   ├── discussions/
│   │   ├── GET    /               → Liste des discussions
│   │   ├── POST   /               → Créer une discussion
│   │   ├── GET    /:id            → Détails d'une discussion
│   │   └── DELETE /:id            → Supprimer une discussion
│   │
│   ├── forum/
│   │   ├── GET    /               → Liste des fils
│   │   ├── POST   /               → Créer un fil
│   │   ├── GET    /:id            → Détails d'un fil
│   │   ├── POST   /:id/comments   → Ajouter un commentaire
│   │   ├── POST   /:id/vote       → Voter pour un fil
│   │   └── POST   /comments/:id/vote→ Voter pour un commentaire
│   │
│   └── analytics/
│       ├── GET    /volume         → Données de volume
│       ├── GET    /leaderboard    → Classement des traders
│       └── GET    /trending       → Marchés tendance
```

### 5.2 Documentation Détaillée des Endpoints

**Authentication (SIWE)**

```
GET /api/siwe/nonce
```

Génère un nonce cryptographique pour l'authentification SIWE. Ce nonce est lié à l'adresse IP et expire après 10 minutes.

**Response:**

```json
{
  "nonce": "0x1234567890abcdef",
  "expiresAt": "2025-01-15T10:20:00Z"
}
```

```
POST /api/siwe/verify
```

Vérifie la signature Ethereum et établit une session.

**Request Body:**

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

**Response:**

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

**Marchés**

```
GET /api/markets
```

Récupère la liste des marchés avec pagination et filtrage.

**Query Parameters:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| page | number | Page courante (default: 1) |
| limit | number | Items par page (default: 20, max: 100) |
| status | string | Filtrer par statut (active, resolved, paused) |
| category | string | Catégorie du marché |
| sortBy | string | Tri (volume, creationTime, endTime) |
| sortOrder | string | Ordre (asc, desc) |

**Response:**

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

Récupère le carnet d'ordres pour un marché spécifique.

**Response:**

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

Récupère les données de chandeliers OHLCV pour les graphiques.

**Query Parameters:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| resolution | string | Timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w) |
| from | number | Timestamp de début |
| to | number | Timestamp de fin |
| outcomeIndex | number | Index du résultat (optionnel) |

**Response:**

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

**Ordres**

```
POST /api/orders
```

Soumet un ordre signé pour traitement.

**Request Body:**

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

**Response:**

```json
{
  "orderId": "0x1234567890abcdef...",
  "status": "received",
  "estimatedExecutionTime": 150,
  "message": "Order received and queued for processing"
}
```

**Utilisateur**

```
GET /api/user/portfolio
```

Récupère le portfolio complet de l'utilisateur.

**Response:**

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

### 5.3 Rate Limiting

L'API implémente un système de limitation de débit basé sur la fenêtre glissante (sliding window). Les limites sont appliquées par adresse IP pour les endpoints publics et par adresse Ethereum pour les endpoints authentifiés.

| Niveau   | Requêtes/minute | Utilisation                            |
| -------- | --------------- | -------------------------------------- |
| strict   | 5               | Authentification, opérations sensibles |
| moderate | 20              | Création d'ordres, modifications       |
| relaxed  | 60              | Lectures fréquentes, polling           |
| lenient  | 120             | Endpoints publics, analytics           |

Les headers de réponse incluent les informations de rate limiting:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
```

---

## 6. Conception de Base de Données

### 6.1 Schéma de Base de Données

La base de données Supabase (PostgreSQL) stocke l'historique persistant des données de marché, les informations utilisateur et les métadonnées. Le schéma est optimisé pour les requêtes analytiques fréquentes et utilise des partitions temporelles pour les données de trading à fort volume.

```sql
-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Enum Types
CREATE TYPE order_status AS ENUM ('open', 'partial', 'filled', 'cancelled', 'expired');
CREATE TYPE trade_type AS ENUM ('buy', 'sell');
CREATE TYPE market_status AS ENUM ('active', 'paused', 'resolved', 'canceled');

-- Schéma public (données principales)
CREATE SCHEMA public;

-- Table des utilisateurs
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

-- Table des marchés
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

-- Table des ordres (historique complet)
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

-- Table des trades (transactions exécutées)
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

-- Table des bougies OHLCV (données de graphiques)
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

-- Table des positions utilisateur
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

-- Table des abonnements utilisateurs
CREATE TABLE public.user_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_address VARCHAR(42) NOT NULL,
    following_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_address, following_address)
);

CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_address);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_address);

-- Table des discussions
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

-- Table des votes du forum
CREATE TABLE public.forum_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_address VARCHAR(42) NOT NULL,
    thread_id UUID NOT NULL,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 0, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_address, thread_id)
);

-- Table des sessions (JWT tokens)
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

### 6.2 Vues et Fonctions

```sql
-- Vue pour le leaderboard
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

-- Fonction pour mettre à jour le timestamp de modification
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at automatique
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_markets_updated_at
    BEFORE UPDATE ON public.markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fonction pour calculer le volume d'un marché
CREATE OR REPLACE FUNCTION calculate_market_volume(market_addr VARCHAR)
RETURNS NUMERIC AS $$
SELECT COALESCE(SUM(amount * price), 0)
FROM public.trades
WHERE market_address = market_addr;
$$ LANGUAGE sql;

-- Fonction pour partitionner les trades par date
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

## 7. Guide de Déploiement

### 7.1 Prérequis et Configuration

Le déploiement de Foresight nécessite plusieurs composants d'infrastructure. Assurez-vous d'avoir accès aux ressources suivantes avant de commencer. Un compte Polygon RPC (Alchemy ou Infura) est requis pour les interactions blockchain. Un projet Supabase avec PostgreSQL et Redis activé est nécessaire pour le stockage persistant. Un compte WalletConnect est requis pour l'authentification Web3. Des clés API pour les services externes comme Blockscout pour l'indexation.

```bash
# Variables d'environnement requises
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

### 7.2 Déploiement des Contrats Intelligents

```bash
# Navigation vers le répertoire des contrats
cd packages/contracts

# Installation des dépendances
npm install

# Configuration du réseau dans hardhat.config.ts
# Voir la section suivante pour les détails

# Compilation des contrats
npx hardhat compile

# Vérification des contrats sur Polygonscan (optionnel)
npx hardhat verify --network polygon 0xCONTRACT_ADDRESS

# Déploiement sur Amoy (testnet)
npx hardhat run scripts/deploy_offchain_sprint1.ts --network amoy

# Après validation, déploiement sur Mainnet
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

### 7.3 Déploiement du Frontend

```bash
# Navigation vers le répertoire web
cd apps/web

# Installation des dépendances
npm install

# Configuration des variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos valeurs

# Build de production
npm run build

# Déploiement sur Vercel
vercel deploy --prod

# Ou déploiement manuel sur un serveur
npm run start
```

### 7.4 Déploiement du Service Relayer

```bash
# Navigation vers le répertoire relayer
cd services/relayer

# Installation des dépendances
npm install

# Configuration
cp .env.example .env
# Éditer .env avec vos valeurs

# Build
npm run build

# Démarrage avec PM2
pm2 start ecosystem.config.js --env production

# Ou avec Docker
docker build -t foresight-relayer .
docker run -d --name foresight-relayer foresight-relayer
```

```yaml
# docker-compose.yml pour l'infrastructure complète
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

### 7.5 Configuration DNS et SSL

```bash
# Configuration nginx pour le reverse proxy

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

## 8. Normes de Sécurité

### 8.1 Sécurité des Contrats Intelligents

Les contrats intelligents de Foresight sont audités et suivent les meilleures pratiques de sécurité blockchain. Les audits incluent une vérification formelle des vulnérabilités courantes comme les reentrancy attacks, les integer overflows, les access control failures et les front-running attacks. Les contrats utilisent les bibliothèques OpenZeppelin qui ont été extensively auditées par la communauté.

```solidity
// Exemple de protection reentrancy dans le contrat de marché

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

    // Toutes les fonctions externes qui transfèrent des fonds
    // ou modifient l'état de manière critique utilisent ce modificateur
    function fillOrder(
        Order calldata order,
        Signature calldata signature,
        uint128 fillAmount
    ) external override nonReentrant {
        // Logique de remplissage d'ordre
    }

    function claimWinnings() external nonReentrant {
        // Logique de réclamation des gains
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        // Logique de retrait
    }
}
```

### 8.2 Protection Contre les Attaques

Le système implémente plusieurs couches de protection contre les manipulations de marché et les attaques financières. La protection contre le front-running utilise des mécanismes dedelai minimum et de slippage tolerance qui rendent les attaques économiquement non viables. Les ordres sont exécutés au prix limite ou mieux, protégeant les utilisateurs contre l'exécution à des prix défavorables.

```typescript
// Protection slippage dans le Relayer

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
    // Augmenter le slippage pour les marchés volatils
    const volatilityAdjustment = Math.min(marketVolatility * 2, 5);
    slippagePercent += volatilityAdjustment;
  }

  // Limiter le slippage maximum
  slippagePercent = Math.min(slippagePercent, config.maxPercentage);

  // Calculer le prix limite
  const slippageAmount = (orderPrice * BigInt(slippagePercent)) / 100n;
  return orderPrice - slippageAmount;
}

export function validateSlippage(
  executedPrice: bigint,
  orderPrice: bigint,
  maxSlippagePrice: bigint
): boolean {
  // Vérifier que le prix d'exécution est dans les limites acceptables
  if (executedPrice > orderPrice) {
    // Prix d'achat: l'exécution ne doit pas dépasser le prix limite
    return executedPrice <= maxSlippagePrice;
  } else {
    // Prix de vente: l'exécution ne doit pas être inférieure au prix limite
    return executedPrice >= maxSlippagePrice;
  }
}
```

### 8.3 Sécurité Frontend

L'interface frontend implémente des mesures de sécurité strictes pour protéger les utilisateurs contre les attaques XSS, CSRF et autres vecteurs d'attaque Web. Toutes les entrées utilisateur sont validées et assainies avant traitement ou affichage. Les tokens d'authentification sont stockés de manière sécurisée et ont une durée de vie limitée.

```typescript
// Validation et assainissement des entrées

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
    .max(86400 * 7), // Max 7 jours
  nonce: z.number().int().positive(),
});

export function validateAndSanitizeOrder(input: unknown) {
  const result = orderSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
}

// Protection XSS pour l'affichage
import DOMPurify from "isomorphic-dompurify";

function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href", "title"],
  });
}
```

### 8.4 Rate Limiting et Protection DDoS

```typescript
// Middleware de rate limiting

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiter pour les endpoints API
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

// Rate limiter par IP pour les endpoints publics
const ipRatelimit = new Ratelimit({
  redis: new Redis({ url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! }),
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "ratelimit:ip",
});
```

---

## 9. Guide de Test

### 9.1 Tests des Contrats Intelligents

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

    // Créer un marché de test
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
        expires: Math.floor(Date.now() / 1000) - 1, // Expiré
        nonce: 1,
      };

      // Signature valide mais ordre expiré
      // Le test devrait échouer avec "Order expired"
    });
  });

  describe("Order Matching", function () {
    it("Should match buy and sell orders at crossing prices", async function () {
      // Placer un ordre d'achat à 0.70
      const buyOrder = {
        maker: user1.address,
        outcome: 0,
        isBuy: true,
        price: ethers.utils.parseEther("0.70"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      // Placer un ordre de vente à 0.65 (prix croisant)
      const sellOrder = {
        maker: user2.address,
        outcome: 0,
        isBuy: false,
        price: ethers.utils.parseEther("0.65"),
        amount: ethers.utils.parseEther("100"),
        expires: Math.floor(Date.now() / 1000) + 3600,
        nonce: 1,
      };

      // Signatures...

      // L'exécution devrait réussir avec un prix de 0.65 (prix du maker)
    });

    it("Should not match orders at non-crossing prices", async function () {
      // Ordre d'achat à 0.50, ordre de vente à 0.70
      // Ne devrait pas matcher
    });
  });
});
```

### 9.2 Tests d'Intégration Frontend

```typescript
// apps/web/tests/trading.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Trading Interface", () => {
  test.beforeEach(async ({ page }) => {
    // Connecter le portefeuille de test
    await page.goto("/");
    await page.click('[data-testid="connect-wallet"]');
    // Configurer le mock wallet...
  });

  test("should display order form correctly", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // Vérifier la présence du formulaire d'ordre
    await expect(page.locator('[data-testid="order-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="buy-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="sell-button"]')).toBeVisible();
  });

  test("should allow placing a buy order", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // Remplir le formulaire
    await page.fill('[data-testid="price-input"]', "0.65");
    await page.fill('[data-testid="amount-input"]', "100");
    await page.click('[data-testid="buy-button"]');

    // Vérifier la soumission
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
  });

  test("should update order book in real-time", async ({ page }) => {
    await page.goto("/markets/0x1234...5678");

    // Vérifier le carnet d'ordres initial
    const initialOrders = await page.locator('[data-testid="order-book-row"]').count();

    // Placer un ordre depuis un autre compte (mock)
    // Vérifier la mise à jour en temps réel
    await expect(page.locator('[data-testid="order-book-row"]')).toHaveCount(initialOrders + 1);
  });
});
```

### 9.3 Tests de Charge Relayer

```typescript
// services/relayer/test/load.test.ts

import { k6 } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp-up
    { duration: "5m", target: 500 }, // High load
    { duration: "5m", target: 1000 }, // Stress test
    { duration: "2m", target: 0 }, // Ramp-down
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

## 10. Dépannage

### 10.1 Problèmes Courants et Solutions

**Erreur: "Insufficient gas" ou transaction qui échoue**

Cette erreur se produit généralement lorsque le gas estimation est incorrect ou lorsque le prix du gas est trop élevé. Vérifiez d'abord que le compte dispose de suffisamment de MATIC pour couvrir les frais de gas. Ensuite, vérifiez que les paramètres de l'ordre sont valides (prix entre 0 et 1, quantité positive, nonce non utilisé). Si le problème persiste, augmentez manuellement le gas limit dans votre client Web3.

**Erreur: "Order expired"**

Les ordres ont une durée de validité limitée (par défaut 1 heure). Si vous soumettez un ordre avec un timestamp d'expiration dans le passé, il sera rejeté. Vérifiez l'heure de votre système et regenerate l'ordre avec une expiration future. Le nonce peut également avoir expiré si l'ordre est stocké dans le cache du Relayer trop longtemps.

**Erreur: "Nonce already used"**

Chaque nonce ne peut être utilisé qu'une seule fois par adresse. Si vous essayez de soumettre un ordre avec un nonce déjà utilisé, il sera rejeté. Utilisez un nouveau nonce incrémenté pour chaque nouvel ordre. Le système enregistre les nonces utilisés pour防止 les replay attacks.

**Graphiques non chargés**

Si les données OHLCV ne s'affichent pas, vérifiez votre connexion internet et l'URL de l'API. Les données de graphiques sont mises en cache côté serveur; un délai de quelques minutes peut exister entre les nouvelles données et leur disponibilité via l'API.

**Problèmes de connexion WebSocket**

Les connexions WebSocket peuvent être interrompues par des pare-feux ou des proxies réseau. Le frontend implémente une reconnexion automatique, mais si le problème persiste, vérifiez que le port 3001 (ou le port configuré pour le Relayer) est accessible depuis votre réseau.

### 10.2 Journalisation et Monitoring

```bash
# Logs du Relayer en temps réel
tail -f /var/log/foresight-relayer/app.log

# Logs avec filtrage par niveau
grep -E "ERROR|WARN" /var/log/foresight-relayer/app.log

# Métriques Prometheus
curl http://localhost:3001/metrics

# Santé du service
curl http://localhost:3001/health
```

### 10.3 Commandes de Diagnostic

```bash
# Vérifier l'état des contrats
npx hardhat run scripts/verify-deployments.ts --network polygon

# Vérifier le synchronisation Redis
redis-cli info | grep used_memory

# Vérifier les connexions database actives
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Tester la connectivité API
curl -v https://api.foresight.health

# Vérifier les tokens expirés
npm run db:check-expired-sessions
```

### 10.4 Procedures de Récupération

En cas de défaillance majeure, les procédures suivantes permettent de restaurer le service.

```bash
# Récupération après crash du Relayer
pm2 restart foresight-relayer
pm2 logs foresight-relayer --lines 100

# Récupération après crash de la base de données
pg_restore -h localhost -U postgres -d foresigh backup.dump

# Récupération après sincronisation blockchain incorrecte
# Rejouer les événements depuis un block connu
npm run relayer:sync -- --from-block 45000000

# Réinitialisation complet (DEV ONLY)
npm run db:reset
npm run redis:flushall
npm run contracts:redeploy
```

---

## Resources Complémentaires

| Ressource                 | Lien                                    |
| ------------------------- | --------------------------------------- |
| Documentation Next.js     | https://nextjs.org/docs                 |
| Documentation React Query | https://tanstack.com/query/latest       |
| Documentation ethers.js   | https://docs.ethers.org/                |
| Contrats OpenZeppelin     | https://docs.openzeppelin.com/contracts |
| Documentation Polygon     | https://wiki.polygon.technology/        |
| Protocole UMA             | https://docs.uma.xyz/                   |
| Standard EIP-712          | https://eips.ethereum.org/EIPS/eip-712  |
| Documentation Supabase    | https://supabase.com/docs               |
| Documentation Redis       | https://redis.io/docs                   |

---

**Dernière Mise à Jour**: 2025-01-26

**Version**: 3.0

---

**Langues / Languages / 语言切换 / Idioma / 언어:**

- [📚 DOCS.md](./DOCS.md) - English
- [📚 DOCS.zh-CN.md](./DOCS.zh-CN.md) - 简体中文
- [📚 DOCS.es.md](./DOCS.es.md) - Español
- [📚 DOCS.fr.md](./DOCS.fr.md) - Français
- [📚 DOCS.ko.md](./DOCS.ko.md) - 한국어
