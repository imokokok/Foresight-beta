<p align="center">
  <img src="apps/web/public/images/logo.png" alt="Foresight Logo" width="120" />
</p>

<h1 align="center">🔮 Foresight</h1>

<p align="center">
  <strong>Protocole de Marché de Prédiction Décentralisé de Nouvelle Génération</strong><br/>
  <em>Expérience Commerciale Professionnelle × Règlement Décentralisé Oracle UMA × Architecture Native Web3</em>
</p>

<p align="center">
  <a href="https://foresight.market">Site Web</a> •
  <a href="./DOCS.md">Documentation</a> •
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

## 🌟 Pourquoi Foresight ?

### Architecture Centrale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Architecture Technique de Foresight                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Interface Utilisateur (Next.js 15)                                    │
│   ├── Design responsive, mobile-first                                   │
│   ├── Profondeur du carnet d'ordres en temps réel                       │
│   └── Intégration transparente des portefeuilles Web3                   │
│                     │                                                    │
│                     ▼                                                    │
│   Carnet d'Ordres Hors Chaîne (Service Relayer)                         │
│   ├── Ordres signés EIP-712                                             │
│   ├── Moteur d'appariement haute performance                            │
│   └── Synchronisation données temps réel Supabase                       │
│                     │                                                    │
│                     ▼                                                    │
│   Couche Contrats Intelligents (Polygon)                                │
│   ├── MarketFactory: Usine de marchés (UUPS évolutive)                  │
│   ├── OffchainBinaryMarket: Modèle marché binaire                       │
│   ├── OffchainMultiMarket8: Modèle multi-résultat (jusqu'à 8)          │
│   ├── OutcomeToken1155: Jetons résultat ERC-1155                        │
│   └── UMAOracleAdapterV2: Adaptateur oracle UMA                         │
│                     │                                                    │
│                     ▼                                                    │
│   Couche de Règlement (Protocole UMA)                                   │
│   ├── Mécanisme oracle optimiste                                        │
│   ├── Arbitrage décentralisé des disputes                               │
│   └── Incentives économiques garantissent la véracité                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Fonctionnalités du Produit

### 🎯 Marchés de Prédiction

- **Marchés Binaires**: Prédictions YES/NO simples et intuitives
- **Marchés Multi-Résultats**: Événements complexes de 2-8 options
- **Cotes en Temps Réel**: Prix dynamique basé sur le carnet d'ordres
- **Trading Sans Gas**: Signatures hors chaîne, règlement sur chaîne

### 🤝 Social, Chat et Gamification

- **Système de Suivi**: Suivre les meilleurs traders et recevoir des mises à jour
- **Cartes Utilisateur**: Survol pour voir le taux de victoire, PnL et données
- **Tableaux de Classement**: Classements de bénéfices en temps réel multi-dimensionnels

### 💰 Expérience Commerciale Professionnelle

- **Ordres Limites**: Contrôle précis du prix d'entrée
- **Ordres de Marché**: Exécution instantanée au meilleur prix
- **Graphiques de Profondeur**: Visualiser la distribution des ordres
- **Graphiques en Bougies**: Analyse des tendances de prix professionnelle

### 🔐 Sécurité et Décentralisation

- **Oracle UMA**: Vérification décentralisée des résultats
- **Gouvernance Multi-Sig**: 3/5 multisig + Timelock 24h
- **Protection Prêt Flash**: Limite de transaction par bloc
- **Sécurité des Signatures**: Protection maleabilité ECDSA

### 👛 Support des Portefeuilles

- MetaMask
- Coinbase Wallet
- WalletConnect
- Plus de portefeuilles à venir...

### 🌍 Internationalisation

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇫🇷 Français
- 🇰🇷 한국어
- 🇪🇸 Español

---

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- npm (recommandé)
- Git

### Installation et Exécution

```bash
# Cloner le dépôt
git clone https://github.com/Foresight-builder/Foresight-beta.git
cd Foresight-beta

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local

# Démarrer Web + Relayer (recommandé)
npm run dev

# Visiter http://localhost:3000
```

---

## 🏗️ Architecture du Projet

```
Foresight-beta/
├── apps/web/                 # Application frontend Next.js 15
├── packages/contracts/       # Contrats intelligents Solidity
├── services/relayer/         # Service carnet d'ordres
├── infra/supabase/           # Scripts de base de données
└── scripts/                  # Scripts de déploiement
```

---

## 📊 Spécifications Techniques

### Contrats Intelligents

| Contrat                | Description             | Statut d'Audit |
| ---------------------- | ----------------------- | -------------- |
| `MarketFactory`        | Marché évolutif UUPS    | 🔄 En Cours    |
| `OffchainBinaryMarket` | Marché binaire (YES/NO) | 🔄 En Cours    |
| `OffchainMultiMarket8` | Multi-résultat (2-8)    | 🔄 En Cours    |
| `OutcomeToken1155`     | Jeton ERC-1155          | 🔄 En Cours    |
| `UMAOracleAdapterV2`   | Intégration oracle UMA  | 🔄 En Cours    |

### Caractéristiques de Sécurité

- ✅ Protection reentrancy ReentrancyGuard
- ✅ Protection contre les attaques de prêt flash
- ✅ Limite de taille d'opération par lots
- ✅ Protection maleabilité ECDSA
- ✅ Mécanisme de coupe-circuit (pause d'urgence)

### Objectifs de Performance

| Métrique | Cible   |
| -------- | ------- |
| LCP      | < 2.5s  |
| INP      | < 200ms |
| CLS      | < 0.1   |

---

## 🔗 Contratos Déployés

### Polygon Amoy Testnet

| Contrat            | Adresse                                      |
| ------------------ | -------------------------------------------- |
| MarketFactory      | `0x0762A2EeFEB20f03ceA60A542FfC8EC85FE8A30`  |
| OutcomeToken1155   | `0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087` |
| UMAOracleAdapterV2 | `0x5e42fce766Ad623cE175002B7b2528411C47cc92` |

---

## 🛣️ Feuille de Route

### Phase 1 : Infrastructure ✅

- [x] Développement des contrats intelligents centraux
- [x] Service carnet d'ordres hors chaîne
- [x] Interface de trading frontend
- [x] Intégration oracle UMA

### Phase 2 : Sécurité ✅

- [x] Système de gouvernance multi-signature
- [x] Mécanisme Timelock
- [x] Préparation à l'audit de sécurité

### Phase 3 : Fonctionnalités ✅

- [x] Fonctionnalités sociales améliorées
- [x] Système de Flags gamifié
- [x] Tableaux de classement multi-dimensionnels

### Phase 4 : Expansion de l'Écosystème 🔄

- [ ] Application Mobile
- [ ] Plateforme API Ouverte
- [ ] Déploiement Multi-Chaîne
- [ ] Gouvernance DAO

---

## 📚 Navigation de Documentation

| Document                                   | Description               |
| ------------------------------------------ | ------------------------- |
| [README.en.md](./README.en.md)             | Documentation Anglais     |
| [README.zh-CN.md](./README.zh-CN.md)       | 简体中文文档              |
| [README.es.md](./README.es.md)             | Documentación Español     |
| [README.fr.md](./README.fr.md)             | Documentation Français    |
| [README.ko.md](./README.ko.md)             | 한국어 문서               |
| [DOCS.md](./DOCS.md)                       | Documentation technique   |
| [SECURITY.md](./SECURITY.md)               | Politique de sécurité     |
| [CHANGELOG.md](./CHANGELOG.md)             | Journal des modifications |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Code de conduite          |

---

## 🤝 Contributions

Nous accueillons les contributions de la communauté !

```bash
# Fork ce dépôt
# Créer une branche de fonctionnalité
git checkout -b feature/amazing-feature

# Commit les changements
git commit -m 'feat(market): add amazing feature'

# Push vers la branche
git push origin feature/amazing-feature

# Créer une Pull Request
```

---

## 📄 Licence

Ce projet est sous licence [MIT License](./LICENSE).

---

## 📞 Contact

<p align="center">
  <a href="https://foresight.market">🌐 Site Web</a> •
  <a href="https://twitter.com/ForesightMarket">🐦 Twitter</a> •
  <a href="https://discord.gg/foresight">💬 Discord</a> •
  <a href="mailto:hello@foresight.market">📧 Email</a>
</p>

---

<p align="center">
  <strong>Construit avec ❤️ par l'Équipe Foresight</strong><br/>
  <em>Prédire l'avenir, un marché à la fois.</em>
</p>
