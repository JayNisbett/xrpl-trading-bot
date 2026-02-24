# Code Review: Improvements for More Trades & Better UI

This document summarizes findings from a full codebase review, with a focus on **redundancy after multi-bot support**, **increasing trade frequency**, and **UI improvements**.

---

## 1. Redundancy (Multi-Bot Migration)

### 1.1 Two Ways to Run Bots

| Path | Entry | Config source | What runs |
|------|--------|----------------|-----------|
| **CLI** | `index.ts` → `XRPLTradingBot` (`bot.ts`) | `.env` only | Sniper, copy, AMM from env; API started with single `userId` |
| **Dashboard** | API `POST /api/instances/start` → `botManager` | `BotConfiguration` (file) | Same sniper/copy/AMM modules |

- **Issue:** When you run from CLI, `getRunningInstances()` is empty even though sniper/copy/AMM are running. When you run from dashboard, instances exist but sniper/copy **ignore** per-bot config and still use **global env** (`config` from `src/config/index.ts`).
- **Recommendation:** Either (a) have CLI start a “default” instance via `botManager` so one source of truth, or (b) document clearly: “CLI = single bot from .env; multi-bot = dashboard only.” Prefer (a) long-term so Overview/Instances always reflect reality.

### 1.2 Sniper & Copy Trading Don’t Use Per-Bot Config

- **botManager** passes `BotConfiguration` when starting but only uses it for *which* modules to start (sniper/copy/AMM) and for **AMM** config.
- **Sniper** and **copyTrading** read only from `config` (env): `config.sniper`, `config.sniperUser`, `config.copyTrading`, etc. So all dashboard-started bots share the same sniper/copy behavior.
- **Recommendation:** Extend sniper and copyTrading to accept an optional per-bot config (e.g. when started by botManager) and use it for intervals, amounts, risk, trader list, etc. Otherwise remove or simplify sniper/copy from `BotConfiguration` and document that they are env-only.

### 1.3 Duplicate `isTokenBlacklisted`

- **Locations:** `src/sniper/evaluator.ts` and `src/copyTrading/executor.ts` (identical logic).
- **Usage:** Sniper imports from evaluator; copyTrading imports from executor.
- **Recommendation:** Move to a single shared util (e.g. `src/utils/tokenUtils.ts`) and import from there in both sniper and copyTrading. **Done in this review** (see below).

### 1.4 Two “Bot” Surfaces in the UI

- **Bots** page uses `GET /api/bots`, which returns a **hardcoded** single “Main Sniper Bot” (see `server.ts` ~248–286). It does **not** use `/api/instances`.
- **Configurations** page uses `/api/configs` and `/api/instances`; start/stop/restart are here.
- **Result:** “Bot Management” (Bots) and “Configurations / Instances” are two different data models. “Create New Bot” on Bots is a stub (“Multi-bot creation coming soon!”).
- **Recommendation:** Unify: either make Bots show **instances** from `/api/instances` and link “Create/configure” to Configurations, or remove Bots and use Configurations as the single place for “bots.” **Suggested change:** Bots page shows running instances + CTA to Configurations to create/start more.

### 1.5 Logging Split

- **Structured logger** (`src/utils/logger.ts`): used by botManager and AMM bot (with `botId`/`botName`).
- **Sniper/copy:** use `console.log`/`console.error` and `broadcastUpdate()` for events; they don’t use the logger.
- **Recommendation:** Use the same logger in sniper and copyTrading (with optional `botId` when run by botManager) so all activity appears in LogPanel/LogViewer and can be filtered by bot.

### 1.6 Noisy / Redundant Logs

- `botManager.getRunningInstances()` does `console.log` on every call; API calls `/api/instances` and `/api/instances/stats` frequently → noisy console.
- **Recommendation:** Remove or gate behind debug; keep API responses as the source of truth.

---

## 2. Making More Trades

### 2.1 Sniper

- **Intervals:** `config.sniper.checkInterval` (default 8000 ms); `config.sniper.maxTokensPerScan` (e.g. 15).
- **Rate limiting:** `sniper/monitor.ts`: `rateLimitedDelay()` with base 200 ms and exponential backoff up to 5 s. One global `consecutiveErrors` can back off all scans after ledger errors.
- **Recommendations:**
  - Reduce `SNIPER_CHECK_INTERVAL` (e.g. 5000–6000 ms) if the node allows.
  - Increase `MAX_TOKENS_PER_SCAN` slightly (e.g. 20–25) for more coverage per cycle.
  - Consider resetting or relaxing backoff more quickly on success so temporary rate limits don’t suppress scanning for too long.

