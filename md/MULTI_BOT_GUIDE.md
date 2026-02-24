# 🤖 Multi-Bot Configuration System

## Overview

The XRPL Trading Bot now supports running **multiple bot instances simultaneously** with different configurations and strategies. Configure everything from the dashboard UI without editing `.env` files!

## ✨ Key Features

- **Multiple Bot Instances**: Run several bots at once with different strategies
- **UI-Based Configuration**: Create and manage configs from the dashboard
- **Real-Time Control**: Start, stop, and restart bots on the fly
- **Strategy Mixing**: Each bot can run sniper, copy trading, AMM, or all three
- **Per-Bot Settings**: Customize risk levels, amounts, and parameters per instance
- **Live Monitoring**: Track all running instances in real-time

## 🚀 Quick Start

### 1. Start the Bot

```bash
npm start
```

The bot will start with your `.env` configuration (backward compatible).

### 2. Open Dashboard

Navigate to **Configurations** page in the sidebar (⚙️ icon).

### 3. Create Your First Configuration

Click **"+ New Configuration"** and set:

- **Name**: Give it a descriptive name (e.g., "High Risk Sniper", "Conservative AMM")
- **Description**: What this bot does
- **Mode**: Choose the strategy type
  - 🎯 **Sniper Only**: Token sniping only
  - 👥 **Copy Trading Only**: Mirror other traders
  - 🌊 **AMM Only**: Arbitrage and liquidity provision
  - 🔀 **Hybrid**: All strategies combined

### 4. Configure Strategy Settings

Use the tabs to configure each module:

#### 📝 General Tab
- Bot mode selection
- Default slippage and stop loss
- Minimum liquidity requirements

#### 🎯 Sniper Tab
- Enable/disable sniper
- Check interval (how often to scan)
- Auto-buy mode
- Risk score (low, medium, high)
- Snipe amount per token

#### 👥 Copy Trading Tab
- Enable/disable copy trading
- Trader addresses to follow
- Amount mode (fixed XRP or % match)
- Max spend per trade

#### 🌊 AMM Tab
- Enable/disable AMM strategies
- **Arbitrage**: Min profit %, max trade size, check interval
- **Liquidity Provision**: Strategy, min TVL, target APR, max positions
- **Risk Management**: Max impermanent loss, position size, diversification

### 5. Start the Bot Instance

Click **"▶️ Start"** on any configuration to launch a bot with those settings.

## 📊 Managing Bot Instances

### View Running Instances

Switch to the **"🤖 Running Instances"** tab to see all active bots:

- **Status**: Running, stopped, starting, error
- **Started At**: When the instance was launched
- **Features**: Visual indicators for enabled strategies
- **Actions**: Stop, restart individual instances

### Control Actions

- **⏹ Stop**: Gracefully stop a running instance
- **↻ Restart**: Stop and start with same config
- **▶️ Start Again**: Restart a stopped instance

## 🎯 Use Cases & Examples

### Example 1: Conservative + Aggressive Strategy

**Bot A - "Conservative AMM"**
- Mode: AMM Only
- Arbitrage: 1% min profit, 3 XRP max
- LP: Balanced strategy, 30% target APR
- Risk: 8% max IL, diversification ON

**Bot B - "Aggressive Sniper"**
- Mode: Sniper Only
- Auto-buy: ON
- Risk Score: High
- Snipe Amount: 5 XRP
- Check Interval: 2000ms

### Example 2: Multi-Trader Copy System

**Bot A - "Copy Whale 1"**
- Mode: Copy Trading Only
- Trader: rWhale1Address...
- Amount: 100% match
- Max Spend: 10 XRP

**Bot B - "Copy Whale 2"**
- Mode: Copy Trading Only
- Trader: rWhale2Address...
- Amount: 50% match
- Max Spend: 5 XRP

### Example 3: Diversified Yield Farming

**Bot A - "High APR Hunter"**
- Mode: AMM Only
- LP Strategy: One-sided
- Target APR: 40%
- Max Positions: 3

**Bot B - "Stable Yield"**
- Mode: AMM Only
- LP Strategy: Balanced
- Target APR: 20%
- Max Positions: 10

