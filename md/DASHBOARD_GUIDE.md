# 📊 Real-Time Trading Dashboard

## 🎯 Overview

A beautiful, real-time React dashboard that visualizes your XRPL trading bot's activity, positions, and performance.

---

## ✨ Features

### 🔴 Live Connection Status
- Real-time WebSocket connection indicator
- Auto-reconnects if connection drops
- Updates every 5 seconds

### 💰 Account Status
- Total XRP Balance
- Tradable Balance
- Locked Reserves
- Active Positions (X/Y)
- Health Status (Healthy/Warning/Critical)

### 📊 Active Positions
- All current holdings
- Entry vs Current price
- Real-time P/L per position
- Portfolio total P/L
- Profit/Loss percentages

### 🎯 Performance Metrics
- Total Trades
- Winning vs Losing Trades
- Win Rate Percentage
- Total Profit
- Average Profit per Trade

### 📈 Win/Loss Distribution
- Visual pie chart showing win rate
- Color-coded for easy reading
- Real-time updates

### 📜 Recent Transactions
- Last 20 transactions
- Buy/Sell indicators
- Profit/Loss for sells
- Timestamps

---

## 🚀 Quick Start

### Option 1: Auto-Start (Easiest)

The dashboard automatically opens when you start the bot:

```bash
npm run start:sniper
```

The dashboard will:
1. Start automatically on port 3001
2. Open in your default browser
3. Connect to the bot's API
4. Update in real-time

### Option 2: Manual Start

If you want to run them separately:

```bash
# Terminal 1: Start the bot
npm run start:sniper

# Terminal 2: Start the dashboard
npm run dashboard
```

Then open http://localhost:3001 in your browser.

---

## 🛠️ First-Time Setup

If this is your first time running the dashboard:

```bash
# Install dashboard dependencies (one-time)
npm run dashboard:install

# Then start the bot (dashboard will auto-open)
npm run start:sniper
```

---

## 📱 Dashboard Sections

### 1. Account Status (Top Left)
```
💰 Account Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Balance:    47.47 XRP
Tradable:         26.47 XRP
Locked Reserves:  20.00 XRP
Positions:        5/12 (7 available)
Health Status:    HEALTHY 🟢
```

### 2. Performance Metrics (Top Right)
```
🎯 Performance Metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Trades:     45
Winning Trades:   38
Losing Trades:    7
Win Rate:         84.4%
Total Profit:     +8.25 XRP
Avg Profit:       +0.18 XRP
```

### 3. Win/Loss Chart (Middle)
Beautiful pie chart showing:
- Green: Winning trades
- Red: Losing trades
- Center: Win rate percentage

### 4. Active Positions (Bottom Left)
Lists all positions with:
- Token symbol
- Entry price
- Current price
- Tokens held
- XRP invested
- Current value
- P/L in XRP and %

### 5. Recent Transactions (Bottom Right)
Scrollable list of recent trades:
- 🎯 Snipe buys
- 💰 Profit takes
- 🛑 Stop losses
- Timestamps and amounts

---

## 🔄 Real-Time Updates

The dashboard updates via two methods:

### 1. WebSocket (Every 5 seconds)
- Account status
- Positions
- Performance metrics
- Instant updates when trades execute

### 2. REST API (Every 10 seconds)
- Transaction history
- Historical data
- Fallback if WebSocket fails

---

## 🎨 Visual Indicators

### Colors:
- **Green**: Profits, winning trades, healthy status
- **Red**: Losses, losing trades, critical status
- **Yellow**: Warnings, neutral status
- **Blue**: Accents, active elements

### Status Dots:
- **🟢 Green Pulsing**: Connected and live
- **🔴 Red**: Disconnected

### Health Status:
- **🟢 HEALTHY**: Good balance, room for trades
- **🟡 WARNING**: Low balance or near position limit
- **🔴 CRITICAL**: Cannot trade, action needed

---

## 📊 Key Metrics Explained

### Win Rate
```
Winning Trades / Total Trades × 100
Example: 38 wins / 45 trades = 84.4%
Target: 85-90%
```

### Average Profit per Trade
```
Total Profit / Total Trades
Example: +8.25 XRP / 45 trades = +0.18 XRP
Target: +0.15 to +0.25 XRP
```

### Portfolio P/L
```
Current Value - Total Invested
Example: 28.50 XRP - 24.00 XRP = +4.50 XRP (+18.75%)
```

---

## 🔧 Configuration

### API Server
- **Port**: 3000 (bot API)
- **Endpoints**:
  - `GET /api/status` - Account info
  - `GET /api/positions` - Current positions
  - `GET /api/performance` - Metrics
  - `GET /api/transactions` - Trade history

### Dashboard Frontend
- **Port**: 3001 (React UI)
- **Framework**: Vite + React + TypeScript
- **Styling**: Custom CSS (no heavy frameworks)
- **Updates**: Every 5-10 seconds

---

## 🎮 Usage Tips

### Monitor Performance
Watch these metrics closely:
1. **Win Rate**: Should stay above 80%
2. **Trades/Hour**: Target 5-15
3. **Portfolio P/L**: Should trend upward
4. **Health Status**: Keep it green

