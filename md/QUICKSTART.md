# 🚀 Quick Start Guide - 20 XRP Setup

Get your XRPL trading bot running in 5 minutes!

---

## Step 1: Install Dependencies (30 seconds)

```bash
npm install
```

---

## Step 2: Set Up Your Wallet (2 minutes)

### Option A: Generate a New Wallet (Recommended for Testing)

```bash
npm run generate-wallet
```

This will:
- Generate a new XRPL wallet
- Display your seed phrase and address
- Save a backup to `backups/` folder
- Provide setup instructions

**⚠️ SAVE YOUR SEED PHRASE SECURELY!**

### Option B: Use Existing Wallet

If you already have an XRPL wallet, skip to Step 3 and add your seed.

---

## Step 3: Configure Your .env File (1 minute)

The `.env` file is already optimized for 20 XRP. Just add your wallet info:

```bash
# Open .env in your editor
nano .env
# or
code .env
```

**Add your wallet credentials:**
```bash
WALLET_SEED=sXXXXXXXXXXXXXXXXXXXXXXXXXXX
WALLET_ADDRESS=rXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Everything else is pre-configured for 20 XRP!**

---

## Step 4: Fund Your Wallet (5 minutes)

Send **exactly 20 XRP** to your wallet address.

### Recommended Exchanges:
- Coinbase
- Kraken
- Binance
- Bitstamp

### For Testing (Testnet):
1. Change `XRPL_NETWORK=testnet` in `.env`
2. Change `XRPL_SERVER=wss://s.altnet.rippletest.net:51233` in `.env`
3. Get free test XRP: https://xrpl.org/xrp-testnet-faucet.html

---

## Step 5: Verify Your Account (30 seconds)

Check that your wallet is funded and ready:

```bash
npm run account-status
```

You should see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ACCOUNT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Total XRP Balance: 20.000000 XRP
🔒 Locked Reserves: 10.00 XRP
✅ Tradable XRP: 9.00 XRP
📈 Active Positions: 0/3
🟢 Health Status: HEALTHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**✅ If you see this, you're ready to trade!**

---

## Step 6: Start Trading! (1 second)

### Recommended: Start with Sniper Mode

```bash
npm run start:sniper
```

This mode:
- ✅ Best for 20 XRP starting balance
- ✅ Automatically detects new token launches
- ✅ Buys tokens that pass safety filters
- ✅ Focused, predictable opportunities

### Alternative: Copy Trading Mode

```bash
# First, add trader addresses to .env:
COPY_TRADER_ADDRESSES=rTrader1Address,rTrader2Address

# Then start copy trading:
npm run start:copy
```

### Not Recommended: Both Modes (for 20 XRP)

```bash
npm start
```
- ⚠️ Can drain capital quickly
- Only use if you have good trader addresses
- Better with 50+ XRP

---

## 📊 What to Expect

### First Hour
- Bot connects to XRPL network
- Monitors for trading opportunities
- May take 15-30 minutes to find first trade
- Console will show scanning activity

### First Trade
```
✅ Safety checks passed. Tradable: 8.50 XRP, Positions: 0
🎯 Evaluating token: TOKEN (100 XRP liquidity)
✅ Liquidity check passed: 100 XRP
✅ First-time creator check passed
✅ LP burn check passed
💰 Executing snipe: 1.5 XRP for TOKEN
✅ Trade successful! TX: ABC123...
```

### After Several Hours
- 2-3 token positions
- ~4-6 XRP tradable remaining
- Monitor using `npm run account-status`

---

## 🛑 How to Stop the Bot

**Press `Ctrl+C` once**

The bot will:
1. Stop monitoring for trades
2. Save current state
3. Close database connections
4. Disconnect from XRPL

**Do NOT press Ctrl+C multiple times** (unless bot is frozen)

---

## 📈 Monitoring Your Bot

### Check Account Status
```bash
# In a new terminal (while bot is running)
npm run account-status
```

### View Transaction History
Visit: `https://xrpscan.com/account/YOUR_ADDRESS`

### Check Bot Logs
The bot prints all activity to the console:
- Trade executions
- Safety checks
- Token evaluations
- Errors and warnings

---

## ⚠️ Important Safety Rules

### 1. Never Spend All Your XRP
- Keep 11-12 XRP minimum
- Bot enforces this automatically

### 2. Monitor Actively (First 24 Hours)
- Check console output regularly
- Run `npm run account-status` every few hours
- Review trades on XRPScan

### 3. Start Conservative
- Don't change settings immediately
- Let it run for 24 hours first
- Evaluate results before adjusting

