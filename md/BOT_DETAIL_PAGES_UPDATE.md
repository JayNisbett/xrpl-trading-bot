# Bot Detail Pages & Arbitrage Fixes - v3.3

## 🎯 What's New

### 1. **Dedicated Bot Detail Pages**

Each bot now has its own full-page view instead of cramming everything into modals.

#### Navigation:
- From **Configurations** → **Running Instances**
- Click **"📊 View Details"** on any bot
- Navigate to `/bot/:botId` route

#### What's on the Page:

**Left Column:**
- **Arbitrage Stats Card** (if AMM arbitrage enabled)
  - Scans completed
  - Opportunities found
  - Opportunities filtered (with reasons)
  - Trades executed
  - Trades failed
  - Smart insights explaining why no trades yet
  - Current config limits displayed

- **Performance Card**
  - Individual bot P&L chart
  - Real-time updates every 5 seconds
  - Cumulative profit visualization
  - Trade statistics (total, win rate, best/worst)

- **Configuration Card**
  - Active strategies
  - Current settings
  - Feature badges

**Right Column:**
- **Activity Log Panel** (full height)
  - Chat-style message interface
  - Minimize/expand controls (works properly now!)
  - Filter by log level
  - Auto-scroll toggle
  - Real-time WebSocket updates
  - Stays on the page (not in a modal)

### 2. **Improved Log Panel**

The log panel now works as intended:

✅ **No longer in a modal** - It's a permanent part of the bot detail page
✅ **Properly minimizable** - Collapses to 60px header bar with unread count
✅ **Full-height by default** - Uses `calc(100vh - 12rem)` for optimal space
✅ **Expandable** - Can go full-screen with one click
✅ **Sticky positioning** - Stays visible while scrolling other content

**Controls:**
- **▼ Minimize** - Collapse to header bar
- **⇱ Expand** - Full-screen mode
- **Filter dropdown** - Show only specific log levels
- **Auto-scroll toggle** - Keep latest messages visible

### 3. **Arbitrage Execution Fixes**

#### Issue #1: XRP Being Treated as Arbitrage Token ✅ FIXED

**Problem:**
```
Token: XRP
Error: "Cannot have an issued currency with similar standard code to XRP"
```

**Root Cause:** The scanner was identifying XRP as a "shared token" between pools. Since most AMM pools are XRP/TOKEN pairs, XRP appears in both pools.

**Fix:** Modified `findSharedToken()` to **never return XRP**. Only issued tokens (SOLO, USD, BTC, etc.) are valid arbitrage candidates.

**Result:** No more "XRP is not an issued currency" errors.

---

#### Issue #2: Trade Amounts Exceeding Max Limit ✅ FIXED

**Problem:**
```
⚠️ Opportunity exceeds max trade amount, skipping
   tradeAmount: 129.96 XRP, maxAmount: 5 XRP
```

**Root Cause:** The optimal trade calculation used 5% of pool liquidity without considering the configured `maxTradeAmount`. For large pools, 5% could be 100+ XRP, but the default max is only 5 XRP.

**Fix:** 
- Updated `calculateOptimalArbitrageAmount()` to accept `maxTradeAmount` parameter
- Caps calculated amount at configured maximum
- Opportunities are now calculated within your risk limits from the start

**Result:** All detected opportunities will respect your configured max trade amount.

---

#### Issue #3: Extreme Price Differences ✅ FIXED

**Problem:**
```
XRP: 25,061,591,259.19% difference (clearly invalid)
```

**Root Cause:** Pools with near-zero reserves or extreme ratios were not being filtered.

**Fix:** Added comprehensive filters in `detectArbitrage()`:
- Price range validation (0.0000001 to 1,000,000)
- Max price difference cap (1000% / 10x)
- Trade amount validation (1 to 100,000 XRP)
- XRP exclusion (only issued tokens)

**Result:** Only realistic, executable opportunities are detected.

---

## 📊 Understanding Arbitrage Stats

On the bot detail page, you'll see:

```
🔍 Arbitrage Stats
┌─────────┬─────────┬──────────┬──────────┬────────┐
│ Scans   │ Found   │ Filtered │ Executed │ Failed │
│   50    │   12    │    8     │    3     │   1    │
└─────────┴─────────┴──────────┴──────────┴────────┘
```

### What Each Stat Means:

- **Scans**: Number of times the bot checked for opportunities
- **Found**: Raw opportunities detected before filtering
- **Filtered**: Opportunities removed due to:
  - Exceeding max trade amount
  - XRP as token (invalid)
  - Extreme/invalid prices
  - Trade amount out of range
- **Executed**: Successfully completed arbitrage trades
- **Failed**: Trades attempted but failed (transaction errors)

### Why You Might See Zero Trades:

1. **No Real Opportunities Exist**
   - Arbitrage on XRPL AMMs is rare
   - Most pools are efficiently priced
   - This is actually normal behavior

2. **Conservative Risk Limits**
   - Your `maxTradeAmount` might be too low (default: 5 XRP)
   - Your `minProfitPercent` might be too high (default: 0.5%)
   - Consider adjusting these in your configuration

3. **Filtered Out**
   - Check logs for "Opportunity exceeds max trade amount"
   - If you see this often, increase `maxTradeAmount`

---

## 🎨 UI Improvements

### Trading Terminal Feel

The interface now has a professional trading terminal aesthetic:

**Colors:**
- Deep blue/purple gradients
- Neon accent highlights
- Color-coded status indicators