## 🔄 Migration from .env

Your `.env` settings still work! The bot uses them by default when you run `npm start`.

To migrate to the new system:

1. Go to **Configurations** page
2. Click **"+ New Configuration"**
3. Manually enter your `.env` values
4. Save and start the new config
5. You can now edit settings without restarting!

## 🛡️ Safety Features

### Configuration Validation
- Can't delete configs with running instances
- Must stop instances before deletion
- Invalid values are caught before saving

### Resource Management
- Shared sniper/copy trading across instances (same user)
- Independent AMM bots per instance
- Graceful shutdown of all instances on exit

### Conflict Prevention
- Only one instance per configuration at a time
- Shared modules (sniper/copy) don't duplicate
- Clear status indicators

## 📡 API Endpoints

The system exposes these endpoints for programmatic control:

### Configurations
- `GET /api/configs` - List all configurations
- `GET /api/configs/:id` - Get specific config
- `POST /api/configs` - Create new config
- `PUT /api/configs/:id` - Update config
- `DELETE /api/configs/:id` - Delete config

### Instances
- `GET /api/instances` - List running instances
- `GET /api/instances/stats` - Instance statistics
- `POST /api/instances/start` - Start instance with config
- `POST /api/instances/:id/stop` - Stop instance
- `POST /api/instances/:id/restart` - Restart instance

## 🎨 UI Features

### Configuration Cards
- Visual mode badges
- Feature tags (shows enabled strategies)
- Running status banner
- Quick actions (Edit, Start, Delete)

### Instance Cards
- Real-time status updates
- Start time tracking
- Error messages (if any)
- Control actions (Stop, Restart)

### Configuration Editor
- Tabbed interface for organized settings
- Real-time validation
- Quick value suggestions
- Helpful hints and descriptions

## 💡 Best Practices

### 1. Start Small
Create one or two configurations first, test them, then scale up.

### 2. Name Clearly
Use descriptive names like "Aggressive Sniper 5XRP" instead of "Config 1".

### 3. Monitor Performance
Check the running instances tab frequently to catch errors early.

### 4. Diversify Strategies
Don't run multiple bots with identical settings - diversify risk levels and targets.

### 5. Set Limits
Use max spend and position limits to control total capital allocation.

### 6. Test AMM Settings
AMM strategies need time to prove profitable - don't change settings too quickly.

## 🐛 Troubleshooting

### Bot Won't Start
- Check if configuration is enabled
- Verify all required fields are filled
- Check for existing running instance with same config
- Review console for error messages

### Configuration Won't Delete
- Stop all running instances using this config first
- Check the "Running Instances" tab

### Bot Shows Error Status
- Click on the instance to see error message
- Common issues:
  - Invalid trader addresses
  - Insufficient XRP balance
  - Network connection problems

### Changes Not Applying
- Stop and restart the bot instance
- Configurations are loaded when instance starts
- Live instances don't auto-reload configs

## 📈 Performance Tips

### For Arbitrage Bots
- Lower check intervals (3-5 seconds) for faster detection
- Set realistic min profit % (0.5-1%)
- Keep max trade amounts reasonable (3-10 XRP)

### For LP Bots
- Higher target APR means higher risk
- Use diversification for better risk management
- Monitor impermanent loss regularly

### For Sniper Bots
- Aggressive: High risk, 2s interval, auto-buy ON
- Conservative: Medium risk, 8s interval, manual review
- Balance check interval with API rate limits

### For Copy Trading
- Multiple bots can follow different traders
- Use percentage mode to scale with trader size
- Set max spend to control per-trade exposure

## 🔐 Security Notes

- Configurations are stored in `data/bot-configs.json`
- **DO NOT** commit this file to git (contains strategies)
- Back up configurations regularly
- Wallet seed still comes from `.env` (shared across all bots)

## 🎯 Next Steps

1. **Create your first custom configuration** in the dashboard
2. **Test with small amounts** to verify behavior
3. **Scale up gradually** as you gain confidence
4. **Monitor and adjust** based on performance
5. **Experiment with different strategy combinations**

---

**Questions?** Review the main README or check other documentation files for more details on specific trading strategies.
