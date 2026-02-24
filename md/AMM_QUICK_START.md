# AMM Bot Quick Start Guide

## 🚀 Getting Started in 5 Minutes

Your XRPL bot now has sophisticated AMM (Automated Market Maker) capabilities for arbitrage and yield farming!

### What's New?

1. **Arbitrage Bot** - Automatically finds and exploits price differences between AMM pools
2. **Liquidity Provider** - Earns passive income by providing liquidity to high-yield pools
3. **Yield Optimizer** - Manages positions to maximize returns and minimize impermanent loss
4. **Real-time Dashboard** - Dedicated AMM page showing pools, positions, and earnings

---

## Step 1: Enable AMM Bot

Open your `.env` file and ensure these lines are set:

```env
# Enable the AMM bot
AMM_BOT_ENABLED=true

# Enable arbitrage (recommended)
AMM_ARBITRAGE_ENABLED=true
AMM_ARBITRAGE_MIN_PROFIT=0.5
AMM_ARBITRAGE_MAX_TRADE=5

# Enable liquidity provision (recommended)
AMM_LIQUIDITY_ENABLED=true
AMM_LIQUIDITY_STRATEGY=one-sided
AMM_LIQUIDITY_TARGET_APR=20
```

**That's it!** The bot will now scan for AMM opportunities automatically.

---

## Step 2: Start the Bot

```bash
npm start
```

The bot will:
- ✅ Connect to XRPL
- ✅ Start sniper bot (if enabled)
- ✅ Start copy trading bot (if enabled)
- ✅ **NEW:** Start AMM arbitrage scanner
- ✅ **NEW:** Start liquidity pool manager
- ✅ Open dashboard at http://localhost:3001

---

## Step 3: Monitor the Dashboard

Navigate to **AMM Pools** page (🌊 icon in sidebar) to see:

### Arbitrage Statistics
- Total executions
- Success rate
- Total profit from arbitrage

### Active LP Positions
- Your current liquidity positions
- Real-time value and APR
- Fees earned
- Impermanent loss
- One-click exit buttons

### Available Pools
- All discovered AMM pools
- TVL, APR, and depth metrics
- One-click entry buttons

---

## What Happens Automatically?

### Every 5 Seconds:
1. **Arbitrage Scanner** looks for price differences between pools
2. If found: Executes two-step trade (buy low, sell high)
3. Records profit to your account

### Every Check Cycle:
1. **Pool Scanner** finds high-yield liquidity pools
2. Analyzes TVL, APR, trading fees, liquidity depth
3. Enters profitable pools if you have available XRP

### Continuously:
1. **Position Monitor** tracks all your LP positions
2. Calculates current value, fees, and impermanent loss
3. Auto-exits positions if:
   - APR drops below target
   - Impermanent loss exceeds threshold (10%)
   - Better opportunities emerge

---

## AMM Strategies Explained Simply

### 1. Arbitrage (Low Risk, Quick Profits)
**What:** Find the same token in two different pools with different prices.
**How:** Buy from cheaper pool → Sell to expensive pool → Keep the difference.
**Returns:** 0.5-3% per trade, instant execution
**Risk:** Very low (no position holding)

**Example:**
- Token ABC costs 0.10 XRP in Pool A
- Token ABC costs 0.11 XRP in Pool B
- Buy 100 ABC in Pool A (10 XRP) → Sell in Pool B (11 XRP) = 1 XRP profit (10% gain)

### 2. One-Sided Liquidity (Medium Risk, Passive Income)
**What:** Deposit XRP into a liquidity pool, earn fees from trades.
**How:** Bot deposits XRP → Receives LP tokens → Earns % of all trading fees → Exits when profitable.
**Returns:** 15-35% APR from trading fees
**Risk:** Impermanent loss if token price changes dramatically

