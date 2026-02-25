# XRPL Autonomous Trading & Agent Orchestration Platform

A **multi-strategy XRPL trading platform** with an execution engine for AMM, sniper, and copy-trading strategies, a modern operations dashboard, and an **LLM capital management layer** where autonomous agents manage allocated XRP under strict risk controls.

## Architecture

The system is a **control plane + execution plane**:

- **Control plane:** Configs, bots, agents, monitoring, policy, UI/API.
- **Execution plane:** Strategy loops, wallet-bound trade execution, risk gates, XRPL connectivity.

All execution and capital movement go through the backend; agents never bypass guards or touch wallets directly.

## Features by domain

### Strategy execution

- **Sniper:** Token discovery and evaluation, controlled buy execution, position tracking, safety checks, LLM policy gating.
- **Copy trading:** Trader monitoring, trade replication, amount modes (fixed/percentage), dedupe and persisted checkpoints, loop overlap protection, LLM guards.
- **AMM bot:** Arbitrage scan and execution, pool discovery (static and dynamic), liquidity provision, risk-constrained entry, safety checks and LLM policy before arbitrage and LP.
- **Profit management:** Take-profit / stop-loss, transaction logging, dashboard broadcast, wallet-provider aware.

### Risk and safety

- Account balance and reserve checks, position limits, slippage and liquidity thresholds.
- Strategy-level loop locking to prevent overlap.
- Runtime degraded-mode reporting (instance runs with partial module failures).
- LLM policy guardrails: allowed strategies, max position size, max trades per hour, allocatable XRP limits, max daily loss, status-based execution lockout.

### XRPL connectivity

- Persistent client, endpoint fallback, reconnect with backoff and thrashing protection, clearer TLS and rate-limit error handling.

### Multi-agent / LLM layer

- Create, list, update LLM agents; spawn child agents with policy and capital constraints.
- Bind wallet seeds per agent; start/stop bot configs per agent; instance health and MCP account context.
- Policy: risk tier, max daily loss, max position size, max trades per hour, allowed strategies, auto-spawn, max children, min spawn capital.
- Capital controls: global max agents, global max allocated XRP, wallet uniqueness, parent reserved capital.

### Wallet model

- Wallet provider: seed lookup by `userId` (file-backed), default fallback, API to bind seed to agent and verify wallet address.

### Data persistence

- `data/state.json` – users/state
- `data/bot-configs/*.json` – bot configs
- `data/llm-agents.json` – LLM agent registry
- `data/llm-wallet-seeds.json` – agent seed mapping
- `data/settings.json` – operator settings
- `data/copy-checkpoints.json` – copy-trading ledger checkpoints
- `data/instance-restore.json` – per-user running configs (for restore on boot)

## How to run

1. **Environment:** Copy `.env.example` to `.env` and set `WALLET_SEED`, XRPL server, and any optional vars (e.g. `AUTO_RESTORE_ENABLED_BOTS`, `AUTO_START_DEFAULT_BOT`, `LLM_MAX_AGENTS`, `LLM_MAX_TOTAL_ALLOCATED_XRP`).
2. **Backend:** `npm run start` (or `npm run build` then `node dist/bot.js`). API runs on port 3000.
3. **Dashboard:** `cd dashboard && npm run dev` (Vite on port 3001). Use the dashboard to manage configs, instances, LLM agents, and wallets.

See [docs/PLATFORM_AUDIT.md](docs/PLATFORM_AUDIT.md) for a requirements audit and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for Mermaid diagrams.
