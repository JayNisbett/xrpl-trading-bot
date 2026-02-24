# 🎉 Configuration System Update - Multi-Bot Management

## What's New?

Your XRPL Trading Bot now has a **powerful configuration management system** that allows you to:

✅ **Run multiple bots simultaneously** with different strategies  
✅ **Configure everything from the UI** - no more editing `.env`  
✅ **Start and stop bots on demand** without restarting  
✅ **Mix strategies** - create specialized bots for different purposes  
✅ **Track all instances** in real-time from the dashboard  

## 🚀 Quick Start

### Step 1: Start Your Bot

```bash
npm start
```

Your bot will start normally using `.env` settings (backward compatible).

### Step 2: Access the Dashboard

Open the dashboard at `http://localhost:3001` and navigate to:

**⚙️ Configurations** (in the sidebar)

### Step 3: Create a Configuration

Two ways to start:

#### Option A: Import from .env (Easiest)
1. Click **"📥 Import from .env"**
2. Your current settings will be imported as a configuration
3. Edit and customize as needed

#### Option B: Create from Scratch
1. Click **"➕ New Configuration"**
2. Fill in the form with your desired settings
3. Save and start

## 🎮 Using the Configuration Page

### Configuration Cards

Each configuration shows:
- **Name & Description**: What this bot does
- **Mode Badge**: Strategy type (Sniper, Copy Trading, AMM, Hybrid)
- **Feature Tags**: Which strategies are enabled
- **Running Banner**: Shows if instance is active
- **Actions**: Edit, Start, Delete buttons

### Running Instances Tab

View all active bots:
- **Status**: Real-time state (running, stopped, error)
- **Started Time**: When the instance launched
- **Features**: Visual icons for enabled strategies
- **Controls**: Stop, Restart buttons

## 📋 Configuration Editor

The editor has 4 tabs:

### 📝 General Tab
```
✓ Configuration name and description
✓ Bot mode selection
✓ Enable/disable toggle
✓ Default slippage and stop loss
✓ Trading parameters (min liquidity, holders, activity)
```

### 🎯 Sniper Tab
```
✓ Enable sniper module
✓ Check interval (scan frequency)
✓ Max tokens per scan
✓ Auto-buy mode
✓ Snipe amount
✓ Min pool liquidity
✓ Risk score (low, medium, high)
```

### 👥 Copy Trading Tab
```
✓ Enable copy trading module
✓ Trader addresses (comma-separated)
✓ Check interval
✓ Amount mode (fixed or percentage)
✓ Match percentage or fixed amount
✓ Max spend per trade
```

### 🌊 AMM Tab
```
✓ Enable AMM module
✓ Arbitrage settings:
  - Min profit percentage
  - Max trade amount
  - Check interval
✓ Liquidity provision settings:
  - Strategy (one-sided, balanced, auto)
  - Min TVL
  - Target APR
  - Max positions
  - Max price impact
✓ Risk management:
  - Max impermanent loss
  - Max position size
  - Diversification toggle
```

## 🎯 Example Configurations

### Configuration 1: "Aggressive Sniper"
```
Name: Aggressive Sniper
Mode: Sniper Only
Sniper:
  - Enabled: ✓
  - Check Interval: 2000ms
  - Risk Score: High
  - Auto-buy: ✓
  - Snipe Amount: 5 XRP
```

### Configuration 2: "Conservative AMM Farmer"
```
Name: Conservative AMM
Mode: AMM Only
AMM:
  - Arbitrage: ✓ (1% min profit)
  - LP: ✓ (Balanced, 25% target APR)
  - Risk: 8% max IL, diversification ✓
```

### Configuration 3: "Whale Mimic"
```
Name: Copy Top Trader
Mode: Copy Trading Only
Copy Trading:
  - Enabled: ✓
  - Traders: rWhaleAddress123...
  - Mode: 50% match
  - Max Spend: 10 XRP
```

### Configuration 4: "Jack of All Trades"
```
Name: Full Strategy Bot
Mode: Hybrid
All Modules:
  - Sniper: ✓ (medium risk, 2 XRP)
  - Copy Trading: ✓ (2 traders, fixed 1.5 XRP)
  - AMM: ✓ (arbitrage + LP)
```

## 🔧 Technical Details

### Storage Location
- Configurations: `data/bot-configs.json`
- User data: `data/state.json` (unchanged)

### Architecture
```
┌─────────────────────────────────────┐
│         Dashboard UI                │
│  (Create/Edit/Start/Stop Configs)  │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│       API Server (Express)          │
│   /api/configs, /api/instances      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Bot Instance Manager           │
│   (Manages multiple bot instances)  │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼───┐  ┌──▼───┐  ┌──▼───┐
│ Bot 1 │  │ Bot 2│  │ Bot 3│
│Config │  │Config│  │Config│
│  A    │  │  B   │  │  C   │
└───────┘  └──────┘  └──────┘
```

### API Endpoints

