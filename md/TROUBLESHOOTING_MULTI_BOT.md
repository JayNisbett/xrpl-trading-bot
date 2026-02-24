# 🔧 Troubleshooting Multi-Bot System

## Issue: Bot doesn't appear in "Running Instances" after clicking "Start"

### Quick Diagnosis Steps

#### Step 1: Enable Debug Panel
1. Go to **⚙️ Configurations** page in dashboard
2. Click **"🔍 Show Debug"** button (top right)
3. Check the debug information:
   - **Configurations Loaded**: Should match your created configs
   - **Instances Fetched**: Should increase when you start a bot
   - **Running Count**: Should show running bots

#### Step 2: Check Console Logs (Backend)

Look at your terminal where you ran `npm start`. You should see:

**When starting a bot:**
```
📡 API: POST /api/instances/start called with configId: bot_xxx
📡 API: Found config "Your Config Name", starting bot for user default
🚀 Bot Manager: Attempting to start "Your Config Name"
📝 Bot Manager: Created instance instance_xxx for "Your Config Name"
📊 Bot Manager: Total instances now: 1
👤 Using existing user: default
✓ Sniper started for Your Config Name
✅ Bot instance "Your Config Name" (instance_xxx) started successfully
📊 Bot Manager: 1 total instances
🟢 Bot Manager: 1 running instances
```

**When fetching instances:**
```
📡 API: /api/instances called, returning 1 instances
```

#### Step 3: Test API Directly

Open a new terminal and test the API:

```bash
# Check if configs exist
curl http://localhost:3000/api/configs

# Check instances
curl http://localhost:3000/api/instances

# Check debug endpoint
curl http://localhost:3000/api/debug/instances
```

### Common Issues & Solutions

#### Issue 1: No console logs when clicking "Start"
**Cause:** API server not receiving the request

**Solutions:**
1. Verify bot is running: Check terminal for "API server running on port 3000"
2. Check browser console (F12) for CORS or network errors
3. Verify URL: Should be `http://localhost:3000` not `https://`

**Test:**
```bash
# In browser console (F12):
fetch('http://localhost:3000/api/configs').then(r => r.json()).then(console.log)
```

#### Issue 2: Console shows "Configuration not found"
**Cause:** Configuration wasn't saved properly

**Solutions:**
1. Check `data/bot-configs.json` exists:
   ```bash
   cat data/bot-configs.json
   ```
2. Verify config has valid `id` field
3. Try creating a new config or importing from .env

**Manual Fix:**
```bash
# Check the file
ls -la data/bot-configs.json

# View contents
cat data/bot-configs.json
```

#### Issue 3: Console shows bot started but UI shows 0 instances
**Cause:** Instance data not being serialized properly or fetched

**Solutions:**
1. Check debug endpoint in browser:
   ```
   http://localhost:3000/api/debug/instances
   ```
   
2. Look for serialization errors in console

3. Verify instances fetch in browser console:
   ```javascript
   fetch('http://localhost:3000/api/instances')
     .then(r => r.json())
     .then(data => console.log('Instances:', data))
   ```

4. Force refresh the dashboard page (Ctrl+Shift+R or Cmd+Shift+R)

#### Issue 4: Bot shows "starting" status forever
**Cause:** Bot initialization is hanging or failing

**Solutions:**
1. Check backend console for error messages
2. Look for stuck module initialization
3. Verify XRPL connection is working:
   ```bash
   npm run account-status
   ```

4. Check if sniper/copy trading modules are hanging

**Manual Fix:**
```bash
# Stop and restart the bot
# Press Ctrl+C in the terminal
npm start
```

#### Issue 5: Error: "Bot with this configuration is already running"
**Cause:** Instance already exists but not showing in UI

**Solutions:**
1. Check debug panel - instances might actually be running
2. Restart the backend:
   ```bash
   # Stop: Ctrl+C
   npm start
   ```
3. Check `data/` folder for stale state files
4. Try stopping via API:
   ```bash
   # Get instance ID from debug panel
   curl -X POST http://localhost:3000/api/instances/INSTANCE_ID/stop
   ```

#### Issue 6: CORS errors in browser console
**Cause:** Dashboard and API on different origins

**Solutions:**
1. Verify API server is running on port 3000
2. Verify dashboard is on port 3001
3. Check CORS settings in `src/api/server.ts`

**Expected:**
```javascript
cors: {
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

### Advanced Debugging

#### Check Bot Manager State

Add this to browser console on the Configurations page:

```javascript
// Fetch all debug info
fetch('http://localhost:3000/api/debug/instances')
  .then(r => r.json())
  .then(data => {
    console.log('=== DEBUG INFO ===')
    console.log('Total Configs:', data.totalConfigs)
    console.log('Total Instances:', data.totalInstances)
    console.log('Stats:', data.stats)
    console.log('Instances:', data.instances)
    console.log('Configs:', data.configs)
  })