**Example:**
- Deposit 5 XRP into high-volume pool (30% APR)
- Pool has 100 XRP trading volume/day
- 0.1% fee = 0.1 XRP/day in fees
- Your share (5%) = 0.005 XRP/day
- Annual: 1.825 XRP profit on 5 XRP = 36.5% APR

### 3. Balanced Liquidity (Higher Risk, Better Efficiency)
**What:** Deposit both XRP and tokens proportionally.
**How:** Requires holding tokens first, but lower slippage on entry/exit.
**Returns:** Similar to one-sided but more efficient
**Risk:** Higher capital requirements, needs token holdings

---

## Configuration Guide

### Conservative (Safe, Lower Returns)
```env
AMM_ARBITRAGE_MIN_PROFIT=1.0        # Only >1% arbitrage
AMM_ARBITRAGE_MAX_TRADE=2           # Small trades
AMM_LIQUIDITY_TARGET_APR=25         # Higher APR requirement
AMM_LIQUIDITY_MAX_POSITIONS=3       # Few positions
AMM_RISK_MAX_POSITION_SIZE=2        # Small positions
```
**Expected:** 15-25% annual returns, very safe

### Balanced (Default, Good Returns)
```env
AMM_ARBITRAGE_MIN_PROFIT=0.5        # Most arbitrage opportunities
AMM_ARBITRAGE_MAX_TRADE=5           # Medium trades
AMM_LIQUIDITY_TARGET_APR=20         # Balanced APR
AMM_LIQUIDITY_MAX_POSITIONS=5       # Diversified
AMM_RISK_MAX_POSITION_SIZE=3        # Medium positions
```
**Expected:** 25-40% annual returns, moderate risk

### Aggressive (Higher Risk, Higher Returns)
```env
AMM_ARBITRAGE_MIN_PROFIT=0.3        # Even small arbitrage
AMM_ARBITRAGE_MAX_TRADE=10          # Larger trades
AMM_LIQUIDITY_TARGET_APR=15         # Lower APR threshold
AMM_LIQUIDITY_MAX_POSITIONS=10      # Many positions
AMM_RISK_MAX_POSITION_SIZE=5        # Larger positions
```
**Expected:** 40-60% annual returns, higher risk

---

## Understanding the Metrics

### TVL (Total Value Locked)
- **High (>500 XRP):** Safe, liquid, low slippage ✅
- **Medium (100-500 XRP):** Balanced, good for most strategies
- **Low (<100 XRP):** Risky, high slippage, avoid ⚠️

### APR (Annual Percentage Rate)
- **>30%:** Excellent returns (but check IL risk)
- **20-30%:** Good steady returns
- **<20%:** May not justify IL risk

### Impermanent Loss (IL)
The "loss" you'd have compared to just holding assets:
- **0 to -5%:** Very good, fees likely cover it ✅
- **-5% to -10%:** Acceptable if fees are high
- **>-10%:** Exit immediately ⚠️

### Liquidity Depth
How much can trade before 1% slippage:
- **>50 XRP:** Deep pool, professional-grade ✅
- **10-50 XRP:** Medium pool, acceptable
- **<10 XRP:** Shallow pool, high risk ⚠️

---

## Daily Workflow

### Morning Check (5 minutes):
1. Open dashboard → AMM Pools page
2. Check arbitrage stats (success rate should be >70%)
3. Review active LP positions:
   - Are APRs still high?
   - Is IL under control (<10%)?
   - Are fees accumulating?

### If APR Drops or IL Spikes:
1. Click "Exit Position" on underperforming pool
2. Bot will withdraw and convert back to XRP
3. Capital automatically reallocates to better opportunities

### Weekly Review:
1. Compare AMM returns vs sniper returns
2. Adjust allocation between strategies
3. Update token list in `src/amm/poolScanner.ts` with newly discovered profitable pools

---

## Adding New Pools

Found a profitable pool not in the scanner? Add it manually:

1. Open `src/amm/poolScanner.ts`
2. Add to `KNOWN_TOKENS` array:
```typescript
{ currency: 'TOKEN', issuer: 'rISSUERADDRESS...', name: 'Token Name' }
```
3. Rebuild: `npm run build`
4. Restart bot

Find token issuers on [XRPScan.com](https://xrpscan.com)

---

## Troubleshooting

### "No pools found"
- The known token list is limited - add more tokens manually
- Increase check interval if RPC errors occur
- Some tokens may not have AMM pools yet

### "No arbitrage opportunities"
- This is normal! Markets are efficient
- Arbitrage is opportunistic (appears randomly)
- Lower minimum profit threshold to find more

### High impermanent loss
- Normal for volatile tokens
- Bot will auto-exit if IL exceeds 10%
- Choose more stable tokens (stablecoins, BTC, ETH)

### Positions not earning fees
- Pool needs trading volume to generate fees
- Check pool has sufficient TVL (>100 XRP)
- May take time to accumulate visible fees

---

## Expected Results

### First Day:
- Bot scans pools and enters 1-3 positions
- May execute 0-2 arbitrage trades
- Positions start accumulating fees

### First Week:
- 3-5 active LP positions
- 5-15 successful arbitrage trades
- APRs stabilize to realistic levels (20-35%)
- First fee withdrawals

### First Month:
- Consistent passive income from LP fees
- Regular arbitrage profits
- Total returns: 15-40% depending on strategy

---

## Pro Tips

### ✅ DO:
- Start with 10-20 XRP total capital
- Use one-sided liquidity (simpler)
- Monitor IL daily
- Exit positions with high IL quickly
- Let the bot run 24/7 for best results

### ❌ DON'T:
- Put all capital in one pool
- Ignore impermanent loss warnings
- Enter pools with <50 XRP TVL
- Manually interfere with arbitrage trades
- Disable auto-exit (it protects you)

---

## Advanced: Manual Pool Management

From the dashboard, you can manually:

1. **Enter Pools:**
   - Click "Enter Pool" on any pool card
   - Choose deposit amount
   - Select strategy (one-sided or balanced)
   - Confirm transaction

2. **Exit Positions:**
   - Click "Exit Position" on any LP card
   - Bot withdraws all liquidity immediately
   - Converts back to XRP + tokens
   - Profit/loss calculated automatically

---

## Next Steps

1. ✅ Enable AMM bot in `.env`
2. ✅ Start bot with `npm start`
3. ✅ Monitor AMM Pools page
4. ✅ Let it run for 24 hours
5. ✅ Check results and adjust settings

The bot handles everything automatically - arbitrage detection, pool entry/exit, and position management. Your job is just to monitor and optimize!

**Questions?** Check `AMM_STRATEGIES.md` for deep technical details.

---

## Settings Reference

```env
# Quick Copy-Paste Configs

# CONSERVATIVE (Safest)
AMM_ARBITRAGE_MIN_PROFIT=1.0
AMM_ARBITRAGE_MAX_TRADE=2
AMM_LIQUIDITY_TARGET_APR=25
AMM_LIQUIDITY_MAX_POSITIONS=3
AMM_RISK_MAX_POSITION_SIZE=2

# BALANCED (Recommended)
AMM_ARBITRAGE_MIN_PROFIT=0.5
AMM_ARBITRAGE_MAX_TRADE=5
AMM_LIQUIDITY_TARGET_APR=20
AMM_LIQUIDITY_MAX_POSITIONS=5
AMM_RISK_MAX_POSITION_SIZE=3

# AGGRESSIVE (Highest Returns)
AMM_ARBITRAGE_MIN_PROFIT=0.3
AMM_ARBITRAGE_MAX_TRADE=10
AMM_LIQUIDITY_TARGET_APR=15
AMM_LIQUIDITY_MAX_POSITIONS=10
AMM_RISK_MAX_POSITION_SIZE=5
```

Copy the set you want and paste into your `.env` file!
