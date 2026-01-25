<p align="center">
  <img src="apps/web/public/images/logo.png" alt="Foresight Logo" width="120" />
</p>

<h1 align="center">🔮 Foresight</h1>

<p align="center">
  <strong>Protocolo de Predicción Descentralizado de Nueva Generación</strong><br/>
  <em>Experiencia Comercial Profesional × Liquidación Descentralizada con Oracle UMA × Arquitectura Nativa Web3</em>
</p>

<p align="center">
  <a href="https://foresight.market">Sitio Web</a> •
  <a href="./DOCS.md">Documentación</a> •
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

## 🌟 ¿Por qué Foresight?

### Arquitectura Central

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Arquitectura Técnica de Foresight                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Interfaz de Usuario (Next.js 15)                                      │
│   ├── Diseño adaptativo, primero móvil                                  │
│   ├── Profundidad del libro de órdenes en tiempo real                   │
│   └── Integración fluida con billeteras Web3                            │
│                     │                                                    │
│                     ▼                                                    │
│   Libro de Órdenes Fuera de Cadena (Servicio Relayer)                   │
│   ├── Órdenes firmadas EIP-712                                          │
│   ├── Motor de emparejamiento de alto rendimiento                       │
│   └── Sincronización de datos en tiempo real con Supabase               │
│                     │                                                    │
│                     ▼                                                    │
│   Capa de Contratos Inteligentes (Polygon)                              │
│   ├── MarketFactory: Fábrica de mercados (actualizable UUPS)            │
│   ├── OffchainBinaryMarket: Plantilla de mercado binario                │
│   ├── OffchainMultiMarket8: Plantilla multi-resultado (hasta 8)         │
│   ├── OutcomeToken1155: Tokens de resultado ERC-1155                    │
│   └── UMAOracleAdapterV2: Adaptador de oracle UMA                       │
│                     │                                                    │
│                     ▼                                                    │
│   Capa de Liquidación (Protocolo UMA)                                   │
│   ├── Mecanismo de oracle optimista                                     │
│   ├── Arbitraje descentralizado de disputas                             │
│   └── Incentivos económicos garantizan la veracidad                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Características del Producto

### 🎯 Mercados de Predicción

- **Mercados Binarios**: Predicciones YES/NO simples e intuitivas
- **Mercados Multi-Resultado**: Eventos complejos con 2-8 opciones
- **Probabilidades en Tiempo Real**: Precio dinámico basado en el libro de órdenes
- **Trading Sin Gas**: Firmas fuera de cadena, liquidación en cadena

### 🤝 Social, Chat y Gamificación

- **Sistema de Seguidores**: Rastrea a los mejores operadores y recibe actualizaciones
- **Tarjetas de Usuario**: Hover para ver tasa de ganancias, PnL y datos profesionales
- **Clasificaciones**: Rankings de ganancias en tiempo real con filtrado multi-dimensional
- **Discusiones en Tiempo Real**: Cada propuesta/evento tiene sala de chat dedicada
- **Propuestas del Foro**: Sujeto + árbol de comentarios + mecanismo de votación

### 💰 Experiencia Comercial Profesional

- **Órdenes Límite**: Control preciso del precio de entrada
- **Órdenes de Mercado**: Ejecución instantánea al mejor precio
- **Gráficos de Profundidad**: Visualizar distribución de órdenes compra/venta
- **Gráficos de Velas**: Análisis de tendencias de precios profesional

### 🔐 Seguridad y Descentralización

- **Oracle UMA**: Verificación descentralizada de resultados
- **Gobernanza Multi-Firma**: 3/5 multisig + Timelock de 24h
- **Protección contra Préstamos Flash**: Límite de transacción por bloque
- **Seguridad de Firmas**: Protección contra maleabilidad ECDSA

### 👛 Soporte de Billeteras

- MetaMask
- Coinbase Wallet
- WalletConnect
- Más billeteras próximamente...

### 🌍 Internacionalización

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇫🇷 Français
- 🇰🇷 한국어
- 🇪🇸 Español

---

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 18+
- npm (recomendado)
- Git

### Instalación y Ejecución

```bash
# Clonar el repositorio
git clone https://github.com/Foresight-builder/Foresight-beta.git
cd Foresight-beta

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con la configuración requerida

# Iniciar Web + Relayer (recomendado)
npm run dev

# Visitar http://localhost:3000
```

---

## 🏗️ Arquitectura del Proyecto

