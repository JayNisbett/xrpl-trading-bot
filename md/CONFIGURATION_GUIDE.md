# XRPL Trading Bot Configuration Guide
## 20 XRP Starting Balance

### 🎯 Overview
This bot supports two trading modes:
- **Sniper Mode**: Auto-detects and buys new tokens when AMM pools are created
- **Copy Trading Mode**: Monitors and copies trades from specified wallet addresses
- **Both Modes**: Runs both simultaneously (requires more capital)

### 💰 Critical XRP Reserve Requirements

**XRPL Account Reserves:**
- Base Reserve: 10 XRP (locked, cannot be spent)
- Per Trust Line: 2 XRP (each token needs a trust line)
- Transaction Fees: ~0.00001 XRP per transaction

**With 20 XRP starting balance:**
- Available for trading: ~8 XRP (after 10 XRP base reserve + buffer)
- Maximum active positions: 3-4 tokens (each locks 2 XRP)
- Always keep 1-2 XRP buffer for fees

---

## 🔧 Recommended Configuration for 20 XRP

### Critical Settings (MUST CHANGE)

```bash
# === SNIPER CONFIGURATION (Conservative for 20 XRP) ===
SNIPER_BUY_MODE=true                    # Enable auto-buying
SNIPER_AMOUNT=1.5                       # Spend 1.5 XRP per snipe
SNIPER_MIN_LIQUIDITY=50                 # Lower from 100 to find more opportunities
MAX_SNIPE_AMOUNT=2                      # Hard cap at 2 XRP per trade
SNIPER_CHECK_INTERVAL=10000             # Check every 10 seconds
MAX_TOKENS_PER_SCAN=10                  # Reduced from 15 to save resources

# === COPY TRADING (Conservative for 20 XRP) ===
COPY_TRADING_AMOUNT_MODE=fixed          # Use fixed amounts (more predictable)
COPY_TRADING_FIXED_AMOUNT=1.5           # 1.5 XRP per copy trade
COPY_TRADING_MAX_SPEND=2                # Hard cap at 2 XRP per trade
COPY_TRADING_CHECK_INTERVAL=5000        # Check every 5 seconds
COPY_TRADER_ADDRESSES=                  # Add trader addresses (comma-separated)

# === SAFETY SETTINGS ===
EMERGENCY_STOP_LOSS=0.5                 # Sell if down 50% (was 30%)
DEFAULT_SLIPPAGE=5.0                    # Higher slippage for volatile tokens
MIN_LIQUIDITY=50                        # Lower to find more opportunities

# === BEST EXECUTION (path finding + order book) ===
USE_BEST_EXECUTION=true                 # Use path find + AMM + book for best price (default: true)
# Set to false to force AMM-only execution
```

### Strategy Recommendations

**Option 1: Sniper Only (Recommended for 20 XRP)**
```bash
# Start bot with: npm start -- --sniper
# This focuses on new token opportunities
# Expected positions: 3-5 tokens max
# Risk: Medium to High
```

**Option 2: Copy Trading Only (Safer but requires good traders)**
```bash
# Start bot with: npm start -- --copy
# This mimics successful traders
# Expected positions: 2-4 tokens max
# Risk: Depends on trader selection
```

**Option 3: Both (Not Recommended for 20 XRP)**
```bash
# Start bot with: npm start
# Too many opportunities can drain capital quickly
# Risk: High capital exhaustion
```

---

## 📊 XRP Budget Breakdown (20 XRP)

| Item | Amount | Notes |
|------|--------|-------|
| Base Reserve | 10 XRP | Locked by XRPL |
| Fee Buffer | 0.5 XRP | Transaction fees |
| Trading Capital | 9.5 XRP | Available |
| Per Trade | 1.5 XRP | Recommended |
| **Max Positions** | **6 trades** | Or 3-4 active tokens |

⚠️ **Warning**: Each token creates a 2 XRP trust line reserve. With 4 tokens, you lose 8 XRP to reserves!

---

## 🎯 Optimal Settings for Different Risk Levels

### Conservative (Safest - Recommended)
```bash
SNIPER_AMOUNT=1
SNIPER_MIN_LIQUIDITY=100
MAX_SNIPE_AMOUNT=1.5
EMERGENCY_STOP_LOSS=0.4
COPY_TRADING_FIXED_AMOUNT=1
COPY_TRADING_MAX_SPEND=1.5
```
- Expected: 2-3 positions
- Risk: Low-Medium
- Capital efficiency: Low

### Moderate (Balanced)
```bash
SNIPER_AMOUNT=1.5
SNIPER_MIN_LIQUIDITY=50
MAX_SNIPE_AMOUNT=2
EMERGENCY_STOP_LOSS=0.5
COPY_TRADING_FIXED_AMOUNT=1.5
COPY_TRADING_MAX_SPEND=2
```
- Expected: 3-5 positions
- Risk: Medium
- Capital efficiency: Medium

