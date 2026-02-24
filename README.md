# XRPL Trading Bot v3.0 - AMM Edition 🌊

A sophisticated, high-performance XRPL trading bot with **AMM arbitrage**, **yield farming**, sniper, and copy trading capabilities. Now featuring automated liquidity provision and cross-pool arbitrage for consistent passive income!

## ⚡ New to the Bot? Start Here!

**🎯 Want to earn yield from AMM pools?** Read these first:
- **[BOT_DETAIL_PAGES_UPDATE.md](BOT_DETAIL_PAGES_UPDATE.md)** - New UI & arbitrage fixes (LATEST! 📊)
- **[POOL_SCANNING_GUIDE.md](POOL_SCANNING_GUIDE.md)** - Expand pool discovery for more opportunities (NEW! 🔍)
- **[AMM_QUICK_START.md](AMM_QUICK_START.md)** - AMM setup in 5 minutes (NEW! 🌊)
- **[AMM_STRATEGIES.md](AMM_STRATEGIES.md)** - Deep dive into arbitrage & yield farming (NEW!)
- **[MULTI_BOT_GUIDE.md](MULTI_BOT_GUIDE.md)** - Run multiple bots with different strategies (NEW! 🤖)
- **[QUICKSTART.md](QUICKSTART.md)** - General bot setup
- **[DASHBOARD_GUIDE.md](DASHBOARD_GUIDE.md)** - Dashboard features & usage
- **[CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)** - Detailed configuration

**Key Commands:**
```bash
npm start                 # Start all bots (sniper + AMM + dashboard) 🌊
npm run start:sniper      # Start sniper bot only
npm run dashboard         # Start dashboard only
npm run account-status    # Check your wallet balance & health
npm run generate-wallet   # Create a new XRPL wallet
```

**💡 Tip:** The AMM bot runs automatically when you `npm start` - just ensure `AMM_BOT_ENABLED=true` in your `.env`!

## 🚀 Features

### NEW! Trading Terminal UI (v3.3) 📊
- **Dedicated Bot Pages**: Each bot has its own full-page view with complete context
- **Individual Bot P&L Charts**: Real-time profit/loss visualization per bot instance
- **Chat-Style Activity Logs**: Collapsible messaging interface (minimize to 60px!)
- **Arbitrage Intelligence**: Live stats showing opportunities found/filtered/executed
- **Real-Time Monitoring**: WebSocket-powered instant updates
- **Professional Design**: Dark gradient theme with trading terminal aesthetics
- **XRPScan Integration**: Direct links to verify all transactions on-chain

### Multi-Bot Configuration System (v3.1) 🤖
- **Multiple Bot Instances**: Run several bots simultaneously with different strategies
- **UI-Based Configuration**: Create and manage all settings from the dashboard
- **Real-Time Control**: Start, stop, and restart bots without code changes
- **Strategy Mixing**: Each bot can run sniper, copy trading, AMM, or all three
- **Per-Bot Settings**: Customize risk levels, amounts, and parameters independently
- **Live Monitoring**: Track all running instances and their performance

### AMM Strategies (v3.0) 🌊
- **Arbitrage Bot**: Automatically detects and exploits price differences between AMM pools (0.5-3% per trade)
- **Liquidity Provider**: Earns passive income by providing liquidity to high-yield pools (20-35% APR)
- **One-Sided Entries**: Deposit only XRP, no tokens needed
- **Yield Optimization**: Auto-exits underperforming positions, compounds profits
- **Impermanent Loss Protection**: Monitors and exits if IL exceeds threshold
- **AMM Dashboard Page**: Dedicated UI for pools, positions, and arbitrage stats

### Trading Features
- **Real-Time Dashboard**: Beautiful React UI with live updates and multi-page navigation 📊
- **Auto Profit-Taking**: Sells at +12% profit automatically 💰
- **High-Frequency Trading**: Optimized for maximum trade opportunities ⚡
- **Token Sniping**: Automatically detect and snipe new tokens from AMM pools
- **Position Tracking**: Real-time P/L monitoring with risk indicators
- **Safety Checks**: Built-in balance and position limit protection
- **Account Management**: Easy wallet generation and status monitoring
- **WebSocket Updates**: Live data streaming for instant notifications

## 📁 Project Structure

