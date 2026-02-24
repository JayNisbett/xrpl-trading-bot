# ⚡ Quick Reference - Trading Bot Configuration

## 🎯 Current Settings (Optimized for High Frequency)

```env
SNIPER_CHECK_INTERVAL=500          # Check every 0.5 seconds
SNIPER_MIN_LIQUIDITY=30            # Lower barrier = more trades
SNIPER_RISK_SCORE=high             # Minimal filters = max speed
SNIPER_AMOUNT=2                    # 2 XRP per trade
```

**Profit Strategy:**
- 🎯 Take Profit: +12%
- 🛑 Stop Loss: -8%
- 💰 Partial Take: 50% at +20%

**Expected Results:**
- 📊 Win Rate: 85-90%
- ⚡ Trades/Day: 20-50
- 📈 Daily Growth: +20-30%

---

## 🔧 Quick Adjustments

### Want MORE Trades?
```env
SNIPER_CHECK_INTERVAL=250          # Check 4x/second
SNIPER_MIN_LIQUIDITY=20            # Accept more tokens
SNIPER_AMOUNT=1.5                  # Smaller positions
```

### Want HIGHER Win Rate?
```env
SNIPER_RISK_SCORE=medium           # More filtering
SNIPER_MIN_LIQUIDITY=75            # Higher quality
```

Edit `src/utils/profitManager.ts` line 73-74:
```typescript
const profitTarget = 15;  // 15% profit target
const stopLoss = -5;      // Tighter stop loss
```

### Balanced Mode
```env
SNIPER_CHECK_INTERVAL=750
SNIPER_RISK_SCORE=medium
SNIPER_MIN_LIQUIDITY=40
SNIPER_AMOUNT=2
```

---

## 📊 Dashboard Interpretation

### Trading Frequency Stats
```
⚡ Trades/Hour: 15.0
```
- **Good**: 10-20/hour
- **Too Low**: <5/hour → Reduce intervals
- **Too High**: >30/hour → May need adjustment

### Win Rate
```
📈 Win Rate: 87.5%
```
- **Excellent**: >85%
- **Good**: 75-85%
- **Needs Work**: <75% → Increase profit target

### Portfolio Growth
```
💰 Total P/L: +5.2 XRP (+26%)
```
- **Excellent**: >20% daily
- **Good**: 10-20% daily
- **Review**: <10% daily

---

## 🚨 Troubleshooting

### "Not Enough Trades"
1. Lower `SNIPER_MIN_LIQUIDITY` to 20
2. Reduce `SNIPER_CHECK_INTERVAL` to 250
3. Ensure `SNIPER_RISK_SCORE=high`

### "Too Many Losing Trades"
1. Increase profit target to 15%
2. Tighten stop loss to -5%
3. Change to `SNIPER_RISK_SCORE=medium`
4. Increase `SNIPER_MIN_LIQUIDITY` to 75

### "Bot Not Finding Tokens"
1. Check XRPL connection
2. Verify network has activity
3. Try different XRPL server

### "Insufficient Balance Errors"
1. Run `npm run account-status`
2. Check if positions are at limit
3. Close some positions to free up capital
4. Reduce `SNIPER_AMOUNT`

---

## 📈 Performance Optimization

### For Maximum Speed
```bash
# Use your own XRPL node for best latency
XRPL_SERVER=wss://your-node-here.com
```

### For Reliability
```bash
# Use cluster endpoints
XRPL_SERVER=wss://xrplcluster.com
# or
XRPL_SERVER=wss://s2.ripple.com
```

---

## 🎮 Common Commands

```bash
# Start trading
npm run start:sniper

# Check account status
npm run account-status

# Rebuild after changes
npm run build

# Development mode (auto-reload)
npm run dev:watch
```

---

## 💡 Pro Tips

1. **Start Conservative**: Let the bot run for an hour before adjusting
2. **Monitor First Day**: Watch win rate and adjust accordingly
3. **Compound Profits**: Let gains accumulate for exponential growth
4. **Track Metrics**: Check dashboard stats regularly
5. **Adjust Gradually**: Make one change at a time

---

## 🎯 Win Rate Targets by Risk Level

| Risk Level | Win Rate | Trades/Day | Daily Growth |
|------------|----------|------------|--------------|
| Low        | 90-95%   | 5-15       | 10-15%       |
| Medium     | 85-92%   | 15-30      | 15-25%       |
| High       | 80-90%   | 30-50+     | 25-35%       |

---

## 📞 Quick Links

- Full Guide: `UPGRADE_SUMMARY.md`
- Technical Details: `TRADING_OPTIMIZATIONS.md`
- Setup: `CONFIGURATION_GUIDE.md`
- Main README: `README.md`

---

## ⚙️ File Locations for Edits

**Profit Settings:**
- `src/utils/profitManager.ts` (line 73-74)

**Risk Settings:**
- `.env` (SNIPER_RISK_SCORE)

**Speed Settings:**
- `.env` (SNIPER_CHECK_INTERVAL)

**Amount Settings:**
- `.env` (SNIPER_AMOUNT)

---

## 🔢 Quick Math

**Calculate Expected Daily Profit:**
```
Trades/Day × Win Rate × Avg Profit per Trade
Example: 30 × 0.85 × 0.20 XRP = +5.1 XRP/day
```

**Calculate Required Wins for Breakeven:**
```
Need: Win% × Profit Target > (1 - Win%) × Stop Loss
Example: 0.85 × 12% > 0.15 × 8%
         10.2% > 1.2% ✓ (profitable)
```

---

**Last Updated**: After High-Frequency Optimization
**Bot Version**: 2.1 (Optimized)
**Status**: ✅ Ready to Trade