### Aggressive (Highest Risk - Not Recommended)
```bash
SNIPER_AMOUNT=2
SNIPER_MIN_LIQUIDITY=20
MAX_SNIPE_AMOUNT=3
EMERGENCY_STOP_LOSS=0.6
COPY_TRADING_FIXED_AMOUNT=2
COPY_TRADING_MAX_SPEND=3
```
- Expected: 4-6 positions
- Risk: High
- Capital efficiency: High but risky

---

## 🚀 Getting Started

### 1. Generate a Wallet (if you don't have one)
```bash
npm run start
# The bot will create a wallet if WALLET_SEED is empty
# SAVE YOUR SEED PHRASE SECURELY!
```

### 2. Fund Your Wallet
- Send **exactly 20 XRP** to your wallet address
- Verify on https://livenet.xrpl.org/

### 3. Configure .env File
```bash
# Copy the configuration above into your .env file
# Make sure to set WALLET_SEED and WALLET_ADDRESS
```

### 4. Start the Bot
```bash
# Sniper only
npm start -- --sniper

# Copy trading only (requires COPY_TRADER_ADDRESSES)
npm start -- --copy

# Both modes
npm start
```

---

## 🎓 Understanding the Settings

### SNIPER_BUY_MODE
- `true`: Automatically buy tokens that pass filters
- `false`: Only buy whitelisted tokens (requires manual whitelist)

### SNIPER_MIN_LIQUIDITY
- Minimum XRP liquidity in the AMM pool
- Lower = more opportunities, higher risk
- Higher = fewer opportunities, lower risk

### COPY_TRADING_AMOUNT_MODE
- `fixed`: Always spend the same XRP amount (recommended for 20 XRP)
- `percentage`: Match the trader's percentage (can drain capital quickly)

### EMERGENCY_STOP_LOSS
- `0.3` = Sell if token drops 70% (30% of original value)
- `0.5` = Sell if token drops 50%
- Higher = more tolerance for volatility

### DEFAULT_SLIPPAGE
- Maximum price movement accepted during trade
- New tokens are volatile: 4-6% recommended
- Stable pools: 1-2% sufficient

---

## ⚠️ Important Warnings

1. **Never spend all your XRP**
   - Always keep 11-12 XRP minimum (10 base + fees)
   
2. **Trust line reserves add up**
   - Each token = 2 XRP locked
   - 5 tokens = 10 XRP locked permanently
   
3. **New tokens are extremely risky**
   - 90%+ of new tokens fail or are rugs
   - Only invest what you can afford to lose
   
4. **Monitor your bot actively**
   - Check logs regularly
   - Set up alerts for large movements
   - Manual intervention may be needed

5. **LP Burn requirement**
   - Bot only buys tokens with burned LP tokens
   - This reduces rug risk but doesn't eliminate it

---

## 📈 Success Tips

1. **Start with Sniper Mode only**
   - Easier to manage with limited capital
   - More consistent opportunities

2. **Use Conservative settings first**
   - Learn how the bot behaves
   - Adjust based on results

3. **Research Copy Trading targets**
   - Find profitable XRPL traders
   - Verify their history on xrpscan.com
   - Add to COPY_TRADER_ADDRESSES

4. **Set realistic expectations**
   - 20 XRP is a small starting amount
   - Focus on learning, not massive gains
   - Scale up after proving the strategy

5. **Keep detailed records**
   - Track every trade
   - Calculate actual ROI
   - Learn from losses

---

## 🔍 Monitoring Your Bot

### Check Balance
```bash
# Your bot logs this on startup
# Or check manually on xrpscan.com
```

### View Active Positions
```bash
# Check data/state.json
# Look for sniperPurchases and transactions arrays
```

### Transaction History
- Visit: https://xrpscan.com
- Enter your wallet address
- Review all transactions

---

## 🛑 When to Stop the Bot

Stop immediately if:
- Balance drops below 12 XRP
- More than 3 failed transactions in a row
- Suspicious activity detected
- Need to manually manage positions

Stop gracefully:
```bash
# Press Ctrl+C once
# Bot will cleanup and disconnect properly
```

---

## 📚 Next Steps

1. Read the main README.md for detailed functionality
2. Test with conservative settings for 24 hours
3. Analyze results and adjust
4. Consider adding more capital once comfortable
5. Join XRPL trading communities for trader addresses

---

## ❓ FAQ

**Q: Can I start with less than 20 XRP?**
A: Not recommended. 10 XRP is locked as base reserve, leaving only a few XRP for trading.

**Q: How many trades can I make per day?**
A: Unlimited. Fees are ~0.00001 XRP per transaction.

**Q: What if I run out of XRP?**
A: Bot will log errors and skip trades. You'll need to add more XRP or sell tokens.

**Q: Can I manually sell tokens?**
A: Yes, but the bot doesn't have a manual sell command yet. Use XRPL wallets like Xaman.

**Q: Is this profitable?**
A: Results vary greatly. Most new tokens fail. This is high risk trading.

---

**Good luck! Trade responsibly. 🚀**