### Adjust Strategy
If you see:
- **Win rate < 75%**: Increase profit target or min liquidity
- **No trades**: Lower min liquidity, check position limit
- **Too many stop losses**: Increase min liquidity filter

### Best Practices
1. Keep dashboard open while bot runs
2. Monitor for unusual patterns
3. Check health status regularly
4. Review transactions for errors

---

## 🛠️ Troubleshooting

### Dashboard Won't Connect
```bash
# Check if bot is running
# The API server starts automatically with the bot

# If dashboard doesn't open automatically:
npm run dashboard
```

### API Errors
```bash
# Restart both
^C  # Stop bot
npm run start:sniper  # Restart
```

### Dashboard Blank
1. Check browser console (F12)
2. Verify http://localhost:3000/api/status returns data
3. Try refreshing the page

### Port Already in Use
```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9
lsof -ti:3000 | xargs kill -9

# Restart
npm run start:sniper
```

---

## 📁 File Structure

```
xrpl-trading-bot/
├── src/
│   └── api/
│       └── server.ts           # API server & WebSocket
└── dashboard/
    ├── src/
    │   ├── App.tsx             # Main dashboard
    │   ├── App.css             # Styling
    │   └── components/
    │       ├── AccountStatus.tsx
    │       ├── PositionsList.tsx
    │       ├── PerformanceMetrics.tsx
    │       ├── PerformanceChart.tsx
    │       └── RecentTransactions.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 🎨 Customization

### Change Update Frequency

Edit `src/api/server.ts` line 104:
```typescript
}, 5000); // Update every 5 seconds (change to 3000 for faster)
```

Edit `dashboard/src/App.tsx` line 108:
```typescript
const interval = setInterval(fetchData, 10000) // Change to 5000 for faster
```

### Change Dashboard Port

Edit `dashboard/vite.config.ts`:
```typescript
server: {
  port: 3001,  // Change to any port
}
```

Don't forget to update the bot's `open()` call in `src/bot.ts` to match!

---

## 🚀 Advanced Features

### Live Trade Notifications
The dashboard receives instant WebSocket events when:
- ✅ New snipe executed
- 💰 Profit target hit
- 🛑 Stop loss triggered
- 📊 Position updated

### Auto-Refresh
- Positions update every 5 seconds
- Transactions refresh every 10 seconds
- No manual refresh needed!

### Responsive Design
- Works on desktop and mobile
- Scales to any screen size
- Touch-friendly on tablets

---

## 📊 Dashboard Preview

```
┌─────────────────────────────────────────────────────┐
│ 🚀 XRPL Trading Bot Dashboard        🟢 Live        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  💰 Account Status        🎯 Performance Metrics    │
│  ┌──────────────────┐    ┌──────────────────┐      │
│  │ Balance: 47 XRP  │    │ Trades: 45       │      │
│  │ Tradable: 26 XRP │    │ Win Rate: 84.4%  │      │
│  │ Positions: 5/12  │    │ Profit: +8.25    │      │
│  └──────────────────┘    └──────────────────┘      │
│                                                      │
│  📈 Win/Loss Chart                                   │
│  ┌────────────────────────────────────────┐         │
│  │        [PIE CHART]                     │         │
│  │        84.4% Win Rate                  │         │
│  └────────────────────────────────────────┘         │
│                                                      │
│  📊 Active Positions        📜 Recent Transactions  │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │ TOKEN1: +12.5%   │      │ 🎯 Snipe TOKEN3  │    │
│  │ TOKEN2: -3.2%    │      │ 💰 Sold TOKEN2   │    │
│  │ [...]            │      │ [...]            │    │
│  └──────────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Benefits

### Real-Time Monitoring
- See trades as they happen
- Monitor positions live
- Track performance instantly

### Better Decision Making
- Visual overview of portfolio
- Identify winning/losing patterns
- Adjust strategy based on data

### Professional Interface
- Clean, modern design
- Easy to read metrics
- No console SSH needed

### Peace of Mind
- Always know bot status
- See it's working properly
- Quick health checks

---

## 📈 Success Indicators

### Dashboard Shows Success When:
```
✅ Green status indicator pulsing
✅ Win rate above 80%
✅ Multiple active positions
✅ Regular transaction updates
✅ Portfolio P/L trending positive
✅ Health status: HEALTHY
```

---

## 🎉 Summary

The dashboard gives you:
- ✅ **Real-time visibility** into all bot activity
- ✅ **Beautiful visualizations** of performance
- ✅ **Auto-opens** when bot starts
- ✅ **Live updates** via WebSocket
- ✅ **Professional interface** for monitoring

No more SSH console hunting - just open your browser and see everything! 🚀

---

## 🚀 Next Steps

1. **Stop current bot** (Ctrl+C)
2. **Start with dashboard**: `npm run start:sniper`
3. **Dashboard auto-opens** at http://localhost:3001
4. **Watch trades** happen in real-time! 📊💰

---

**Enjoy your professional trading dashboard!** 🎉