**Configurations**
- `GET /api/configs` - Get all configs
- `POST /api/configs` - Create new config
- `POST /api/configs/from-env` - Import from .env
- `PUT /api/configs/:id` - Update config
- `DELETE /api/configs/:id` - Delete config

**Instances**
- `GET /api/instances` - Get running instances
- `GET /api/instances/stats` - Get statistics
- `POST /api/instances/start` - Start bot with config
- `POST /api/instances/:id/stop` - Stop instance
- `POST /api/instances/:id/restart` - Restart instance

## ⚡ Performance Benefits

### Before (Single Bot)
- Edit `.env` → Restart bot → Wait for initialization
- Can't test different strategies simultaneously
- Risk all capital on one strategy

### After (Multi-Bot System)
- Create config in UI → Start instantly
- Run multiple strategies in parallel
- Allocate capital across different risk profiles
- Test new strategies without stopping production bots

## 🛡️ Safety Features

### 1. Configuration Validation
- Required fields enforced
- Numeric ranges validated
- Invalid values rejected

### 2. Instance Protection
- Can't delete configs with running instances
- Must stop before deletion
- Graceful shutdown on errors

### 3. Resource Sharing
- Sniper and copy trading modules are shared (same user)
- Prevents duplicate subscriptions
- AMM bots run independently per instance

### 4. Error Isolation
- One bot's error doesn't crash others
- Error messages displayed in UI
- Easy restart from dashboard

## 📊 Monitoring & Control

### Real-Time Status
- Live status updates every 5 seconds
- Visual indicators (✓ running, ⏸ stopped, ⚠️ error)
- Start time tracking

### Quick Actions
- One-click start/stop
- Instant restart
- Edit without stopping (save for next start)

### Statistics
- Total instances
- Running count
- Error count
- Per-instance details

## 🔄 Migration Guide

### Option 1: Import Current Settings
1. Click **"Import from .env"** in dashboard
2. Review imported configuration
3. Edit if needed
4. Start the bot

### Option 2: Manual Creation
1. Create new configuration
2. Copy values from `.env`
3. Customize as needed
4. Save and start

### Option 3: Keep Using .env
Your current workflow still works! The default bot still reads from `.env` when you run `npm start`.

## 🎨 UI Improvements

### Configuration Page Features
- **Search and filter** configurations
- **Visual mode badges** for quick identification
- **Feature tags** showing enabled strategies
- **Running status** prominently displayed
- **One-click actions** for common tasks

### Instance Management
- **Real-time status** updates
- **Error messages** inline
- **Start time** tracking
- **Control actions** (stop, restart)
- **Feature badges** for quick strategy identification

## 💡 Pro Tips

### 1. Test Before Scaling
Start with one or two configs, verify they work, then add more.

### 2. Use Descriptive Names
"Aggressive Sniper 5XRP High Risk" > "Config 1"

### 3. Diversify Strategies
Don't run 5 identical bots - spread across risk levels and strategies.

### 4. Monitor Instances
Check the "Running Instances" tab regularly for errors or unexpected behavior.

### 5. Start Small Amounts
Use conservative amounts when testing new configurations.

### 6. Copy Trading Coordination
Multiple bots can follow different traders - great for diversification!

### 7. AMM Strategy Separation
Run separate bots for arbitrage vs. liquidity provision for better control.

## 🚨 Common Questions

### Q: Can I still use my .env file?
**A:** Yes! The default bot (`npm start`) still uses `.env`. The new system is additive.

### Q: Do all bots share the same wallet?
**A:** Yes, currently all bots share the wallet from `.env`. Multi-wallet support coming soon!

### Q: How many bots can I run at once?
**A:** Technically unlimited, but be mindful of your capital and API rate limits. Start with 2-3.

### Q: What happens if one bot errors?
**A:** Other bots keep running. The errored bot shows error status and can be restarted.

### Q: Can I edit a running bot?
**A:** You can edit the configuration, but changes apply after restart. Stop, then start again.

### Q: Do I need to keep .env?
**A:** Keep the wallet settings in `.env`. Other settings can move to UI configurations.

## 📁 File Structure

```
xrpl-trading-bot/
├── data/
│   ├── state.json           # User data (unchanged)
│   └── bot-configs.json     # Bot configurations (NEW)
├── src/
│   ├── database/
│   │   └── botConfigs.ts    # Config storage (NEW)
│   ├── botManager.ts        # Instance manager (NEW)
│   ├── bot.ts               # Main bot (updated)
│   └── api/
│       └── server.ts        # API endpoints (updated)
└── dashboard/
    └── src/
        └── pages/
            └── BotConfigs.tsx  # Config UI (NEW)
```

## 🎯 What's Next?

1. **Try the new UI** - Create your first configuration
2. **Test with small amounts** - Verify behavior
3. **Scale gradually** - Add more bots as confidence grows
4. **Experiment** - Try different strategy combinations
5. **Monitor & optimize** - Track performance and adjust

---

**Need help?** Check `MULTI_BOT_GUIDE.md` for detailed usage instructions!