**Typography:**
- Monospace fonts for data/numbers
- Clear hierarchy
- Professional spacing

**Animations:**
- Smooth hover effects
- Gentle transitions
- Loading spinners

**Layout:**
- Two-column grid on detail page
- Sticky log panel on right
- Responsive for all screen sizes

---

## 🚀 How to Use

### Step 1: Start a Bot
1. Go to **Configurations** page
2. Click **"▶️ Start"** on a configuration
3. Wait for instance to appear in **Running Instances**

### Step 2: View Bot Details
1. Click **"📊 View Details"** on the running bot
2. Opens dedicated page at `/bot/:botId`

### Step 3: Monitor Activity
- **Left side**: P&L chart, stats, arbitrage metrics
- **Right side**: Live activity log panel
- **Minimize log panel** (▼) to focus on charts
- **Expand log panel** (⇱) for detailed debugging

### Step 4: Analyze Performance
- **P&L Chart**: See cumulative profit over time
- **Arbitrage Stats**: Understand why trades execute or don't
- **Activity Logs**: Filter by level (error, warning, success)
- **Insights**: Smart tips based on bot behavior

---

## ⚙️ Adjusting Arbitrage Settings

If you're not seeing trades, you can adjust these settings:

### In Configuration Editor:

1. Go to **Configurations** → Click **"✏️ Edit"** on your config
2. Navigate to **"AMM"** tab
3. Under **"Arbitrage Settings"**:

**Increase Max Trade Amount:**
- Default: 5 XRP
- Suggested: 10-50 XRP (depending on your balance)
- Higher = more opportunities, but more risk

**Decrease Min Profit:**
- Default: 0.5%
- Try: 0.3% or 0.2% for more opportunities
- Lower = more trades, but lower profit per trade

**Increase Check Interval:**
- Default: 5000ms (5 seconds)
- Try: 3000ms (3 seconds) for faster detection
- Faster = more scans, but more API calls

### Via .env (if not using UI):

```env
AMM_ARBITRAGE_MAX_TRADE=20      # Increase to 20 XRP
AMM_ARBITRAGE_MIN_PROFIT=0.3    # Decrease to 0.3%
AMM_ARBITRAGE_CHECK_INTERVAL=3000  # Check every 3 seconds
```

---

## 🔍 Debugging Tips

### Check Why No Trades:

1. **Open bot detail page**
2. Look at **Arbitrage Stats**:
   - If "Found" = 0: No opportunities exist (normal)
   - If "Found" > 0 but "Filtered" > 0: Opportunities filtered (check logs)
   - If "Executed" = 0: Either no valid opportunities or they're being filtered

3. **Check Activity Logs**:
   - Filter by **"Warning"** level
   - Look for "Opportunity exceeds max trade amount"
   - Look for "Filtered: [TOKEN]" messages
   - Note the trade amounts being suggested

4. **Adjust Configuration**:
   - If filtered amounts are reasonable (e.g., 10-20 XRP)
   - Increase your `maxTradeAmount` to that level
   - Save and restart bot

### Expected Behavior:

**Healthy Bot (with opportunities):**
```
Scans: 50
Found: 12
Filtered: 8
Executed: 3
Failed: 1
```

**Healthy Bot (no opportunities):**
```
Scans: 50
Found: 0
Filtered: 0
Executed: 0
Failed: 0

💡 No arbitrage opportunities detected. This is normal - 
   real opportunities are rare on XRPL AMMs.
```

**Misconfigured Bot:**
```
Scans: 50
Found: 25
Filtered: 25  ← All opportunities being filtered!
Executed: 0
Failed: 0

💡 Opportunities found but filtered. Common reasons: 
   trade amount exceeds max (5 XRP), extreme prices, 
   or XRP as token. Check logs.
   
   Current Limits: Min Profit: 0.5% | Max Trade: 5 XRP
```

---

## 📝 Summary of Changes

### New Files:
- ✅ `dashboard/src/pages/BotDetail.tsx` - Dedicated bot page
- ✅ `dashboard/src/components/LogPanel.tsx` - Collapsible chat-style logs
- ✅ `dashboard/src/components/BotPnLChart.tsx` - Individual bot P&L

### Updated Files:
- ✅ `src/amm/poolAnalyzer.ts` - Fixed XRP arbitrage bug, added max trade limit
- ✅ `src/amm/poolScanner.ts` - Better logging for opportunities
- ✅ `src/amm/ammBot.ts` - Pass max trade amount to scanner
- ✅ `dashboard/src/App.tsx` - Added `/bot/:botId` route
- ✅ `dashboard/src/pages/BotConfigs.tsx` - Navigate to detail page instead of modal
- ✅ `dashboard/src/App.css` - Trading terminal styling

### Key Improvements:
1. ✅ Each bot has dedicated page with full context
2. ✅ Log panel properly minimizable (not in modal)
3. ✅ Per-bot P&L charts with live updates
4. ✅ Arbitrage stats showing exactly what's happening
5. ✅ XRP arbitrage bug fixed
6. ✅ Trade amounts respect configured limits
7. ✅ Better debugging and insights

---

## 🚀 Next Steps

1. **Restart your bot** (Ctrl+C, then `npm start`)
2. **Open dashboard** at `http://localhost:3001`
3. **Start a bot** from Configurations
4. **Click "📊 View Details"** to see the new page
5. **Monitor arbitrage stats** to understand bot behavior

The terminal-style UI is now complete with proper bot detail pages! 🎯📊
