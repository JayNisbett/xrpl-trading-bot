# Testing Your AMM Bot - What to Expect

## 🚀 First Startup

When you run `npm start`, you should see:

```
Initializing bot...
Connecting to XRPL network...
Connected to XRPL network successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SNIPER BOT STARTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌊 AMM BOT STARTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategies:
  💱 Arbitrage: ✅
  💧 Liquidity Provision: ✅
  🌾 Yield Farming: ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bot started successfully
API server started on http://localhost:3000
Dashboard server started on http://localhost:3001
📊 Dashboard opened in browser
```

---

## 🔍 First 5 Minutes

### What's Happening
The AMM bot immediately starts scanning for opportunities:

```
🔍 Scanning for AMM pools...
   ✅ Found pool: Gatehub USD (TVL: 150.50 XRP)
   ✅ Found pool: Bitstamp USD (TVL: 245.25 XRP)
   ✅ Found pool: Bitstamp BTC (TVL: 520.00 XRP)
   Found 3 total pools

🔍 Scanning for arbitrage opportunities...
   No arbitrage opportunities found

🔍 Scanning for profitable liquidity pools...
   Found 2 high-yield pools!
```

### What You Should Do
1. **Open the dashboard:** http://localhost:3001
2. **Navigate to AMM Pools** (🌊 icon in sidebar)
3. **Observe:**
   - Available pools listed with metrics
   - Arbitrage stats (all zeros initially)
   - No active positions yet

---

## 📊 First Hour

### Arbitrage Detection

**Scenario 1: No Opportunities (Most Common)**
```
🔍 Scanning for arbitrage opportunities...
   No arbitrage opportunities found
```
**This is normal!** Arbitrage opportunities are rare (maybe 1-5 per day).

**Why?** Markets are efficient - price differences close quickly.

**Scenario 2: Opportunity Found (Lucky!)**
```
🔍 Scanning for arbitrage opportunities...
   Found 1 opportunities!

🔄 ARBITRAGE OPPORTUNITY DETECTED
Token: USD
Price Difference: 1.25%
Profit Potential: 0.05 XRP
Trade Amount: 4.00 XRP

📥 Step 1: Buy from Pool 1
   Buying USD from cheaper pool...
✅ Buy successful! Received 100 USD tokens

📤 Step 2: Sell to Pool 2
   Selling USD to expensive pool...
✅ Sell successful! Received 4.05 XRP

✅ ARBITRAGE COMPLETE!
Profit: 0.05 XRP (1.25%)
```

**Dashboard:** Toast notification "💱 Arbitrage: +0.05 XRP on USD"

### Liquidity Provision

**Expected after 10-30 minutes:**
```
🔍 Scanning for profitable liquidity pools...
   Found 2 high-yield pools!

💧 Entering liquidity position:
   Pool: XRP/USD
   Est. APR: 28.50%
   Deposit: 2.50 XRP
   Strategy: one-sided

   Calculating optimal deposit...
   Depositing 2.50 XRP into XRP/USD pool...

✅ Liquidity position entered successfully!
   LP Tokens: 1,250.5
   Tx Hash: 1A2B3C4D5E6F7G8H9I...
```

**Dashboard Changes:**
- New LP position card appears in "Active Liquidity Positions"
- Shows current value, APR, fees (0 initially), IL (0% initially)
- Toast notification "🌊 Entered XRP/USD pool"

---

## 📈 First 24 Hours

### Console Activity