```

#### Monitor Real-Time Updates

Enable console logging in the component:

```javascript
// In browser console:
localStorage.setItem('debug', 'true')
// Refresh page
```

#### Check Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Click "Start" on a configuration
4. Look for:
   - `POST /api/instances/start` request
   - Response status (200 = success, 4xx/5xx = error)
   - Response body (should have `success: true` and `instanceId`)

### Manual Testing Procedure

#### Test 1: Create and verify configuration

```bash
# In terminal:
curl -X POST http://localhost:3000/api/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Bot",
    "description": "Manual test",
    "enabled": true,
    "mode": "sniper",
    "sniper": { "enabled": true, "checkInterval": 8000, "maxTokensPerScan": 15, "buyMode": false, "snipeAmount": "1", "customSnipeAmount": "", "minimumPoolLiquidity": 100, "riskScore": "medium", "transactionDivides": 1 },
    "copyTrading": { "enabled": false, "checkInterval": 3000, "maxTransactionsToCheck": 20, "traderAddresses": [], "tradingAmountMode": "percentage", "matchTraderPercentage": 50, "maxSpendPerTrade": 100, "fixedAmount": 10 },
    "trading": { "minLiquidity": 100, "minHolders": 5, "minTradingActivity": 3, "maxSnipeAmount": 5000, "emergencyStopLoss": 0.3, "defaultSlippage": 4.0 },
    "amm": { "enabled": false, "arbitrage": { "enabled": false, "minProfitPercent": 0.5, "maxTradeAmount": 5, "checkInterval": 5000 }, "liquidity": { "enabled": false, "strategy": "one-sided", "minTVL": 100, "maxPriceImpact": 0.05, "targetAPR": 20, "maxPositions": 5 }, "risk": { "maxImpermanentLoss": 10, "maxPositionSize": 3, "diversification": true } }
  }'

# Should return the created config with an ID
```

#### Test 2: Start the bot

```bash
# Use the config ID from the previous response
curl -X POST http://localhost:3000/api/instances/start \
  -H "Content-Type: application/json" \
  -d '{"configId": "bot_xxxxxxxxxxxxx"}'

# Should return: {"success": true, "instanceId": "instance_xxxxx"}
```

#### Test 3: Check instances

```bash
curl http://localhost:3000/api/instances

# Should return array with your instance
```

### Recovery Steps

#### If Everything is Broken:

1. **Stop the bot:**
   ```bash
   # Press Ctrl+C in terminal
   ```

2. **Clear state files:**
   ```bash
   rm data/bot-configs.json
   # Keep data/state.json (your transaction history)
   ```

3. **Restart:**
   ```bash
   npm start
   ```

4. **Import from .env:**
   - Go to Configurations page
   - Click "Import from .env"
   - Start the imported config

#### If Instances are Stuck:

```bash
# Stop all bots via API
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID_1/stop
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID_2/stop

# Or restart the whole bot (Ctrl+C then npm start)
```

### Verification Checklist

After starting a bot, verify:

- [ ] Backend console shows "Bot instance started successfully"
- [ ] Backend console shows "X running instances"
- [ ] `GET /api/instances` returns the instance
- [ ] Debug panel shows correct instance count
- [ ] Instance appears in "Running Instances" tab
- [ ] Status badge shows "✓ running"
- [ ] Can stop the instance successfully

### Getting Help

If still not working, gather this information:

1. **Backend console output** (full logs from `npm start`)
2. **Browser console** (F12 → Console tab, copy any errors)
3. **Network tab** (F12 → Network, filter to API calls)
4. **Debug panel data** (screenshot or copy JSON)
5. **Config file contents:**
   ```bash
   cat data/bot-configs.json
   ```

### Expected Behavior

#### Successful Flow:

1. **User clicks "Start"** on a configuration
   
2. **Frontend:**
   - Shows loading toast: "Starting [Name]..."
   - Sends POST to `/api/instances/start`

3. **Backend:**
   - Receives request
   - Loads configuration
   - Creates bot instance
   - Initializes modules (sniper/copy/AMM)
   - Marks instance as "running"
   - Returns success + instanceId

4. **Frontend:**
   - Receives success response
   - Shows success toast
   - Waits 500ms
   - Fetches updated instance list
   - Displays instance in "Running Instances" tab

5. **User sees:**
   - Success notification
   - Instance in Running Instances tab
   - Status badge showing "✓ running"

### Still Having Issues?

Enable maximum logging:

**Backend (`src/botManager.ts`):**
- Already has extensive console.log statements
- Watch terminal for these markers: 🚀 📝 📊 ✅

**Frontend:**
- Open browser console (F12)
- Watch for: 📥 Frontend logs
- Check Network tab for API responses

**API Server:**
- Console shows: 📡 API logs
- Every request is logged

### Quick Reset

If you need to start fresh:

```bash
# 1. Stop the bot (Ctrl+C)

# 2. Remove config data (keeps transaction history)
rm data/bot-configs.json

# 3. Restart
npm start

# 4. Go to Configurations page

# 5. Click "Import from .env" to recreate default config

# 6. Start the imported config
```

---

**Still stuck?** Check the console logs carefully - they'll tell you exactly what's happening (or not happening) at each step.