```
xrpl-trading-bot/
├── src/
│   ├── config/          # Configuration management
│   ├── database/        # Database models and storage
│   │   ├── botConfigs.ts        # 🆕 Bot configuration storage
│   │   ├── models.ts            # Data models
│   │   └── storage.ts           # State persistence
│   ├── xrpl/            # XRPL client, wallet, and AMM utilities
│   ├── amm/             # 🌊 AMM strategies (arbitrage, liquidity, yield)
│   │   ├── ammBot.ts              # Main AMM orchestrator
│   │   ├── poolAnalyzer.ts        # Pool metrics & analysis
│   │   ├── liquidityProvider.ts   # LP deposit/withdrawal
│   │   ├── arbitrageExecutor.ts   # Cross-pool arbitrage
│   │   └── poolScanner.ts         # Pool discovery
│   ├── sniper/          # Token sniping module
│   ├── copyTrading/     # Copy trading module
│   ├── api/             # REST API & WebSocket server
│   ├── utils/           # Position tracking, profit management, safety checks
│   ├── types/           # TypeScript type definitions
│   ├── botManager.ts    # 🆕 Multi-bot instance manager
│   └── bot.ts           # Main bot orchestrator
├── dashboard/           # 📊 React dashboard (multi-page)
│   ├── src/
│   │   ├── pages/       # Overview, Positions, AMM Pools, Configs, Bots, etc.
│   │   │   ├── BotConfigs.tsx   # 🆕 Configuration management UI
│   │   │   └── AMMPools.tsx     # 🌊 AMM pools & arbitrage
│   │   ├── components/  # Reusable UI components
│   │   └── App.tsx      # Main dashboard app
│   └── dist/            # Built dashboard files
├── dist/                # Compiled JavaScript (after build)
├── data/                # Bot state and transaction history
│   ├── state.json              # User data and transactions
│   └── bot-configs.json        # 🆕 Bot configurations
├── index.ts             # Entry point (TypeScript)
├── tsconfig.json        # TypeScript configuration
├── package.json
└── .env                 # Environment configuration
```

**Note**: This project is written in TypeScript and compiles to JavaScript in the `dist/` folder.

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xrpl-trading-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build TypeScript** (required before running)
   ```bash
   npm run build
   ```

4. **Configure environment variables**
   Create a `.env` file:
   ```env
   # XRPL Configuration
   XRPL_SERVER=wss://xrplcluster.com
   XRPL_NETWORK=mainnet

   # Wallet Configuration (REQUIRED)
   WALLET_SEED=your_wallet_seed_here
   WALLET_ADDRESS=your_wallet_address_here

   # Storage Configuration (Optional)
   DATA_FILE=./data/state.json

   # Trading Configuration (Optional)
   MIN_LIQUIDITY=100
   MAX_SNIPE_AMOUNT=5000
   DEFAULT_SLIPPAGE=4.0
   SNIPER_CHECK_INTERVAL=8000
   COPY_TRADING_CHECK_INTERVAL=3000

   # Sniper Configuration (Optional)
   SNIPER_BUY_MODE=true
   SNIPER_AMOUNT=1
   SNIPER_CUSTOM_AMOUNT=
   SNIPER_MIN_LIQUIDITY=100
   SNIPER_RISK_SCORE=medium
   SNIPER_TRANSACTION_DIVIDES=1

   # Copy Trading Configuration (Optional)
   COPY_TRADER_ADDRESSES=rTrader1Address,rTrader2Address
   COPY_TRADING_AMOUNT_MODE=percentage
   COPY_TRADING_MATCH_PERCENTAGE=50
   COPY_TRADING_MAX_SPEND=100
   COPY_TRADING_FIXED_AMOUNT=10
   ```

## 🎯 Usage

### Quick Start (No Build Required)
After `npm install`, you can run the bot directly:

```bash
# Start both sniper and copy trading
npm start

# Start only sniper
npm run start:sniper

# Start only copy trading
npm run start:copy

# Start with custom user ID
npm start -- --user=my-user-id
```

### Development (with auto-reload)
```bash
npm run dev:watch
```

### Production (Optional: Compiled JavaScript)
If you prefer to compile to JavaScript first:
```bash
# Build first
npm run build

# Then run compiled version
node dist/index.js
```

**Note:** The bot runs directly from TypeScript source using `ts-node`, so no build step is required. The `build` script is optional for users who prefer compiled JavaScript.

## 📋 Prerequisites

Before running the bot, you need to:

1. **Configure Wallet**: Set `WALLET_SEED` and `WALLET_ADDRESS` in `.env`
2. **Fund Wallet**: Ensure your wallet has sufficient XRP for trading and fees
3. **Configuration**: All configuration is done via `.env` file. The `data/state.json` file is only used for runtime state (transactions, purchases, balances).

## ⚙️ Configuration

### Configuration via .env

All configuration is done through the `.env` file. The `data/state.json` file is automatically created and only stores runtime state (transactions, purchases, balances).

### Sniper Configuration

Configure sniper settings in `.env`:

- `SNIPER_BUY_MODE`: `true` for auto-buy mode, `false` for whitelist-only
- `SNIPER_AMOUNT`: Amount to snipe (e.g., '1', '5', '10', 'custom')
- `SNIPER_CUSTOM_AMOUNT`: Custom snipe amount if using 'custom' mode
- `SNIPER_MIN_LIQUIDITY`: Minimum liquidity required (XRP)
- `SNIPER_RISK_SCORE`: Risk tolerance ('low', 'medium', 'high')
- `SNIPER_TRANSACTION_DIVIDES`: Number of transactions to divide snipe into

**Note:** Whitelist and blacklist tokens are still configured in `data/state.json` as they are runtime data.

### Copy Trading Configuration

Configure copy trading settings in `.env`:

**Required Settings:**
- `COPY_TRADER_ADDRESSES`: Comma-separated list of trader wallet addresses to copy
  ```env
  COPY_TRADER_ADDRESSES=rTrader1Address,rTrader2Address
  ```

**Optional Settings:**
- `COPY_TRADING_AMOUNT_MODE`: Trading amount calculation mode (`percentage`, `fixed`, or `match`)
- `COPY_TRADING_MATCH_PERCENTAGE`: Percentage of trader's amount to match (0-100)
- `COPY_TRADING_MAX_SPEND`: Maximum XRP to spend per copy trade
- `COPY_TRADING_FIXED_AMOUNT`: Fixed XRP amount for each copy trade

**Note:** All configuration is now in `.env`. The `data/state.json` file only stores runtime state (transactions, purchases, balances, active flags).

## 🔧 Module Overview

### Sniper Module (`src/sniper/`)
- **monitor.ts**: Detects new tokens from AMM create transactions
- **evaluator.ts**: Evaluates tokens based on user criteria (rugcheck, whitelist, etc.)
- **index.ts**: Main sniper logic and orchestration

### Copy Trading Module (`src/copyTrading/`)
- **monitor.ts**: Monitors trader wallets for new transactions
- **executor.ts**: Executes copy trades based on detected transactions
- **index.ts**: Main copy trading logic and orchestration

### XRPL Module (`src/xrpl/`)
- **client.ts**: XRPL WebSocket client management
- **wallet.ts**: Wallet operations and utilities
- **amm.ts**: AMM trading functions (buy/sell)
- **utils.ts**: XRPL utility functions

## 🛡️ Safety Features

- Maximum snipe amount limits
- Minimum liquidity requirements (rugcheck)
- Blacklist/whitelist filtering
- Slippage protection
- Transaction deduplication
- Balance validation before trades

## 📊 Monitoring

The bot logs all activities to the console:
- ✅ Successful operations
- ⚠️ Warnings
- ❌ Errors
- 🎯 Sniper activities
- 📊 Copy trading activities

## ⚠️ Important Notes

- **Mainnet Only**: This bot operates on XRPL mainnet with real funds
- **Risk Warning**: Trading cryptocurrencies involves substantial risk
- **No Guarantees**: Past performance doesn't guarantee future results
- **Test First**: Always test with small amounts first

## 🔄 Migration from v1.0

If you're migrating from the Telegram bot version:

Key changes:
- Removed all Telegram dependencies
- Removed MongoDB dependency (now uses JSON file storage)
- Modular architecture (was 9900+ lines in one file)
- Runs as standalone process instead of Telegram bot
- State is stored in `data/state.json` instead of MongoDB

**Note**: If you have existing MongoDB data, you'll need to export it and convert to the JSON format. See `data/state.json.example` for the structure.

## 📝 License

MIT License - Use at your own risk.

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the existing modular structure.

---

**⚠️ Disclaimer**: This bot is for educational purposes. Use at your own risk. The developers are not responsible for any financial losses.

## 📞 Contact

For support or questions, reach out on Telegram: [@trum3it](https://t.me/trum3it)

**⭐ Star**: this repository if you find it useful!