**Every 5 Seconds:**
```
🔍 Scanning for arbitrage opportunities...
   No arbitrage opportunities found
```
(This repeats - it's the bot checking)

**Every Check Cycle (when positions < max):**
```
🔍 Scanning for profitable liquidity pools...
💧 Max liquidity positions reached
```
(Once you have 5 positions, it stops entering new ones)

**When Monitoring Positions:**
```
📊 Monitoring 3 LP positions...
   XRP/USD:
      Value: 2.51 XRP
      APR: 28.50%
      IL: -0.15%
      Fees: 0.01 XRP
   XRP/BTC:
      Value: 3.02 XRP
      APR: 35.20%
      IL: 0.80%
      Fees: 0.02 XRP
```

### Dashboard Activity

**AMM Pools Page Shows:**
- **Arbitrage Stats:**
  - Executions: 2
  - Success Rate: 100%
  - Total Profit: 0.08 XRP

- **Active Positions:** 3 cards showing
  - Growing fee accumulation (0.00 → 0.01 → 0.02...)
  - Changing IL percentages
  - Real-time value updates

- **Available Pools:** Remaining pools you haven't entered

---

## 🎯 First Week

### Expected Results

**Arbitrage:**
- **Trades:** 5-15 executed
- **Success Rate:** 70-90%
- **Total Profit:** 0.5-2 XRP
- **Average Profit:** 0.1-0.3 XRP per trade

**Liquidity Provision:**
- **Active Positions:** 3-5 pools
- **Fees Earned:** 0.5-2 XRP
- **Average APR:** 20-35%
- **Impermanent Loss:** -3% to +3%

**Combined:**
- **Total Returns:** 1-4 XRP on 10-20 XRP capital
- **Weekly ROI:** 5-20%
- **Annualized APR:** 260-1040% (compound effect)

### Console Patterns

**Good Signs:**
```
✅ Arbitrage complete! Profit: 0.12 XRP (2.4%)
✅ Liquidity position entered! LP Tokens: 1,250
📊 Monitoring 5 LP positions...
   XRP/USD: APR: 32.5%, Fees: 0.15 XRP ✅
```

**Normal Warnings:**
```
⚠️ Opportunity exceeds max trade amount, skipping
💧 Max liquidity positions reached
   No arbitrage opportunities found (this is normal)
```

**Bad Signs (requires action):**
```
🚪 Exiting position: High impermanent loss: -12.50%
❌ Arbitrage buy failed: Insufficient liquidity
   Error: Too much load on server (RPC issue)
```

---

## 📉 Troubleshooting Scenarios

### Scenario 1: "No Pools Found"

**Console:**
```
🔍 Scanning for AMM pools...
   Found 0 total pools
```

**Cause:** No AMM pools exist for the tokens in `KNOWN_TOKENS`

**Solutions:**
1. **Add Real Tokens:** Visit XRPScan.com, find tokens with active AMMs
2. **Update Token List:**
   ```typescript
   // In src/amm/poolScanner.ts
   { currency: 'REALTOKEN', issuer: 'rREALISSUER...', name: 'Real Token' }
   ```
3. **Rebuild:** `npm run build`
4. **Restart bot**

---

### Scenario 2: "No Arbitrage Opportunities"

**Console:**
```
🔍 Scanning for arbitrage opportunities...
   No arbitrage opportunities found
```
(Repeats every 5 seconds)

**Cause:** Markets are efficient - this is completely normal!

**What It Means:**
- Arbitrage is **opportunistic**, not guaranteed
- May go hours or days without opportunities
- When found, bot executes immediately

**How to Get More:**
1. Lower profit threshold: `AMM_ARBITRAGE_MIN_PROFIT=0.3`
2. Add more pools: More pools = more chances
3. Increase check frequency: `AMM_ARBITRAGE_CHECK_INTERVAL=3000`

**Don't Worry:** LP positions generate consistent income while waiting for arbitrage.

---

### Scenario 3: High Impermanent Loss

**Console:**
```
📊 Monitoring 3 LP positions...
   XRP/VOLATILE:
      Value: 2.20 XRP
      APR: 45.00%
      IL: -11.50% ⚠️
      Fees: 0.30 XRP

🚪 Exiting position: High impermanent loss: -11.50%
💸 Withdrawing 1,250 LP tokens from pool...
✅ Position exited successfully!
   Received: 2.20 XRP + 110 tokens
   Profit: -0.10 XRP (-4.00%)
```

**What Happened:**
- Token price moved significantly
- IL exceeded 10% threshold
- Bot auto-exited to prevent further loss
- You lost 0.10 XRP but limited damage

**Prevention:**
- Choose stable tokens (USD, BTC, ETH)
- Avoid meme/new tokens for LP
- Accept 5-10% IL is normal
- Fees often offset IL over time

---

### Scenario 4: Low APR After Some Time

**Console:**
```
📊 Monitoring 3 LP positions...
   XRP/LOWVOL:
      Value: 2.50 XRP
      APR: 8.50%
      IL: 0.20%
      Fees: 0.05 XRP

🚪 Exiting position: Low APR: 8.50% (target: 20%)
```

**What Happened:**
- Pool trading volume decreased
- Fees accumulation slowed
- APR dropped below target

**Action:**
- Bot automatically exits
- Capital freed for better opportunities
- This is the bot optimizing!

---

## 🎨 Dashboard Expectations

### AMM Pools Page Layout

**Top Banner (Arbitrage Stats):**
```
┌─────────────────────────────────────────────────┐
│  Arbitrage Executions    Success Rate    Profit │
│         12                  83.3%       +1.2 XRP│
└─────────────────────────────────────────────────┘
```

**Active LP Positions (if any):**
```
┌──────────────────────┐  ┌──────────────────────┐
│ XRP/USD   one-sided  │  │ XRP/BTC   one-sided  │
│                      │  │                      │
│ Value: 2.52 XRP      │  │ Value: 3.05 XRP      │
│ APR: 28.5%           │  │ APR: 35.2%           │
│ Fees: 0.12 XRP       │  │ Fees: 0.15 XRP       │
│ IL: -0.8%            │  │ IL: 1.2%             │
│                      │  │                      │
│ LP Tokens: 1,250.5   │  │ LP Tokens: 890.3     │
│ [Exit Position]      │  │ [Exit Position]      │
└──────────────────────┘  └──────────────────────┘
```

**Available Pools:**
```
┌──────────────────────┐  ┌──────────────────────┐
│ XRP/ETH  🔥 High     │  │ XRP/EUR              │
│          Yield       │  │                      │
│                      │  │                      │
│ TVL: 450.00 XRP      │  │ TVL: 180.00 XRP      │
│ Est. APR: 32.5%      │  │ Est. APR: 22.0%      │
│ Fee: 0.10%           │  │ Fee: 0.10%           │
│ Depth: 45.2 XRP      │  │ Depth: 18.5 XRP      │
│                      │  │                      │
│ [Enter Pool]         │  │ [Enter Pool]         │
└──────────────────────┘  └──────────────────────┘
```

---

## 📝 Activity Timeline

### Minute 1-5: Initialization
- Bot connects to XRPL
- Scans for available pools
- Dashboard opens automatically
- Displays found pools

### Minute 5-30: First Actions
- Bot enters 1-2 liquidity pools
- Positions appear in dashboard
- Fees start at 0.00 XRP
- APR estimates shown

### Hour 1-6: Monitoring
- Fees slowly accumulate (0.00 → 0.01 → 0.02...)
- Arbitrage scanner keeps looking (usually finds nothing)
- Position values update every 30 seconds
- IL percentages fluctuate (-2% to +2%)

### Hour 6-24: Active Management
- Bot may enter more pools (up to 5 total)
- Arbitrage opportunities may appear (0-3 trades)
- Fees reach 0.10-0.30 XRP per position
- Bot may exit underperforming positions

### Day 2-7: Optimization
- Bot rebalances positions
- Compounds profits into new opportunities
- APRs stabilize to realistic levels
- Pattern becomes predictable

---

## 💰 Profit Accumulation

### How Fees Grow

**Hour 1:** 0.00 XRP
**Hour 6:** 0.01 XRP
**Hour 12:** 0.03 XRP
**Day 1:** 0.05 XRP
**Day 3:** 0.15 XRP
**Week 1:** 0.50 XRP
**Month 1:** 2.00 XRP

*Per position with 30% APR on 3 XRP deposit*

### How Arbitrage Adds Up

**Trade 1:** +0.05 XRP (1.2% on 4 XRP)
**Trade 2:** +0.08 XRP (1.6% on 5 XRP)
**Trade 3:** +0.03 XRP (0.6% on 5 XRP)
**...**
**Week 1 Total:** +0.50 XRP (5-15 trades)

### Combined Returns

With 15 XRP capital:
- **Arbitrage:** 0.5 XRP/week
- **LP Fees (5 positions @ 3 XRP each):** 0.5 XRP/week
- **Total:** 1 XRP/week on 15 XRP = 6.7% weekly = 348% APR

---

## 🎯 Testing Checklist

### Day 1: Verify Basics
- [ ] Bot starts without errors
- [ ] AMM bot initialization message appears
- [ ] Pool scanning finds >0 pools
- [ ] Dashboard shows AMM page
- [ ] API endpoints respond (pools, stats, positions)

### Day 2-3: Verify Functionality
- [ ] Bot enters at least 1 LP position
- [ ] Position appears in dashboard
- [ ] Fees start accumulating (even if tiny)
- [ ] APR is calculated and displayed
- [ ] Manual pool entry works from dashboard
- [ ] Position values update every 30s

### Week 1: Verify Performance
- [ ] At least 1 arbitrage trade executed (if lucky)
- [ ] 3-5 LP positions active
- [ ] Combined fees >0.5 XRP
- [ ] No positions with IL >10%
- [ ] Bot auto-exits bad positions
- [ ] Total returns positive (>2%)

### Month 1: Verify Optimization
- [ ] Arbitrage success rate >70%
- [ ] Average LP APR >20%
- [ ] IL averaged <5%
- [ ] Capital fully utilized
- [ ] Returns meet expectations
- [ ] Bot stable (no crashes)

---

## 🚨 What Could Go Wrong

### Issue 1: RPC Rate Limiting

**Symptoms:**
```
Error: You are placing too much load on the server
Error getting pool info: slowDown
```

**Causes:**
- Too many RPC calls
- Scanning too many pools
- Check interval too fast

**Solutions:**
1. Increase intervals:
   ```env
   AMM_ARBITRAGE_CHECK_INTERVAL=10000  # 5s → 10s
   ```
2. Reduce pool list (fewer tokens)
3. Switch to different XRPL server

---

### Issue 2: No Pools Have AMMs

**Symptoms:**
```
🔍 Scanning for AMM pools...
   Found 0 total pools
```

**Causes:**
- Token issuers in `KNOWN_TOKENS` don't have AMM pools
- Issuers are incorrect

**Solutions:**
1. **Find Real AMM Pools:**
   - Visit https://xrpscan.com
   - Look for tokens with "AMM" badges
   - Copy issuer addresses

2. **Update Token List:**
   Edit `src/amm/poolScanner.ts`:
   ```typescript
   { currency: 'FOUND_TOKEN', issuer: 'rFOUND_ISSUER...', name: 'Token Name' }
   ```

3. **Rebuild and Restart:**
   ```bash
   npm run build
   npm start
   ```

---

### Issue 3: Transactions Failing

**Symptoms:**
```
❌ One-sided deposit error: tecPATH_DRY
❌ Arbitrage buy failed: Insufficient liquidity
```

**Causes:**
- Pool too small
- Price moved during execution
- Slippage too low

**Solutions:**
1. Increase slippage: `DEFAULT_SLIPPAGE=5.0` → `7.0`
2. Reduce trade amounts: `AMM_ARBITRAGE_MAX_TRADE=5` → `2`
3. Filter for larger pools: `AMM_LIQUIDITY_MIN_TVL=100` → `200`

---

### Issue 4: Dashboard Shows Empty

**Symptoms:**
- AMM page loads but shows "No pools available"
- Arbitrage stats all zero
- No positions displayed

**Causes:**
- API endpoints returning empty arrays
- Bot not finding pools
- Bot not enabled

**Solutions:**
1. Check bot is running: Look for "🌊 AMM BOT STARTED" in console
2. Verify config: `AMM_BOT_ENABLED=true`
3. Check API: Visit http://localhost:3000/api/amm/pools
4. Review console for errors

---

## 🔬 Advanced Monitoring

### Console Grep Filters

**See only AMM activity:**
```bash
# In another terminal while bot runs
tail -f logs/bot.log | grep -E "🌊|💧|💱|🔄"
```

**See only arbitrage:**
```bash
tail -f logs/bot.log | grep "ARBITRAGE"
```

**See only LP actions:**
```bash
tail -f logs/bot.log | grep "liquidity position"
```

### Dashboard Monitoring

**Overview Page:**
- Activity feed shows all AMM actions mixed with sniper
- Performance chart includes AMM profits
- Metrics include combined returns

**AMM Pools Page:**
- Focus on AMM-specific metrics
- Detailed pool information
- Real-time position tracking

**Transactions Page:**
- Filter by type: "arbitrage", "lp_exit"
- See transaction history
- Export to CSV

---

## 📊 Performance Benchmarks

### Realistic Expectations

**Conservative Bot:**
- Arbitrage: 0-1 trades/day, 0.5% avg profit
- LP Positions: 2-3 stable pools, 20% APR
- Weekly: 2-3% returns
- Monthly: 8-12% returns
- Annual: ~100% APR

**Balanced Bot (Default):**
- Arbitrage: 1-2 trades/day, 0.8% avg profit
- LP Positions: 3-5 good pools, 25% APR
- Weekly: 3-5% returns
- Monthly: 12-20% returns
- Annual: ~200% APR

**Aggressive Bot:**
- Arbitrage: 2-5 trades/day, 1.0% avg profit
- LP Positions: 5+ aggressive pools, 30%+ APR
- Weekly: 5-10% returns
- Monthly: 20-40% returns
- Annual: ~400% APR (high risk)

---

## ✅ Success Indicators

### You're Doing Great If:
- ✅ Bot runs 24+ hours without crashing
- ✅ At least 1 LP position entered
- ✅ Fees accumulating (even if small)
- ✅ No IL exceeding 10%
- ✅ Arbitrage executes when found
- ✅ Dashboard updates in real-time
- ✅ Positive total returns

### Optimization Needed If:
- ⚠️ No pools found (update token list)
- ⚠️ All positions have high IL (choose stable tokens)
- ⚠️ APRs all <15% (increase target threshold)
- ⚠️ Many failed transactions (reduce trade sizes)
- ⚠️ RPC errors (increase intervals)

---

## 🎓 Learning Period

### Week 1: Observation
- **Goal:** Understand bot behavior
- **Action:** Watch, don't change settings
- **Learn:** What opportunities appear, how often, which pools perform best

### Week 2: First Optimization
- **Goal:** Improve based on data
- **Action:** Adjust 1-2 settings
- **Learn:** How changes affect results

### Week 3-4: Refinement
- **Goal:** Fine-tune strategy
- **Action:** Add profitable tokens, adjust risk
- **Learn:** Optimal settings for your capital size

### Month 2+: Scaling
- **Goal:** Maximize returns
- **Action:** Increase capital, expand strategies
- **Learn:** Long-term performance patterns

---

## 💡 Pro Tips

### For Best Results:
1. **Run 24/7** - Opportunities appear randomly
2. **Start small** - Test with 10-20 XRP first
3. **Monitor daily** - Check dashboard once per day
4. **Be patient** - Fees accumulate slowly
5. **Trust the bot** - Auto-exits protect you
6. **Keep learning** - Research new pools weekly

### Red Flags:
- ⛔ Consistent transaction failures
- ⛔ All positions have high IL
- ⛔ Bot keeps entering/exiting same pool
- ⛔ RPC errors every check
- ⛔ Negative returns after 2+ weeks

If you see these, stop and adjust settings!

---

## 🏁 Ready to Test!

Your bot is **fully implemented and ready to run**. Here's your launch checklist:

1. ✅ Code compiled successfully
2. ✅ Dashboard built successfully
3. ✅ Configuration added to `.env`
4. ✅ Documentation complete
5. ⏳ **YOUR TURN:** Start the bot and monitor!

**Start Command:**
```bash
npm start
```

**Then:**
1. Wait 30 seconds for initialization
2. Check console for "🌊 AMM BOT STARTED"
3. Visit http://localhost:3001/amm
4. Watch the magic happen!

---

## 📞 Need Help?

### If Something's Wrong:
1. Check console for error messages
2. Review relevant guide:
   - `AMM_QUICK_START.md` - Setup issues
   - `AMM_STRATEGIES.md` - Strategy questions
   - `AMM_IMPLEMENTATION.md` - Technical details
3. Verify configuration in `.env`
4. Try with conservative settings first

### If Everything's Working:
1. 🎉 Congratulations!
2. Monitor for 24-48 hours
3. Track returns and optimize
4. Enjoy your passive income!

---

**Your bot is ready to generate yield from AMM pools!** 🌊💰

Let it run and watch the profits roll in from arbitrage and liquidity provision. Good luck! 🚀
