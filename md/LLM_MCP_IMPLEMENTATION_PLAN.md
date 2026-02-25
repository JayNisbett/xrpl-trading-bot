# XRPL MCP + Multi-LLM Capital Manager Implementation Plan

## Objective
Build a production-safe framework where multiple LLM agents each control an assigned XRPL wallet and operate within strict constraints to grow value in XRP terms.

---

## Architecture

1. **Execution Layer (existing bot)**
   - Sniper / AMM / copy trading engines execute trades.
   - Existing risk checks remain hard gates.

2. **Decision Layer (new LLM Capital Manager)**
   - Agent registry with per-agent wallet + capital policy.
   - Each agent can propose actions only within policy limits.
   - Child-agent spawning allowed only under parent policy + budget constraints.

3. **XRPL Data/Action Adapter (MCP)**
   - Integrate `xrpl-mcp-service` as a tool endpoint (`XRPL_MCP_URL`).
   - LLM agents query ledger/account/AMM state through MCP.
   - Signed transactions remain constrained by local policy checks.

4. **Control Plane (API + UI)**
   - Create/list/spawn/pause agents.
   - Start/stop strategy instances per agent config.
   - Persist enabled configs and agent registry across restarts.

---

## Safety & Guardrails (non-negotiable)

- Per-agent limits:
  - max daily loss (XRP)
  - max position size (XRP)
  - max trades per hour
  - allowed strategies list
- Spawn controls:
  - `autoSpawnEnabled`
  - `maxChildren`
  - `minSpawnCapitalXrp`
- Global controls:
  - max total active agents
  - reserve buffer never tradable
  - kill switch to pause all autonomous actions
- No raw seed exposure to LLM prompts/logs.

---

## Phase Plan

### Phase 1 (implemented now)
- Add LLM capital agent data model + persistence (`data/llm-agents.json`).
- Add manager for create/list/spawn with policy enforcement.
- Add API endpoints:
  - `GET /api/llm-agents`
  - `POST /api/llm-agents`
  - `POST /api/llm-agents/:id/spawn`
- Add MCP HTTP client scaffold and `XRPL_MCP_URL` env.

### Phase 2
- Wire LLM agent -> strategy config mapping.
- Per-agent wallet routing in bot manager (no shared wallet execution).
- Add per-agent P&L and risk telemetry.

### Phase 3
- MCP-driven market state ingestion for decision prompts.
- Decision cycle scheduler with cooldowns and confidence thresholds.
- Action approval modes: auto / confirm-large / manual.

### Phase 4
- Adaptive portfolio diversification logic:
  - spin up child agents by strategy archetype
  - allocate/rebalance capital via bounded optimizer
- Recovery and chaos testing (node outages, rate limits, partial fills).

---

## Deployment Notes for `xrpl-mcp-service`

1. Clone and run service on host:
   - `python -m venv .venv && source .venv/bin/activate`
   - `pip install xrpl-py fastapi uvicorn python-dotenv`
   - `.env`: `XRPL_NODE_URL=https://xrplcluster.com`
   - `uvicorn main:app --host 0.0.0.0 --port 8000`

2. In trading bot `.env`:
   - `XRPL_MCP_URL=http://127.0.0.1:8000`

3. Keep bot execution websocket endpoint independent:
   - `XRPL_SERVER=wss://xrplcluster.com` (or dedicated provider)

---

## Acceptance Criteria (initial)

- Agent registry persists across restarts.
- Can create parent + child agents with enforced spawn limits.
- No agent can exceed assigned capital in recorded state transitions.
- API returns deterministic errors for policy violations.
