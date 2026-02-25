# Degraded Mode and Risk Tier

## Degraded mode

When a bot instance starts but one or more strategy modules fail to start (e.g. sniper, copy-trading, or AMM), the instance is marked **running** with a **degraded** status.

- **Behavior:** The instance’s `error` field is set to `degraded: <list of failures>`. The instance is still considered running; other modules (e.g. AMM) may be active.
- **Reporting:** The dashboard and API show the instance as running; the degraded message is visible in instance details and logs.
- **Execution:** All modules that started successfully continue to execute. There is no automatic reduction of trade size or disable of execution for degraded instances. Future versions may add options to skip trade execution or reduce max trade size when degraded.

## Risk tier

Each LLM agent has a **risk tier** in its policy: `low`, `medium`, or `high`.

- **Storage and UI:** The value is stored in `AgentPolicy.riskTier` and shown in the dashboard when viewing or editing an agent.
- **Guards:** Risk tier is **not** currently used in `canExecuteXrpTrade` or any execution path. Limits (max position size, max daily loss, max trades per hour, etc.) are enforced from the raw policy values only.
- **Use:** Treat risk tier as **informational** for now (e.g. to label agent appetite). To make it affect behavior, the codebase could scale `maxPositionSizeXrp` or `maxDailyLossXrp` by tier (e.g. low = 0.8×, high = 1.2×) in `src/llmCapital/guards.ts`.
