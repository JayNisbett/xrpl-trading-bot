# AMM Trading Strategies Guide

## Overview
Your bot now includes sophisticated AMM (Automated Market Maker) strategies for arbitrage and yield generation through liquidity provision.

## Key Strategies

### 1. **Arbitrage Trading** 🔄
Exploit price differences between AMM pools for the same token.

**How it works:**
- Scans multiple AMM pools simultaneously
- Detects when the same token has different prices in different pools
- Executes two-step trades:
  1. Buy token from cheaper pool
  2. Immediately sell to more expensive pool
  3. Profit from the price difference

**Configuration (.env):**
```
AMM_ARBITRAGE_ENABLED=true
AMM_ARBITRAGE_MIN_PROFIT=0.5        # Minimum 0.5% profit required
AMM_ARBITRAGE_MAX_TRADE=5           # Maximum 5 XRP per arbitrage
AMM_ARBITRAGE_CHECK_INTERVAL=5000   # Check every 5 seconds
```

**Risk Level:** Low-Medium
- Profit is usually small (0.5-3%) but consistent
- Fast execution required (prices can change quickly)
- Gas fees and slippage reduce net profit

### 2. **One-Sided Liquidity Provision** 💧
Enter AMM pools with only XRP (no tokens needed).

**How it works:**
- Deposit XRP into high-yield AMM pools
- Receive LP (Liquidity Provider) tokens
- Earn trading fees from pool activity
- Exit position at any time to claim XRP + tokens + fees

**Benefits:**
- Don't need to acquire tokens beforehand
- Simpler entry/exit process
- Still earn full share of trading fees

**Configuration (.env):**
```
AMM_LIQUIDITY_ENABLED=true
AMM_LIQUIDITY_STRATEGY=one-sided    # Options: one-sided, balanced, auto
AMM_LIQUIDITY_MIN_TVL=100           # Min pool size: 100 XRP
AMM_LIQUIDITY_MAX_PRICE_IMPACT=0.05 # Max 5% price impact
AMM_LIQUIDITY_TARGET_APR=20         # Target 20% annual returns
AMM_LIQUIDITY_MAX_POSITIONS=5       # Max 5 simultaneous positions
```

**Risk Level:** Medium
- Impermanent loss risk (if token price changes dramatically)
- Liquidity can be locked during high volatility
- Pool quality varies significantly

### 3. **Balanced Liquidity Provision** ⚖️
Provide both XRP and tokens in correct proportions.

**How it works:**
- Deposits both assets proportionally to pool
- Lower slippage on entry
- Better for larger position sizes
- Requires holding tokens beforehand

**When to use:**
- Already holding tokens from sniper/arbitrage
- Larger deposits (>5 XRP)
- Stable, high-TVL pools

### 4. **Yield Farming** 🌾
Actively manage LP positions for maximum returns.

**Features:**
- Monitors all active LP positions in real-time
- Tracks APR, fees earned, and impermanent loss
- Auto-exits positions when:
  - APR drops below target
  - Impermanent loss exceeds threshold
  - Better opportunities emerge
- Takes partial profits on high-performing positions

**Risk Management:**
```
AMM_RISK_MAX_IL=10                  # Max 10% impermanent loss
AMM_RISK_MAX_POSITION_SIZE=3        # Max 3 XRP per position
AMM_RISK_DIVERSIFICATION=true       # Spread across multiple pools
```

## How AMM Strategies Work Together

### Combined Strategy Flow:
1. **Arbitrage Bot** scans for immediate profit opportunities
   - Executes quick 2-step trades for instant profit
   - No position holding required

2. **Pool Scanner** discovers high-yield liquidity pools
   - Analyzes TVL, APR, fees, depth
   - Ranks pools by profitability

3. **Liquidity Provider** enters profitable pools
   - One-sided entry with spare XRP
   - Earns passive income from trading fees

4. **Position Monitor** manages active LP positions
   - Tracks performance metrics
   - Auto-exits underperforming positions
   - Compounds profits into new opportunities

### Risk Management
- **Position Limits:** Max positions and position sizes prevent overexposure
- **Impermanent Loss Protection:** Auto-exit if IL exceeds threshold
- **Diversification:** Spread capital across multiple pools
- **Quality Filters:** Only enter pools meeting TVL, depth, and APR criteria

## Pool Quality Metrics

### TVL (Total Value Locked)
- **High (>500 XRP):** Very liquid, low slippage, safer
- **Medium (100-500 XRP):** Balanced risk/reward
- **Low (<100 XRP):** High slippage, risky, skip

### APR (Annual Percentage Rate)
- **High (>30%):** Excellent but may have higher IL risk
- **Medium (15-30%):** Good balanced returns
- **Low (<15%):** Generally not worth the IL risk

### Price Impact
- **Low (<2%):** Deep liquidity, efficient trading
- **Medium (2-5%):** Acceptable for smaller positions
- **High (>5%):** High slippage, avoid

