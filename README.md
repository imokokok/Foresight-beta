# Foresight Monorepo — Structure & Dev Guide

This repo has been upgraded to a Monorepo with npm workspaces.

Top-level layout:
- `apps/web` — Next.js dApp (pages, API routes, components)
- `packages/contracts` — Hardhat contracts and tests
- `services/relayer` — Optional backend relayer (Express + Ethers)
- `infra/supabase` — DB migrations and maintenance scripts
- `packages/shared` — Optional shared types/utils/ABI (future)

Root scripts:
- `npm run ws:dev` — start `apps/web`
- `npm run ws:build` — build `apps/web`
- `npm run ws:contracts:compile` — compile `packages/contracts`
- `npm run ws:relayer:start` — start `services/relayer`
  - Relayer moved from `relayer/` to `services/relayer/`
 - `npm run ws:dev:all` — start web and relayer together
   - Relayer reads `PORT` from root `.env`/`.env.local` via dotenv-cli
   - Web stays on `http://localhost:3000`; Relayer default `http://localhost:3001`

Notes:
- Build artifacts (Hardhat `artifacts/`, `.next/`, etc.) should not be committed.
- Next.js envs now live in `apps/web/.env.local`.
- Supabase maintenance scripts live in `infra/supabase/scripts` and can be run via `npm -w infra/supabase run <script>`.
 - Root `.env` provides relayer `PORT` and optional shared variables; prefer `.env.local` for sensitive overrides.

## Environment Variables (Root)

- See `.env.example` for a starter.
- Recommended keys:
  - `PORT` — relayer port used by `ws:dev:all` (default `3001`).
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — frontend Supabase.
  - `SUPABASE_SERVICE_KEY` — server-side Supabase for `/api/*` writes.
- Supabase infra scripts (`infra/supabase/scripts/*`) load `.env` then `.env.local` with override precedence and also support workspace-local files.

---

# Foresight Frontend — Contracts & Deployment Guide

This repo includes Hardhat contracts and scripts to deploy a prediction market factory and templates:
- `MarketFactory` for market creation
- `BinaryMarket` template
- `MultiOutcomeMarket1155` template
- Shared `OutcomeToken1155` for multi-outcome markets

Use the unified script `scripts/deploy_markets.ts` to deploy or reuse the factory, register templates, create binary/multi markets, and grant `MINTER_ROLE` automatically.

## Prerequisites
- Node.js: Prefer `v18` or `v20` LTS. Hardhat warns on `v23.x` but compilation still works.
- Install deps: `npm install`
- Configure `.env` with deployer key and RPC endpoints.

## Environment Variables
The scripts read from `.env` and support sensible fallbacks.

- `PRIVATE_KEY`: Deployer wallet private key (hex with `0x` prefix).
- `HARDHAT_NETWORK`: Target network, e.g. `sepolia`, `amoy`, `polygon`, `localhost`.
- `MARKET_FACTORY_ADDRESS`: Existing factory address to reuse. If missing, the script deploys a new factory.
- `COLLATERAL_TOKEN_ADDRESS`: Preferred collateral token address (e.g., USDT). If missing, the script falls back by chain:
  - `USDT_ADDRESS_POLYGON` or `NEXT_PUBLIC_USDT_ADDRESS_POLYGON` when `chainId=137`.
  - `USDT_ADDRESS_AMOY` or `NEXT_PUBLIC_USDT_ADDRESS_AMOY` when `chainId=80002`.
  - `USDT_ADDRESS_SEPOLIA` or `NEXT_PUBLIC_USDT_ADDRESS_SEPOLIA` when `chainId=11155111`.
  - `USDT_ADDRESS_LOCALHOST` or `NEXT_PUBLIC_USDT_ADDRESS_LOCALHOST` when local.
  - Otherwise `USDT_ADDRESS` or `NEXT_PUBLIC_USDT_ADDRESS`.
- `ORACLE_ADDRESS`: Market oracle address. If omitted, defaults to deployer address.
- `MARKET_FEE_BPS`: Market fee in basis points, default `30` (0.30%).
- `MARKET_RESOLUTION_TS`: Resolution timestamp (unix seconds). Default is `now + 7 days`.
- `OUTCOME_COUNT`: Multi-outcome market outcome count, default `3`.
- `OUTCOME1155_ADDRESS`: Existing shared `OutcomeToken1155` address. If missing, the script deploys one.
- Optional RPC keys (per your setup): `ALCHEMY_API_KEY`, `INFURA_API_KEY`, etc.
- Optional verification: `ETHERSCAN_API_KEY`.

Example `.env` (values for illustration only):
```
PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
HARDHAT_NETWORK=amoy
USDT_ADDRESS_AMOY=0x0000000000000000000000000000000000000000
ORACLE_ADDRESS=0x1111111111111111111111111111111111111111
MARKET_FEE_BPS=30
# MARKET_RESOLUTION_TS=1738000000
OUTCOME_COUNT=3
```

## Scripts

### Unified deployment — `scripts/deploy_markets.ts`
- Modes: `--type=binary | multi | both` or `MARKET_TYPE` env (defaults to `both`).
- Flow:
  1) Ensure or deploy `MarketFactory`
  2) Register templates if missing: `BINARY` and `MULTI` (ids are `keccak256(toUtf8Bytes(...))`)
  3) Create market(s)
  4) For multi: ensure `OutcomeToken1155`, then grant `MINTER_ROLE` to created market

Run examples:
- Both markets: `npx hardhat run scripts/deploy_markets.ts --network <network>`
- Binary only: `npx hardhat run scripts/deploy_markets.ts --type=binary --network <network>`
- Multi only: `npx hardhat run scripts/deploy_markets.ts --type=multi --network <network>`
- With env: `MARKET_TYPE=multi npx hardhat run scripts/deploy_markets.ts --network <network>`

### Binary-only — `scripts/deploy_factory_and_binary.ts`
- Deploy or reuse factory, register `BINARY` template, create a binary market.
- Prefer using the unified script for consistency unless you need binary-only.

Run example:
- `npx hardhat run scripts/deploy_factory_and_binary.ts --network <network>`

### Multi-outcome-only — `scripts/deploy_multi1155.ts`
- Deploy or reuse `OutcomeToken1155`, register `MULTI` template, create a multi-outcome market, grant `MINTER_ROLE`.
- Prefer using the unified script for consistency unless you need multi-only.

Run example:
- `npx hardhat run scripts/deploy_multi1155.ts --network <network>`

## Compile
- `npx hardhat compile`

## Notes & Troubleshooting
- Node warning: Hardhat warns on Node `v23.x`; recommended to use `v18` or `v20`.
- Template registration: If a template is already registered, the script logs the existing implementation and skips re-registration.
- Multi market data encoding: The script encodes `data` with `AbiCoder.encode(["address","uint256"],[outcome1155Address,outcomeCount])`.
- Collateral selection: If `COLLATERAL_TOKEN_ADDRESS` is missing, the script attempts chain-specific fallbacks as listed above.
- Role granting: After multi-market creation, `OutcomeToken1155.grantMinter(<market>)` is called if the market lacks `MINTER_ROLE`.

## Quick Start
1) Fill `.env` with `PRIVATE_KEY`, RPC/network, and collateral address.
2) `npm install`
3) `npx hardhat compile`
4) `npx hardhat run scripts/deploy_markets.ts --network <network>`

---
This guide covers the deployment flow for both binary and multi-outcome markets. For questions or improvements, please open an issue or PR.