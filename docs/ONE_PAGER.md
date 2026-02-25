# XRPL Autonomous Trading Platform — One-Pager

**What it is:** A policy-governed XRPL trading system that runs multiple strategies (AMM arbitrage, liquidity, sniping, copy-trading) and supports autonomous AI agents that manage allocated XRP under strict risk controls.

**Value:** Maximize value growth in XRP terms; run continuously and safely; support both manual and autonomous operation; diversify across strategy instances and agent-managed wallets.

**Safety:** All execution goes through a single backend. Risk gates enforce balance/reserve checks, position limits, per-agent caps (max position size, max daily loss, max trades per hour), and allowed strategies. Agents cannot bypass guards or move capital outside the platform.

**Multi-agent:** Operators create LLM agents, assign wallets and strategy configs, and set policy (risk tier, capital limits, spawn rules). Agents can spawn child agents with bounded capital, forming scalable teams. Each agent is scoped to its assigned configs and wallet.

**Resilience:** XRPL client uses endpoint fallback and reconnect backoff with thrashing protection. Configs and per-agent running state can be restored on boot.

**Audience:** Teams that want systematic XRPL yield extraction with human oversight and optional autonomous agent deployment.
