# Bot Logging System Guide

## Overview

A comprehensive logging system has been implemented to track all bot activities in real-time. This system captures detailed logs for each bot instance independently and displays them in the frontend for easy monitoring and verification.

## Key Features

### 1. **Per-Bot Logging**
- Each bot instance has its own isolated log stream
- Logs are tagged with bot ID and bot name for easy identification
- System-wide logs are also available for monitoring all bots together

### 2. **Real-Time Updates**
- Logs are broadcast via WebSocket to all connected dashboards
- No need to refresh - logs appear instantly as events happen
- Auto-scroll feature keeps the latest logs in view

### 3. **Comprehensive Coverage**
All major bot activities are logged:

#### AMM Bot Logs:
- **Arbitrage Detection & Execution**
  - Opportunities found and evaluated
  - Trade execution (buy/sell)
  - Profit calculations
  - Transaction hashes for verification

- **Liquidity Provision**
  - Pool scanning and filtering
  - Position entry with deposit amounts
  - Position monitoring (value, APR, impermanent loss)
  - Position exits with profit/loss details

- **Database Operations**
  - Transaction recording
  - Position tracking
  - User data updates

#### Bot Manager Logs:
- Bot instance lifecycle (start/stop/restart)
- Module initialization (Sniper, Copy Trading, AMM)
- Configuration details
- Error handling

### 4. **Transaction Verification**
All transactions now include transaction hashes that link directly to XRPscan.com for independent verification:

- **Arbitrage trades**: Includes both buy and sell transaction hashes
- **LP entries/exits**: Includes deposit/withdrawal transaction hashes
- **Recent Transactions** component shows XRPscan verification links

## Using the Logging System

### Viewing Bot Logs

1. **Per-Bot Logs:**
   - Go to "Configurations" page
   - Navigate to "Running Instances" tab
   - Click "📋 View Logs" on any running bot
   - Filter by log level (info, success, warning, error, debug)
   - Filter by category (Arbitrage, Liquidity, BotManager, etc.)

2. **System Logs:**
   - Go to "Configurations" page
   - Click "📜 System Logs" button
   - View aggregated logs from all bots and system components

### Log Levels

- **🔍 Debug**: Detailed diagnostic information
- **ℹ️ Info**: General informational messages
- **✅ Success**: Successful operations and completions
- **⚠️ Warning**: Warning messages (non-critical issues)
- **❌ Error**: Error messages requiring attention

### Log Categories

- **BotManager**: Bot lifecycle and orchestration
- **User**: User account operations
- **Sniper**: Sniper module activity
- **CopyTrading**: Copy trading module activity
- **AMM**: AMM bot general operations
- **Arbitrage**: Arbitrage detection and execution
- **Liquidity**: LP position management
- **Database**: Database operations and persistence
- **API**: API server events

## Verifying Activity on XRPscan

### Recent Transactions Component

The dashboard now includes a "Recent Transactions" component on the Overview page that shows:

- Transaction type and token
- Amount traded
- Profit/loss with percentage
- Time of transaction
- **Direct link to verify on XRPscan.com**

To verify a transaction:
1. Go to the Overview page
2. Find the transaction in "Recent Transactions"
3. Click the "🔍 Verify" button
4. XRPscan will open showing the on-chain transaction details

### Manual Verification

You can also manually verify using transaction hashes from logs:
1. View logs for a bot instance
2. Find the transaction log entry
3. Expand "View data" to see the transaction hash
4. Visit `https://xrpscan.com/tx/{TRANSACTION_HASH}`

## Log Storage

- Logs are stored in `data/bot-logs.json`
- Up to 5,000 system-wide logs are kept
- Up to 1,000 logs per bot instance
- Logs are persisted across bot restarts
- Periodic auto-save every 100 log entries

## API Endpoints

### Get All Logs
```
GET /api/logs
Query params:
  - limit: number (default: 500)
  - level: string (info|success|warning|error|debug)
  - category: string
```

### Get Bot-Specific Logs
```
GET /api/logs/bot/:botId
Query params:
  - limit: number (default: 500)
  - level: string
```

### Clear Logs
```
DELETE /api/logs              # Clear all logs
DELETE /api/logs/bot/:botId   # Clear logs for specific bot
```

## Troubleshooting Discrepancies

If your dashboard shows different information than XRPscan.com:

### 1. Check Bot Logs
- View the bot's logs to see exactly what transactions were executed
- Look for transaction hashes in the log data
- Verify the timestamps match your expectations

### 2. Verify Transaction Hashes
- Use the XRPscan links in Recent Transactions
- Compare the on-chain data with what the bot logged
- Check for any error messages in the logs

### 3. Monitor Active Positions
The bot now logs:
- Initial position entry with exact amounts and LP tokens
- Periodic position value updates
- Current APR and impermanent loss
- Exit conditions and triggers

Compare these logged values with what you see on-chain.

### 4. Common Issues

**Position count mismatch:**
- Check logs for position entries and exits
- Verify all LP exits have corresponding transaction hashes
- Look for error logs during position management

**Transaction not showing:**
- Ensure the bot has completed startup (check system logs)
- Verify the transaction was actually executed (not just detected)
- Check for error logs that may indicate failed transactions

**Profit calculations differ:**
- Logs show exact amounts before/after trades
- Check for slippage in transaction logs
- Compare initial deposit vs final withdrawal amounts in logs

## Best Practices

1. **Monitor Regularly**: Check logs periodically to ensure bots are operating as expected
2. **Use Filters**: Use level and category filters to focus on specific activities
3. **Auto-Scroll**: Enable auto-scroll when actively monitoring live trading
4. **Cross-Reference**: Always cross-reference important transactions on XRPscan
5. **Save Important Logs**: Download or screenshot critical log entries for your records

## Example Log Entries

### Successful Arbitrage
```json
{
  "timestamp": "2026-02-15T10:30:45.123Z",
  "level": "success",
  "botId": "instance_12345",
  "botName": "AMM Arbitrage Bot",
  "category": "Arbitrage",
  "message": "Arbitrage executed successfully",
  "data": {
    "token": "SOLO",
    "actualProfit": 15.5,
    "txHashes": ["ABC123...", "DEF456..."],
    "executionTime": 1250
  }
}
```

### LP Position Entry
```json
{
  "timestamp": "2026-02-15T10:25:30.456Z",
  "level": "success",
  "botId": "instance_12345",
  "botName": "AMM Liquidity Bot",
  "category": "Liquidity",
  "message": "Position entered successfully",
  "data": {
    "pool": "SOLO/XRP",
    "lpTokens": 1250.5,
    "txHash": "GHI789...",
    "depositAmount": 100,
    "estimatedAPR": "45.5%"
  }
}
```

## Integration with Other Components

### Dashboard Pages
- **Overview**: Shows recent transactions with verification links
- **Configurations**: Main hub for viewing all logs
- **Positions**: Can be cross-referenced with position logs

### WebSocket Events
Logs are broadcast in real-time via:
- `log` event: Individual log entries as they occur
- `initialLogs` event: Recent logs sent on dashboard connection

## Summary

The new logging system provides complete visibility into bot operations:
- ✅ Every action is logged with detailed context
- ✅ Each bot has isolated, filterable logs
- ✅ Transaction hashes link to XRPscan for verification
- ✅ Real-time updates keep you informed instantly
- ✅ Persistent storage across restarts
- ✅ Easy troubleshooting with categorized logs

Use these logs to confidently monitor your bots and verify all trading activity matches on-chain data on XRPscan.com.
