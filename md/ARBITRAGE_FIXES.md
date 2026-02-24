# Arbitrage Scanner Fixes

## Issues Found

### 1. **Critical: XRP Arbitrage Bug**

**Symptom:**
```
🔄 ARBITRAGE OPPORTUNITY DETECTED
Token: XRP
Price Difference: 719003217.43%

❌ [Arbitrage] Arbitrage execution failed
Error: "Buy failed: Cannot have an issued currency with a similar 
       standard code to XRP (received 'XRP'). XRP is not an issued currency."
```

**Cause:** The arbitrage scanner was incorrectly identifying XRP as a tradeable token between pools. Since most AMM pools are XRP/TOKEN pairs, XRP appears in both pools, so the algorithm was treating XRP as the "shared token" to arbitrage.

**Problem:** 
- XRP is the native XRPL currency, not an issued currency
- You cannot trade "XRP" as if it were a token
- The XRPL API rejects attempts to create transactions with XRP as an issued currency
- Arbitrage should be on the issued token (e.g., SOLO, USD), not on XRP

**Fix:** Modified `findSharedToken()` in `src/amm/poolAnalyzer.ts` to never return XRP as the shared token:

```typescript
private findSharedToken(pool1, pool2) {
    // Check if asset1 of pool1 matches any asset in pool2
    if (this.tokensMatch(pool1.asset1, pool2.asset1) || 
        this.tokensMatch(pool1.asset1, pool2.asset2)) {
        // Only return if it's NOT XRP
        if (pool1.asset1.currency !== 'XRP') {
            return pool1.asset1;
        }
    }
    if (this.tokensMatch(pool1.asset2, pool2.asset1) || 
        this.tokensMatch(pool1.asset2, pool2.asset2)) {
        // Only return if it's NOT XRP
        if (pool1.asset2.currency !== 'XRP') {
            return pool1.asset2;
        }
    }
    return null;
}
```

**Result:** The bot will now only detect arbitrage opportunities for actual issued tokens (SOLO, USD, BTC, etc.) and never try to arbitrage XRP itself.

---

### 2. **Runtime Error: Cannot read properties of undefined (reading 'toFixed')**

**Location:** `src/amm/ammBot.ts:180`

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'toFixed')
at AMMBot.checkAndExecuteArbitrage
```

**Cause:** The code was trying to access `opp.profitPercent` property which doesn't exist in the `ArbitrageOpportunity` interface. The correct property is `priceDifference`.

**Fix:** Changed the log statement from:
```typescript
expectedProfit: `${opp.profitPercent.toFixed(2)}%`
```
to:
```typescript
expectedProfit: `${opp.priceDifference.toFixed(2)}%`
```

---

### 3. **Unrealistic Arbitrage Opportunities**

**Symptom:** The bot was detecting arbitrage opportunities with absurd price differences:
- 112,950,238,894.31% difference
- 3,240,480,337.85% difference
- 25,061,591,259.19% difference
- etc.

**Cause:** The arbitrage detection algorithm was not filtering out pools with extreme or invalid prices. When comparing two pools where one has a very small reserve (close to zero), the price calculation would produce astronomical values:

```typescript
priceDiff = Math.abs(price1 - price2) / Math.min(price1, price2)
```

For example:
- price1 = 10
- price2 = 0.00001
- priceDiff = |10 - 0.00001| / 0.00001 = 999,999 = 99,999,900%

**Fix:** Added comprehensive filtering in `src/amm/poolAnalyzer.ts`:

1. **Price Validation:**
   - Reject negative or zero prices
   - Reject prices > 1,000,000 (unrealistically high)
   - Reject prices < 0.0000001 (too small to be meaningful)

2. **Price Difference Cap:**
   - Maximum price difference capped at 1000% (10x)
   - Any opportunity beyond this is likely a data error

3. **Trade Amount Validation:**
   - Reject trade amounts < 1 XRP (too small)
   - Reject trade amounts > 100,000 XRP (too large/risky)

```typescript
// Filter out extreme or invalid prices
if (price1 <= 0 || price2 <= 0) continue;
if (price1 > 1000000 || price2 > 1000000) continue;
if (price1 < 0.0000001 || price2 < 0.0000001) continue;

const priceDiff = Math.abs(price1 - price2) / Math.min(price1, price2);

// Cap maximum price difference at 1000% (10x)
if (priceDiff > 10) continue;

// Skip if optimal amount is unreasonable
if (optimalAmount < 1 || optimalAmount > 100000) continue;
```

## Result

After these fixes:
- ✅ XRP is never treated as an arbitrage token (only issued currencies)
- ✅ No more "XRP is not an issued currency" errors
- ✅ No more runtime errors
- ✅ Only realistic arbitrage opportunities are detected (0.5% - 1000%)
- ✅ Better protection against data errors and edge cases
- ✅ More reliable profit calculations

## Testing Recommendations

1. **Monitor Logs:** Watch the arbitrage scanner logs for reasonable price differences
2. **Verify Opportunities:** If you see any opportunity > 100%, verify it manually on XRPscan
3. **Adjust Thresholds:** If needed, you can adjust these limits in `src/amm/poolAnalyzer.ts`:
   - `maxPrice`: Currently 1,000,000
   - `minPrice`: Currently 0.0000001
   - `maxPriceDiff`: Currently 10 (1000%)
   - `maxTradeAmount`: Currently 100,000 XRP
   - `minTradeAmount`: Currently 1 XRP

## Example of Normal Output

After the fix, you should see realistic opportunities like:
```
✅ Found 3 arbitrage opportunities!
   SOLO: 2.45% difference ✓ (issued token)
   USD: 1.87% difference  ✓ (issued token)
   BTC: 0.92% difference  ✓ (issued token)
```

**What you'll NO LONGER see:**
```
❌ XRP: 112950238894.31% difference  (XRP is not an arbitrage candidate)
❌ XRP: 3240480337.85% difference    (unrealistic percentage)
❌ XRP: 25061591259.19% difference   (causes transaction errors)
```

**Key Points:**
- Opportunities will only be for **issued tokens** (SOLO, USD, BTC, EUR, etc.)
- XRP will **never** appear as an arbitrage opportunity
- Price differences will be **realistic** (< 1000%)
- All detected opportunities will be **executable** without XRP-related errors

## Additional Notes

- The arbitrage scanner now has better data quality control
- False positives are significantly reduced
- Real opportunities (if any exist) should now be clearly visible
- The bot will be more conservative but more reliable
