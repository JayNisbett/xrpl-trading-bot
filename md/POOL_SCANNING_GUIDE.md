# Pool Scanning Expansion Guide

This guide explains how the bot scans for AMM pools and how to expand the number of pools scanned.

## Overview

The bot uses two methods to discover AMM pools for arbitrage and liquidity provision:

1. **Known Tokens List** (Default) - Fast and reliable
2. **Dynamic Pool Discovery** (Optional) - Comprehensive but slower

## Method 1: Known Tokens List (Manual)

### Quick Expansion

The fastest way to add more pools is to add tokens to the `KNOWN_TOKENS` list in `src/amm/poolScanner.ts`.

**Current token count:** 23 tokens

### How to Add More Tokens

1. **Find Active AMM Pools:**
   - Visit [XRPScan AMM Explorer](https://xrpscan.com/amm)
   - Look for pools with high TVL (Total Value Locked)
   - Check trading volume and activity

2. **Get Token Details:**
   - Currency code (e.g., `SOLO`, `CSC`, `USD`)
   - Issuer address (starts with `r...`)
   - Token name for display

3. **Add to KNOWN_TOKENS:**

```typescript
// src/amm/poolScanner.ts
export const KNOWN_TOKENS = [
    // ... existing tokens ...
    
    // Your new token
    { 
        currency: 'TOKEN', 
        issuer: 'r...issuer_address...', 
        name: 'Token Display Name' 
    },
];
```

### Recommended Tokens to Add

Based on XRPL ecosystem activity, consider adding:

```typescript
// High-volume stablecoins
{ currency: 'USDT', issuer: 'rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq', name: 'Tether USD' },

// Popular DeFi tokens
{ currency: 'Evers', issuer: 'rpakCr61Q92abPXJnVboKENmpKssWyHpwu', name: 'Evernode' },
{ currency: 'FLR', issuer: 'rLNKz5gQ7KS6JQaW8pYKKKZqvCYQYnGPpb', name: 'Flare' },

// Gaming & NFT tokens
{ currency: 'XMM', issuer: 'rXMMM3BqQy5sLCpEJKYQ9WtWRBCMYBbHh', name: 'XMarket' },
{ currency: 'GateWay', issuer: 'rGwUWgN5BEg3QGNY3RX2HfYowjUTZdid3E', name: 'Gateway' },

// Wrapped assets
{ currency: 'wBTC', issuer: 'rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL', name: 'Wrapped Bitcoin' },
{ currency: 'wETH', issuer: 'rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h', name: 'Wrapped Ethereum' },
```

**⚠️ Important:** Always verify issuer addresses on XRPScan before adding them!

## Method 2: Dynamic Pool Discovery (Automatic)

### Enable Dynamic Discovery

Dynamic discovery automatically finds active AMM pools on the network.

**Configuration in `.env`:**

```bash
# Enable dynamic pool discovery (slower but comprehensive)
AMM_DYNAMIC_POOL_DISCOVERY=true
```

### How It Works

1. **Seed Accounts:** Starts with known major exchanges and gateways
2. **Pool Checking:** Tests each known token for active AMM pools
3. **Merging:** Combines discovered pools with `KNOWN_TOKENS`
4. **Deduplication:** Removes duplicate tokens

### Performance Considerations

| Method | Scan Time | Pools Found | Recommended For |
|--------|-----------|-------------|-----------------|
| Known Tokens Only | 5-10 seconds | 15-25 pools | Normal trading |
| Dynamic Discovery | 30-60 seconds | 30-50+ pools | Maximum opportunities |

**Trade-offs:**

- **Known Tokens (Fast):**
  - ✅ Quick startup
  - ✅ Reliable verified tokens
  - ❌ Limited to manually added tokens
  - ❌ Misses new/emerging pools

- **Dynamic Discovery (Comprehensive):**
  - ✅ Finds all active pools
  - ✅ Discovers new opportunities automatically
  - ✅ No manual maintenance needed
  - ❌ Slower initialization
  - ❌ Higher API call usage

## Configuration Options

### Bot Configuration JSON

When creating bot configurations via the UI or `data/bot-configs.json`:

```json
{
  "id": "bot-1",
  "name": "Arbitrage Scanner",
  "mode": "arbitrage",
  "config": {
    "enabled": true,
    "dynamicPoolDiscovery": true,  // ⬅️ Enable here
    "arbitrage": {
      "enabled": true,
      "minProfitPercent": 0.5,
      "maxTradeAmount": 5,
      "checkInterval": 5000
    }
  }
}
```

### Environment Variables

Set defaults for all bots in `.env`:

```bash
# Pool Discovery
AMM_DYNAMIC_POOL_DISCOVERY=true    # Enable/disable dynamic discovery

# Arbitrage Settings
AMM_ARBITRAGE_MIN_PROFIT=0.5       # Minimum profit % to consider
AMM_ARBITRAGE_MAX_TRADE=5          # Max XRP per trade
AMM_ARBITRAGE_CHECK_INTERVAL=5000  # Check every 5 seconds

# Liquidity Settings
AMM_LIQUIDITY_MIN_TVL=100          # Minimum pool size (XRP)
AMM_LIQUIDITY_MAX_PRICE_IMPACT=0.05 # Max 5% price impact
```

## Monitoring Pool Discovery

### Backend Logs

When the bot starts, you'll see:

```
🔍 Scanning for arbitrage opportunities...
   🔄 Using dynamic pool discovery...
🔍 Starting dynamic AMM pool discovery...
  ✅ Found active AMM: XRP/Sologenic
  ✅ Found active AMM: XRP/CasinoCoin
  ✅ Found active AMM: XRP/Gatehub USD
✅ Discovery complete: Found 18 active AMM pools
   📊 Using 28 tokens (23 known + 5 discovered)
   ✅ Found pool: Sologenic (TVL: 125000.00 XRP)
   ✅ Found pool: CasinoCoin (TVL: 65000.00 XRP)
   ...
   ✅ Found 25 total active pools
```

### Frontend Bot Details Page

Navigate to `Bot Details > Arbitrage Stats`:

- **Scans Completed:** Number of arbitrage scans run
- **Opportunities Found:** Total arbitrage opportunities detected
- **Filtered Out:** Opportunities excluded by filters
- **Executed:** Successful arbitrage trades
- **Failed:** Failed execution attempts

## Advanced: Adding Custom Discovery Logic

For advanced users who want to implement custom pool discovery:

### Create Custom Seed List

Edit `src/amm/poolScanner.ts`:

```typescript
export async function discoverAMMPools(client: Client): Promise<Array<{ ... }>> {
    // Add your custom seed accounts
    const seedAccounts = [
        'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub
        'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp
        // Add more gateway/exchange accounts here
        'r...YourCustomAccount...', // Your custom seed
    ];
    
    // Discovery logic continues...
}
```

### Add Custom Token Sources

You can also import tokens from external APIs:

```typescript
// Example: Import from a custom API
const externalTokens = await fetch('https://api.example.com/xrpl-tokens')
    .then(res => res.json())
    .then(data => data.tokens);

const allTokens = [...KNOWN_TOKENS, ...externalTokens];
```

## Troubleshooting

### Issue: No new pools discovered

**Possible causes:**
- All active pools are already in `KNOWN_TOKENS`
- Network issues connecting to XRPL
- Seed accounts have no new AMM pools

**Solution:**
```bash
# Check backend logs for discovery details
npm start

# Look for:
# "Discovery complete: Found X active AMM pools"
# "Using Y tokens (X known + Z discovered)"
```

### Issue: Discovery too slow

**Solution:**
1. Disable dynamic discovery: `AMM_DYNAMIC_POOL_DISCOVERY=false`
2. Manually add high-priority tokens to `KNOWN_TOKENS`
3. Reduce check interval: `AMM_ARBITRAGE_CHECK_INTERVAL=10000` (10 seconds)

### Issue: Pools found but no opportunities

**Common reasons:**
- Profit margins below `AMM_ARBITRAGE_MIN_PROFIT` threshold
- Trade amounts exceed `AMM_ARBITRAGE_MAX_TRADE` limit
- Price differences filtered as data errors
- All pools have balanced prices (efficient market)

**Solution:**
1. Check Bot Details > Arbitrage Stats
2. Read insights explaining filtering
3. Adjust configuration:
   ```bash
   AMM_ARBITRAGE_MIN_PROFIT=0.3   # Lower profit threshold
   AMM_ARBITRAGE_MAX_TRADE=10     # Higher trade limit
   ```

## Recommended Setup

### For Most Users (Balanced)

```bash
# .env settings
AMM_DYNAMIC_POOL_DISCOVERY=false  # Use known tokens only
AMM_ARBITRAGE_MIN_PROFIT=0.5
AMM_ARBITRAGE_MAX_TRADE=5
AMM_ARBITRAGE_CHECK_INTERVAL=5000
```

**And manually add 5-10 high-volume tokens to `KNOWN_TOKENS`**

### For Maximum Opportunities (Advanced)

```bash
# .env settings
AMM_DYNAMIC_POOL_DISCOVERY=true   # Discover all pools
AMM_ARBITRAGE_MIN_PROFIT=0.3      # Lower threshold
AMM_ARBITRAGE_MAX_TRADE=10        # Higher limit
AMM_ARBITRAGE_CHECK_INTERVAL=3000  # More frequent checks
```

### For Conservative Trading

```bash
# .env settings
AMM_DYNAMIC_POOL_DISCOVERY=false  # Vetted tokens only
AMM_ARBITRAGE_MIN_PROFIT=1.0      # Higher profit requirement
AMM_ARBITRAGE_MAX_TRADE=2         # Lower risk
AMM_ARBITRAGE_CHECK_INTERVAL=10000 # Less frequent
```

## Next Steps

1. **Test Current Setup:**
   ```bash
   npm start
   # Monitor logs for pool discovery
   ```

2. **Add More Tokens:**
   - Browse XRPScan AMM explorer
   - Add 5-10 high-volume pools to `KNOWN_TOKENS`
   - Restart bot

3. **Enable Dynamic Discovery (Optional):**
   ```bash
   # .env
   AMM_DYNAMIC_POOL_DISCOVERY=true
   ```

4. **Monitor Performance:**
   - Check Bot Details page
   - Review Arbitrage Stats
   - Adjust configuration based on results

## Further Reading

- [AMM Bot Setup Guide](./START_AMM_BOT.md)
- [Arbitrage Fixes Documentation](./ARBITRAGE_FIXES.md)
- [Bot Detail Pages](./BOT_DETAIL_PAGES_UPDATE.md)
- [Trading Terminal UI](./TRADING_TERMINAL_UI.md)

---

**Questions?** Check the bot logs and Bot Details page for real-time insights!