### Liquidity Depth
Amount of XRP tradeable before 1% slippage:
- **Deep (>50 XRP):** Professional-grade pool
- **Medium (10-50 XRP):** Acceptable
- **Shallow (<10 XRP):** High risk

## Impermanent Loss Explained

When you provide liquidity, you're exposed to **impermanent loss** if token prices change.

**Example:**
- You deposit 10 XRP + 100 tokens (total value: 20 XRP)
- Token price doubles
- Your position is now worth 18 XRP (you "lost" 2 XRP compared to just holding)
- BUT you earned 3 XRP in trading fees
- Net result: 1 XRP profit

**Mitigation:**
- Enter pools with stable prices
- Exit quickly if price diverges significantly
- Earn enough fees to offset IL
- Use one-sided entries to reduce exposure

## Best Practices

### For Arbitrage:
1. ✅ Fast execution is critical
2. ✅ Start with small amounts (1-2 XRP)
3. ✅ Monitor gas fees and slippage
4. ✅ Don't chase disappearing opportunities

### For Liquidity Provision:
1. ✅ Choose high-APR pools (>20%)
2. ✅ Start with one-sided entries (simpler)
3. ✅ Monitor impermanent loss daily
4. ✅ Exit if APR drops or IL spikes
5. ✅ Diversify across 3-5 pools

### For Yield Farming:
1. ✅ Compound profits into new positions
2. ✅ Rebalance weekly based on performance
3. ✅ Track fees earned vs. IL
4. ✅ Set alerts for position changes

## Dashboard Features

### AMM Pools Page:
- View all available pools with metrics
- See active LP positions
- Enter/exit pools with one click
- Monitor arbitrage statistics
- Track fees and APR in real-time

### Real-time Updates:
- Position values update every 30 seconds
- Arbitrage opportunities broadcast instantly
- Fee earnings tracked continuously
- Toast notifications for trades

## Getting Started

1. **Enable AMM Bot in .env:**
   ```
   AMM_BOT_ENABLED=true
   ```

2. **Choose Your Strategy:**
   - Conservative: `AMM_LIQUIDITY_STRATEGY=balanced`
   - Aggressive: `AMM_LIQUIDITY_STRATEGY=one-sided`

3. **Set Risk Parameters:**
   - Start with `AMM_RISK_MAX_POSITION_SIZE=2`
   - Increase as you gain confidence

4. **Monitor Dashboard:**
   - Visit http://localhost:3001/amm
   - Watch arbitrage stats
   - Track LP position performance

5. **Iterate and Optimize:**
   - Adjust APR targets based on results
   - Fine-tune position sizes
   - Experiment with different pools

## Expected Returns

### Conservative (Balanced LP):
- APR Target: 15-25%
- Strategy: Large, stable pools only
- Risk: Low impermanent loss
- Time: Long-term positions (weeks)

### Balanced (One-sided LP):
- APR Target: 20-35%
- Strategy: Medium pools with good volume
- Risk: Moderate IL, good fees
- Time: Medium-term (days to weeks)

### Aggressive (Arbitrage Focus):
- APR Target: 30-50%
- Strategy: High-frequency arbitrage + small LP positions
- Risk: Execution risk, some IL
- Time: Short-term (hours to days)

## Monitoring & Optimization

### Daily:
- Check arbitrage success rate (should be >70%)
- Review LP position APRs
- Exit positions with high IL (>8%)

### Weekly:
- Analyze total returns vs. simple holding
- Rebalance positions to highest APR pools
- Adjust risk parameters based on results

### Monthly:
- Compare AMM returns vs. sniper returns
- Optimize allocation between strategies
- Add new high-quality pools to scanner

## Troubleshooting

### Low Arbitrage Opportunities:
- Markets are efficient (this is normal)
- Increase scan frequency
- Lower minimum profit threshold

### High Impermanent Loss:
- Exit volatile positions quickly
- Choose more stable tokens
- Use smaller position sizes

### Low APR:
- Pool volume may be low
- Switch to higher-volume pools
- Consider increasing trading fees matter

### Position Not Exiting:
- May be locked temporarily
- Check pool liquidity
- Try again in 1-2 minutes

## Safety Notes

⚠️ **Always start small** - Test with 1-2 XRP first
⚠️ **Monitor impermanent loss** - Exit if it exceeds your threshold
⚠️ **Don't over-leverage** - Keep reserve XRP for gas and opportunities
⚠️ **Diversify** - Don't put all capital in one pool
⚠️ **Watch the market** - AMM strategies work best in active markets

## Next Steps

The AMM system is now live! The bot will:
1. ✅ Scan for arbitrage opportunities every 5 seconds
2. ✅ Enter profitable LP positions automatically
3. ✅ Monitor and manage all positions
4. ✅ Exit underperforming positions
5. ✅ Track all metrics in the dashboard

Your bot is now a sophisticated AMM trader with multiple yield-generating strategies running simultaneously!