### 2.2 AMM Arbitrage

- **Intervals:** `config.amm.arbitrage.checkInterval` (e.g. 5000 ms).
- **Thresholds:** `minProfitPercent` (config, e.g. 0.5%); `arbitrageExecutor` has hardcoded `minProfitThreshold = 0.5`.
- **Recommendations:**
  - Reduce `AMM_ARBITRAGE_CHECK_INTERVAL` (e.g. 3000 ms) to check more often.
  - Keep min profit configurable only in config and pass it through; remove or align the hardcoded 0.5% in `arbitrageExecutor` so it doesn’t override config.

### 2.3 Copy Trading

- **Interval:** `config.copyTrading.checkInterval` (e.g. 3000 ms).
- **Recommendation:** Slightly lower (e.g. 2000 ms) if you want faster copy reaction, subject to node rate limits.

### 2.4 Position / Balance Checks

- Shared `checkPositionLimit` and `checkSufficientBalance` (safetyChecks) correctly gate trades. No hidden extra throttle found; tuning is via config (intervals, max positions, max amounts).

---

## 3. User Interface Improvements

### 3.1 Unify Bots and Instances

- **Current:** Bots page = legacy single-bot; Configurations = real multi-bot (configs + instances).
- **Change:** Bots page should list **running instances** from `/api/instances` (and optionally stopped), with each card linking to Bot Detail. Add clear CTA: “Create & start bots in Configurations.”
- **Sidebar:** Consider renaming “Configurations” to “Configurations & Bots” or “Bot Configs” and making “Bots” a view of “Running Bots” (instances) that deep-links into the same config/instance system.

### 3.2 API Base URL

- **Current:** Dashboard uses hardcoded `http://localhost:3000` (and `3001` for open) in `App.tsx`, `Bots.tsx`, `BotConfigs.tsx`, etc.
- **Recommendation:** Single `VITE_API_URL` (or similar) in dashboard `.env` and use it for all API and socket URLs so dev/prod and different ports are easy.

### 3.3 Overview and Per-Instance Data

- **Current:** Overview uses `/api/status`, `/api/positions`, etc., all keyed by a single global `userId` set when the API starts. No per-instance breakdown.
- **Recommendation:** When you have multiple instances, add an Overview section or dropdown for “per-instance” summary (e.g. which instance did arbitrage/LP last), and optionally an API like `GET /api/instances/:id/summary` for that instance.

### 3.4 Create New Bot Flow

- **Current:** “Create New Bot” on Bots page is a stub modal that shows a toast.
- **Recommendation:** Replace with a redirect or in-page link to Configurations with “Create new configuration” pre-focused, or a short message: “Go to Configurations to create and start a new bot.”

---

## 4. Summary of Recommended Code Changes

| Priority | Change | Impact |
|----------|--------|--------|
| High | Centralize `isTokenBlacklisted` in one util | Less duplication, single place to fix |
| High | Bots page: show instances from `/api/instances`, link to Configurations | Clear UX, one source of truth for “what’s running” |
| High | Remove or reduce `console.log` in `getRunningInstances()` / API | Cleaner logs |
| Medium | Sniper/copy use structured logger with optional botId | Consistent logs, filterable by bot |
| Medium | Env-based API URL in dashboard | Easier deployment and ports |
| Medium | CLI registers default instance with botManager when starting | Single source of truth for “running” state |
| Lower | Sniper/copy accept per-bot config when started by botManager | True per-bot behavior for dashboard-started bots |
| Lower | Tune intervals (sniper, arbitrage, copy) and backoff in monitor | More trades if node allows |

The following concrete changes were made in this pass:

1. **Shared `isTokenBlacklisted`** in `src/utils/tokenUtils.ts`; sniper (via evaluator re-export) and copyTrading (executor) updated to use it.
2. **Bots page** now fetches and displays instances from `/api/instances`, with a CTA to Configurations to create/start bots. Uses `VITE_API_URL` when set for API base URL.
3. **botManager** no longer logs to console on every `getRunningInstances()` call (removed noisy `console.log`).

You can apply the rest of the recommendations (sniper/copy per-bot config, unified logger, CLI registering default instance, tuning intervals) in follow-up work.
