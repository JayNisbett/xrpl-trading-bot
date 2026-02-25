# Platform Requirements Audit

This document compares the **Platform Summary** (XRPL Autonomous Trading & Agent Orchestration System) against the current codebase and lists **missing functionality**, **redundancies**, and **recommendations**.

---

## 1. Summary: What Matches the Requirements

| Domain | Requirement | Status |
|--------|-------------|--------|
| **Strategy execution** | Sniper: discovery, evaluation, buy, position tracking, safety, LLM gating | ✅ Implemented |
| | Copy trading: monitoring, replication, amount modes, dedupe/checkpoint, loop locks, LLM guards | ✅ Implemented |
| | AMM: arbitrage scan/execution, pool discovery/ranking, liquidity logic, risk limits, LLM policy for **arbitrage** | ⚠️ Arbitrage only (see gaps) |
| | Profit management: take-profit/stop-loss, tx logging, dashboard broadcast, wallet-provider aware | ✅ Implemented |
| **Risk & safety** | Balance/reserve checks, position limits, loop locking, degraded-mode handling | ✅ Implemented |
| | Slippage/liquidity: config-driven (defaultSlippage, minLiquidity in evaluator/config) | ✅ Present |
| | LLM: allowed strategies, max position size, max trades/hour, allocatable XRP, status lockout | ✅ In guards |
| **XRPL connectivity** | Persistent client, endpoint fallback, reconnect with backoff, TLS/rate-limit error handling | ✅ Implemented |
| **Bot orchestration** | start/stop/restart, status lifecycle, instance stats, shared module coordination | ✅ Implemented |
| **Configuration** | CRUD, presets (ensureOptimizedPresetConfigs), default from .env, restore enabled on boot | ✅ Implemented |
| **API + WebSocket** | REST (configs, instances, status, settings, transactions), real-time events | ✅ Implemented |
| **LLM layer** | Create/list agents, spawn children with policy/capital, wallet binding, start/stop config per agent, instance health, MCP account context | ✅ Implemented |
| **Policy model** | riskTier, maxDailyLossXrp, maxPositionSizeXrp, maxTradesPerHour, allowedStrategies, autoSpawn, maxChildren, minSpawnCapitalXrp | ✅ In types/manager |
| **Capital controls** | Global max agents, global max allocated XRP, wallet uniqueness, parent reserved capital | ✅ In manager |
| **Wallet model** | Seed by userId (file-backed), default fallback, API bind seed + verify wallet match | ✅ Implemented |
| **Frontend** | LLM Agent Control Center, create-agent flow, per-agent seed bind + config launch, instance health table, system health pills (API/WS/MCP), route code-splitting | ✅ Implemented |
| **Data persistence** | data/state.json, data/bot-configs/*.json, data/llm-agents.json, data/llm-wallet-seeds.json | ✅ Present |
| **MCP** | Server/account context retrieval; policy enforced in TS backend | ✅ As designed |

---

## 2. Missing or Incomplete Functionality

### 2.1 LLM Policy: Max Daily Loss Not Enforced

- **Requirement:** Policy includes `maxDailyLossXrp` and LLM guardrails should enforce it.
- **Current:** `src/llmCapital/guards.ts` checks status, allowed strategies, max position size, allocatable XRP, and max trades per hour. It does **not** track or enforce daily P&L vs `maxDailyLossXrp`.
- **Gap:** No daily loss tracking; no block when an agent’s realized daily loss exceeds `maxDailyLossXrp`.
- **Recommendation:** In `guards.ts` (or a small daily P&L module):
  - Track per-agent daily realized P&L (e.g. from trade log or a dedicated store).
  - In `canExecuteXrpTrade`, if the agent has a `maxDailyLossXrp` and today’s realized loss already exceeds it, return `{ allowed: false, reason: '...' }`.

### 2.2 LLM Policy: Risk Tier Unused

- **Requirement:** Policy model includes `riskTier` ('low' | 'medium' | 'high').
- **Current:** Stored in agent policy and shown in UI; not used in guards or execution logic.
- **Gap:** Risk tier does not affect behavior (e.g. tighter limits or different thresholds).
- **Recommendation:** Either (a) document it as “informational only” or (b) use it in guards/strategy (e.g. scale max position size or daily loss by tier).

### 2.3 AMM Liquidity Provision: No LLM Guard

- **Requirement:** “LLM policy checks before arbitrage execution” and risk-constrained position entry.
- **Current:** Arbitrage path in `ammBot.ts` calls `canExecuteXrpTrade(this.userId, 'amm', opp.tradeAmount)` and `recordExecutedTrade`. `enterLiquidityPosition` does **not** call the LLM guard before depositing XRP.
- **Gap:** LP entry can spend XRP without checking allowed strategies, max position size, or trades/hour for LLM-managed agents.
- **Recommendation:** Before depositing in `enterLiquidityPosition`, call `canExecuteXrpTrade(this.userId, 'amm', depositAmount)` and, on success, `recordExecutedTrade(this.userId, 'amm', depositAmount)` (or equivalent for LP).

### 2.4 API: Legacy Endpoints Are Single-User Only

- **Requirement:** Per-agent wallet and execution; dashboard and API should support multi-agent/multi-user where applicable.
- **Current:** Endpoints such as `/api/status`, `/api/positions`, `/api/performance`, `/api/transactions`, `/api/history`, controls (sniper/copytrading), and periodic dashboard updates use `getWallet()` and a single global `userId`. They do not accept a `userId` or agent context.
- **Gap:** Main dashboard and these endpoints always reflect one wallet/user. Agent-specific data is only via `/api/llm-agents/:id/instances` and MCP account endpoint.
- **Recommendation:** Introduce optional `userId` (or agent id) query/context for read endpoints and, where it makes sense, use `getWalletForUser(userId)` so the dashboard can show per-agent status/positions/transactions when an agent is selected.

### 2.5 Restore on Boot: Single User Only

- **Requirement:** “Optional restore of enabled configs on boot.”
- **Current:** In `src/bot.ts`, when `AUTO_RESTORE_ENABLED_BOTS === 'true'`, only configs with `enabled && id !== 'default'` are restored, and they are all started for the same `this.userId`.
- **Gap:** No restore of “enabled configs per agent” (e.g. each agent’s previously running configs after restart).
- **Recommendation:** If product intent is “per-agent restore,” persist which configs were running per agent and, on boot, call `botManager.startBot(config, agentUserId)` for each such pair (respecting agent status and capital).

### 2.6 Settings Persistence

- **Requirement:** Settings and preferences for the operator.
- **Current:** `GET /api/settings` returns a hardcoded object; `PUT /api/settings` does not persist (TODO in server).
- **Gap:** Settings are not saved or loaded from storage.
- **Recommendation:** Add a small settings store (e.g. `data/settings.json` or existing state file) and read/write it in the settings endpoints.

### 2.7 Wallet / Profit Collection Stubs

- **Current:** `POST /api/wallets/collect-profits` and `POST /api/wallets/:walletId/primary` are stubbed (TODO). `DELETE /api/bots/:botId` is also TODO.
- **Gap:** No real implementation for profit collection or primary wallet persistence; bot deletion is placeholder.
- **Recommendation:** Implement or remove these endpoints; if kept, document as “reserved for future use.”

### 2.8 Full Agent Update (Optional)

- **Requirement:** “Create/list/**update** LLM agents.”
- **Current:** Only status update exists: `updateAgentStatus(agentId, status)`. No API to update name, policy, or wallet.
- **Gap:** Full “update agent” (name, policy, walletAddress, etc.) is missing.
- **Recommendation:** Add `PATCH` or `PUT /api/llm-agents/:id` and a manager method to update non-status fields (with validation and capital/wallet uniqueness checks as in create).

---

## 3. Redundancies and Inconsistencies

### 3.1 Frontend: Hardcoded API Base vs Centralized API

- **Current:** `dashboard/src/lib/api.ts` exports `API_BASE` and `apiFetch`. `App.tsx` and `Bots.tsx` define their own `API_BASE`. Several components still use `http://localhost:3000` directly: `AMMPools.tsx`, `BotPnLChart.tsx`, `LogPanel.tsx`, `BotDetail.tsx`, `Wallets.tsx`, `Settings.tsx`, `PositionsList.tsx`, `LogViewer.tsx`.
- **Redundancy:** Duplicate API base definition and mixed use of hardcoded URL vs shared helper.
- **Recommendation:** Use a single source of truth: import `API_BASE` and `apiFetch` from `lib/api.ts` everywhere and replace all `http://localhost:3000` and local `API_BASE` definitions with it.

### 3.2 Backend: Two Wallet Paths

- **Current:** `getWallet()` in `src/xrpl/wallet.ts` returns the global config wallet. `getWalletForUser(userId)` in `src/xrpl/walletProvider.ts` returns the wallet for a user/agent. Strategy code and botManager use `getWalletForUser(userId)`; many API handlers use `getWallet()` and a single `userId`.
- **Redundancy:** Two patterns for “which wallet”: one global, one per-user. Legacy API is tied to the global one.
- **Recommendation:** Treat the default dashboard as “default user” and have legacy endpoints use `getWalletForUser(userId)` with the server’s default `userId` so that, when you add optional userId to endpoints, the same path works. Eventually deprecate or narrow `getWallet()` to CLI/bootstrap only if desired.

### 3.3 Bot Config Default ID

- **Current:** `createDefaultConfig(name)` returns a config with `id: ''`. `getOrCreateDefaultConfig` then assigns `id: 'default'` when creating from env. Presets use explicit ids.
- **Redundancy:** Empty `id` in default template is easy to misuse if someone uses that object without going through `getOrCreateDefaultConfig`.
- **Recommendation:** Low priority; consider having `createDefaultConfig` accept an optional `id` or document that the default config must be created via `getOrCreateDefaultConfig` only.

---

## 4. Quick Reference: Files to Change

| Gap / Redundancy | Suggested files |
|------------------|------------------|
| Max daily loss enforcement | `src/llmCapital/guards.ts`, optional small `dailyPnl.ts` or use trade log |
| Risk tier usage | `src/llmCapital/guards.ts` (or doc as informational) |
| AMM LP LLM guard | `src/amm/ammBot.ts` (`enterLiquidityPosition`) |
| API multi-user/context | `src/api/server.ts` (status, positions, performance, transactions, history, controls) |
| Restore per agent on boot | `src/bot.ts`, optional persistence of “last running config per agent” |
| Settings persistence | `src/api/server.ts`, new `data/settings.json` or state module |
| Frontend API base | `dashboard/src/pages/AMMPools.tsx`, `BotPnLChart.tsx`, `LogPanel.tsx`, `BotDetail.tsx`, `Wallets.tsx`, `Settings.tsx`, `PositionsList.tsx`, `LogViewer.tsx`, `App.tsx`, `Bots.tsx` |
| Backend wallet path | `src/api/server.ts`: replace `getWallet()` with `getWalletForUser(userId)` where appropriate |

---

## 5. Conclusion

The platform is largely aligned with the stated architecture and feature set. The main gaps are:

1. **LLM:** Enforce **max daily loss** and optionally use **risk tier**; add **LLM guard for AMM liquidity provision**.
2. **API/Dashboard:** Support **multi-user/agent context** for legacy endpoints and **centralize API base** in the frontend.
3. **Ops:** **Persist settings**, and optionally **restore enabled configs per agent** on boot.
4. **Cleanup:** Replace **hardcoded localhost** with `lib/api` and unify **wallet resolution** in the API around `getWalletForUser(userId)`.

Fixing the items in Sections 2 and 3 will bring the implementation in line with the platform summary and remove redundancy.