```
Foresight-beta/
├── apps/web/                 # Aplicación frontend Next.js 15
├── packages/contracts/       # Contratos inteligentes Solidity
├── services/relayer/         # Servicio de libro de órdenes
├── infra/supabase/           # Scripts de base de datos
└── scripts/                  # Scripts de despliegue
```

---

## 📊 Especificaciones Técnicas

### Contratos Inteligentes

| Contrato               | Descripción               | Estado de Auditoría |
| ---------------------- | ------------------------- | ------------------- |
| `MarketFactory`        | Mercado actualizable UUPS | 🔄 En Progreso      |
| `OffchainBinaryMarket` | Mercado binario (YES/NO)  | 🔄 En Progreso      |
| `OffchainMultiMarket8` | Multi-resultado (2-8)     | 🔄 En Progreso      |
| `OutcomeToken1155`     | Token ERC-1155            | 🔄 En Progreso      |
| `UMAOracleAdapterV2`   | Integración oracle UMA    | 🔄 En Progreso      |

### Características de Seguridad

- ✅ Protección contra reentrada ReentrancyGuard
- ✅ Protección contra ataques de préstamo flash
- ✅ Límite de tamaño de operación por lotes
- ✅ Protección contra maleabilidad ECDSA
- ✅ Mecanismo de cortocircuito (pausa de emergencia)

### Objetivos de Rendimiento

| Métrica | Objeto  |
| ------- | ------- |
| LCP     | < 2.5s  |
| INP     | < 200ms |
| CLS     | < 0.1   |

---

## 🔗 Contratos Desplegados

### Polygon Amoy Testnet

| Contrato           | Dirección                                    |
| ------------------ | -------------------------------------------- |
| MarketFactory      | `0x0762A2EeFEB20f03ceA60A542FfC8EC85FE8A30`  |
| OutcomeToken1155   | `0x6dA31A9B2e9e58909836DDa3aeA7f824b1725087` |
| UMAOracleAdapterV2 | `0x5e42fce766Ad623cE175002B7b2528411C47cc92` |

---

## 🛣️ Hoja de Ruta

### Fase 1: Infraestructura ✅

- [x] Desarrollo de contratos inteligentes centrales
- [x] Servicio de libro de órdenes fuera de cadena
- [x] Interfaz de trading frontend
- [x] Integración de oracle UMA

### Fase 2: Seguridad ✅

- [x] Sistema de gobernanza multi-firma
- [x] Mecanismo Timelock
- [x] Preparación de auditoría de seguridad

### Fase 3: Funcionalidad ✅

- [x] Funciones sociales mejoradas
- [x] Sistema de Flags gamificado
- [x] Clasificaciones multi-dimensionales

### Fase 4: Expansión del Ecosistema 🔄

- [ ] App Móvil
- [ ] API Abierta
- [ ] Despliegue Multi-Cadena
- [ ] Gobernanza DAO

---

## 📚 Navegación de Documentación

| Documento                                  | Descripción               |
| ------------------------------------------ | ------------------------- |
| [README.en.md](./README.en.md)             | Documentación en Inglés   |
| [README.zh-CN.md](./README.zh-CN.md)       | 简体中文文档              |
| [README.es.md](./README.es.md)             | Documentación en Español  |
| [README.fr.md](./README.fr.md)             | Documentation en Français |
| [README.ko.md](./README.ko.md)             | 한국어 문서               |
| [DOCS.md](./DOCS.md)                       | Documentación técnica     |
| [SECURITY.md](./SECURITY.md)               | Política de seguridad     |
| [CHANGELOG.md](./CHANGELOG.md)             | Registro de cambios       |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Código de conducta        |

---

## 🤝 Contribuciones

¡Agradecemos las contribuciones de la comunidad!

```bash
# Fork este repositorio
# Crear rama de característica
git checkout -b feature/amazing-feature

# Commit cambios
git commit -m 'feat(market): add amazing feature'

# Push a la rama
git push origin feature/amazing-feature

# Crear Pull Request
```

---

## 📄 Licencia

Este proyecto está licenciado bajo [MIT License](./LICENSE).

---

## 📞 Contacto

<p align="center">
  <a href="https://foresight.market">🌐 Sitio Web</a> •
  <a href="https://twitter.com/ForesightMarket">🐦 Twitter</a> •
  <a href="https://discord.gg/foresight">💬 Discord</a> •
  <a href="mailto:hello@foresight.market">📧 Email</a>
</p>

---

<p align="center">
  <strong>Construido con ❤️ por el Equipo Foresight</strong><br/>
  <em>Prediciendo el futuro, un mercado a la vez.</em>
</p>
