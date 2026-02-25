# Platform Architecture (Mermaid)

## Control vs execution plane

```mermaid
flowchart LR
  subgraph control [Control Plane]
    API[API Server]
    WS[WebSocket]
    Config[Config Registry]
    Dashboard[Dashboard]
    LLMMgr[LLM Manager]
  end
  subgraph execution [Execution Plane]
    BM[botManager]
    Sniper[Sniper]
    Copy[Copy Trading]
    AMM[AMM Bot]
    PM[Profit Manager]
  end
  subgraph risk [Risk Layer]
    Safety[safetyChecks]
    Guards[LLM Guards]
    Wallet[Wallet Provider]
  end
  API --> BM
  BM --> Sniper
  BM --> Copy
  BM --> AMM
  Sniper --> Safety
  Sniper --> Guards
  Copy --> Safety
  Copy --> Guards
  AMM --> Guards
  PM --> Wallet
  Dashboard --> API
  Dashboard --> WS
  LLMMgr --> API
```

## Portfolio manager and agent hierarchy

```mermaid
flowchart TB
  subgraph pm [Portfolio Manager]
    PMView[PM View]
    Alloc[Allocate or Rebalance]
    Assign[Assign Configs]
    Create[Create or Retire Agents]
  end
  subgraph platform [Platform API]
    REST[REST plus Tree and Aggregate]
  end
  subgraph agents [Agent Hierarchy]
    A1[Agent 1]
    A2[Agent 2]
    A1c1[Child 1a]
    A1c2[Child 1b]
    A2c1[Child 2a]
  end
  subgraph execution [Execution]
    S[Sniper]
    C[Copy]
    M[AMM]
  end
  PMView --> REST
  Alloc --> REST
  Assign --> REST
  Create --> REST
  REST --> A1
  REST --> A2
  A1 --> A1c1
  A1 --> A1c2
  A2 --> A2c1
  A1 --> S
  A1 --> C
  A2 --> M
  A1c1 --> S
```

## Data flow (high level)

- **Config / instances:** Dashboard and API CRUD configs; start/stop sends commands to botManager; botManager runs strategy loops per instance and userId.
- **Agents:** LLM agents are stored in `data/llm-agents.json`; wallet seeds in `data/llm-wallet-seeds.json`. Start-config validates allowed strategies and optional assigned configs, then starts a bot instance for that agent’s userId.
- **Trades:** Strategy code calls safety checks and LLM guards, then executes via XRPL client; profit manager and position tracking update state; Socket.IO broadcasts events to the dashboard.

## Agent lifecycle

1. **Create:** API or dashboard creates agent (name, wallet address, allocation, policy).
2. **Bind wallet:** Operator binds a wallet seed for the agent’s userId; platform verifies address match.
3. **Assign config:** Set default or allowed configs; config’s enabled strategies must be in agent’s allowedStrategies.
4. **Start:** Start agent (one-click with default config) or start a specific config; botManager runs strategies for that userId.
5. **Spawn (optional):** Parent agent spawns child with allocation and policy; child gets its own userId and wallet binding.
6. **Stop / retire:** Stop instances; optionally pause or retire agent; per-agent running configs are persisted for restore on boot.