### 4. Understand the Risks
- 90%+ of new tokens fail
- You can lose your entire 20 XRP
- Only invest what you can afford to lose
- This is experimental, high-risk trading

---

## 🔧 Adjusting Settings (After 24 Hours)

If you want to be **more conservative**:
```bash
# Edit .env
SNIPER_AMOUNT=1                 # Reduce from 1.5 to 1
MAX_SNIPE_AMOUNT=1.5           # Reduce from 2 to 1.5
SNIPER_MIN_LIQUIDITY=100       # Increase from 50 to 100
```

If you want to be **more aggressive** (higher risk):
```bash
# Edit .env
SNIPER_AMOUNT=2                # Increase from 1.5 to 2
MAX_SNIPE_AMOUNT=2.5           # Increase from 2 to 2.5
SNIPER_MIN_LIQUIDITY=25        # Decrease from 50 to 25
```

**⚠️ Restart bot after changing settings:**
```bash
# Stop bot: Ctrl+C
# Start again: npm run start:sniper
```

---

## ❓ Troubleshooting

### "Insufficient balance to start sniper"
- Your wallet needs at least 10 XRP + buffer
- Check balance: `npm run account-status`
- Add more XRP or adjust `SNIPER_AMOUNT` to a lower value

### "WALLET_SEED environment variable is required"
- You forgot to add your seed to `.env`
- Open `.env` and add: `WALLET_SEED=sYourSeedHere`

### "Account not activated"
- Your wallet has 0 XRP
- Send at least 10 XRP to activate it
- Check: `npm run account-status`

### No trades happening
- Normal! Can take 30-60 minutes for first opportunity
- New token launches are sporadic
- Bot is working if you see "Scanning..." messages
- Try adjusting `SNIPER_MIN_LIQUIDITY` lower (more risky)

### "Maximum position limit reached"
- You have too many token positions for your balance
- Sell some tokens using XRPL wallet apps (Xaman)
- Or add more XRP to increase limit

### Bot crashes or freezes
- Press Ctrl+C to stop
- Check error messages
- Verify XRPL network is online: https://xrpl.org/
- Try testnet for testing: change `XRPL_NETWORK=testnet`
- Restart: `npm run start:sniper`

---

## 📚 Next Steps

After your first 24 hours:

1. **Review Performance**
   - How many trades executed?
   - Any profitable positions?
   - Any losses?

2. **Read Full Documentation**
   - `CONFIGURATION_GUIDE.md` - Detailed settings explanation
   - `IMPROVEMENTS.md` - Technical details and features
   - `README.md` - Complete bot documentation

3. **Optimize Settings**
   - Adjust based on your results
   - Try different risk levels
   - Experiment with copy trading

4. **Scale Up (Optional)**
   - Add more XRP if successful
   - More capital = more positions
   - More positions = more opportunities

5. **Join Community**
   - Share experiences
   - Learn from other traders
   - Get trader addresses for copy trading

---

## 🎓 Key Concepts to Understand

### XRP Reserves
- **10 XRP**: Base reserve (locked by XRPL)
- **2 XRP per token**: Trust line reserve (locked)
- These are XRPL rules, not bot limitations
- Reserves are returned when you close positions

### AMM Pools
- Bot trades on Automated Market Maker pools
- Like Uniswap/PancakeSwap but for XRPL
- New tokens create new AMM pools
- Bot detects these and evaluates them

### Sniper Strategy
- Targets newly launched tokens
- Filters out obvious scams (LP burn check)
- First-time creators only (reduces rug risk)
- Still very high risk!

### Copy Trading Strategy
- Mimics successful traders
- Quality depends on trader selection
- Good for learning strategies
- Requires finding profitable traders

---

## 🎯 Success Tips

1. **Start Small**: 20 XRP is perfect for learning
2. **Be Patient**: Good trades are rare
3. **Monitor Closely**: Especially first 24 hours
4. **Take Profits**: Don't be greedy
5. **Learn Continuously**: Read docs, join communities
6. **Stay Safe**: Never share your seed phrase

---

## ✅ Checklist

Before starting:
- [ ] Dependencies installed (`npm install`)
- [ ] Wallet generated or seed added to `.env`
- [ ] Wallet funded with 20 XRP
- [ ] Account status shows "HEALTHY"
- [ ] Understand the risks
- [ ] Know how to stop the bot (Ctrl+C)
- [ ] XRPScan bookmarked for monitoring

All checked? **You're ready to go!**

```bash
npm run start:sniper
```

---

**Good luck! Happy trading! 🚀**

*Remember: High risk, high reward. Trade responsibly.*
