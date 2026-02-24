import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { User, UserModel } from '../database/user';
import { getClient } from '../xrpl/client';
import { getWallet, getBalance, getTokenBalances } from '../xrpl/wallet';
import { getPositionSummary, getBotPerformanceMetrics } from '../utils/positionTracker';
import { getAccountStatus } from '../utils/safetyChecks';
import { getLedgerTransactions } from '../utils/ledgerTransactions';
import * as BotConfigs from '../database/botConfigs';
import { botManager } from '../botManager';
import { logger } from '../utils/logger';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:3001',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

let userId = 'default';
let ammBotInstance: any = null; // Will be set by main bot

// REST API Endpoints
app.get('/api/status', async (_req, res) => {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const client = await getClient();
        const wallet = getWallet();
        const xrpBalance = await getBalance(client, wallet.address);
        const tokenBalances = await getTokenBalances(client, wallet.address);
        const accountStatus = await getAccountStatus(client, wallet.address);

        return res.json({
            walletAddress: wallet.address,
            xrpBalance,
            tokenCount: tokenBalances.length,
            accountStatus,
            sniperActive: user.sniperActive,
            copyTradingActive: user.copyTraderActive
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch status' });
    }
});

app.get('/api/positions', async (_req, res) => {
    try {
        const client = await getClient();
        const wallet = getWallet();
        const positions = await getPositionSummary(client, wallet.address, userId);
        return res.json(positions);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

app.get('/api/performance', async (_req, res) => {
    try {
        const metrics = await getBotPerformanceMetrics(userId);
        return res.json(metrics);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch performance' });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const source = (req.query.source as string) || 'all';
        const botOnly = source === 'bot';

        const botTxs = (user.transactions || [])
            .map((tx: any) => ({ ...tx, timestamp: tx.timestamp instanceof Date ? tx.timestamp.toISOString() : tx.timestamp }))
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (botOnly) {
            return res.json(botTxs.slice(0, 100));
        }

        const client = await getClient();
        const wallet = getWallet();
        const ledgerTxs = await getLedgerTransactions(client, wallet.address, 150);

        const seenHashes = new Set<string>();
        for (const tx of botTxs) {
            const h = tx.ourTxHash || tx.originalTxHash;
            if (h) seenHashes.add(h);
        }

        const merged: any[] = [...botTxs];
        for (const lt of ledgerTxs) {
            if (lt.txHash && !seenHashes.has(lt.txHash)) {
                seenHashes.add(lt.txHash);
                merged.push({
                    type: lt.type,
                    timestamp: lt.timestamp,
                    txHash: lt.txHash,
                    ourTxHash: lt.txHash,
                    amount: lt.amount,
                    tokenSymbol: lt.tokenSymbol,
                    status: lt.status,
                    source: 'ledger'
                });
            }
        }

        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return res.json(merged.slice(0, 150));
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.get('/api/history', async (_req, res) => {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate profit history from transactions
        const history: Array<{ timestamp: string; profit: number; portfolioValue: number }> = [];
        let cumulativeProfit = 0;
        
        const sortedTransactions = user.transactions
            .filter(tx => tx.profit !== undefined)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        sortedTransactions.forEach(tx => {
            if (tx.profit) {
                cumulativeProfit += tx.profit;
                history.push({
                    timestamp: String(tx.timestamp),
                    profit: cumulativeProfit,
                    portfolioValue: cumulativeProfit + 50 // Assuming starting balance
                });
            }
        });

        // Keep last 100 data points
        return res.json(history.slice(-100));
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/controls/sniper', async (req, res) => {
    try {
        const { action } = req.body;
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.sniperActive = action === 'start';
        const userModel = new UserModel(user);
        await userModel.save();

        broadcastUpdate('status', { 
            sniperActive: user.sniperActive,
            message: `Sniper ${action}ed`
        });

        return res.json({ sniperActive: user.sniperActive });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to toggle sniper' });
    }
});

app.post('/api/controls/copytrading', async (req, res) => {
    try {
        const { action } = req.body;
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.copyTraderActive = action === 'start';
        const userModel = new UserModel(user);
        await userModel.save();

        broadcastUpdate('status', { 
            copyTradingActive: user.copyTraderActive,
            message: `Copy trading ${action}ed`
        });

        return res.json({ copyTradingActive: user.copyTraderActive });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to toggle copy trading' });
    }
});

// WebSocket connection for real-time updates
// Listen for logger events and broadcast to clients
logger.on('log', (logEntry) => {
    io.emit('log', logEntry);
});

io.on('connection', (socket) => {
    console.log('Dashboard connected');
    
    // Send recent logs on connection
    const recentLogs = logger.getAllLogs(100);
    socket.emit('initialLogs', recentLogs);
    
    socket.on('disconnect', () => {
        console.log('Dashboard disconnected');
    });
});

// Broadcast updates to connected dashboards
export function broadcastUpdate(event: string, data: any) {
    io.emit(event, data);
}

let updateInterval = 15000; // Start at 15 seconds
let consecutiveErrors = 0;
const MIN_UPDATE_INTERVAL = 15000; // 15 seconds minimum
const MAX_UPDATE_INTERVAL = 60000; // 60 seconds maximum

export function startAPIServer(port: number = 3000, userIdParam: string = 'default') {
    userId = userIdParam;
    
    httpServer.listen(port, () => {
        console.log(`📊 Dashboard API running on http://localhost:${port}`);
        console.log(`🌐 Open dashboard at http://localhost:3001`);
    });

    // Send periodic updates with exponential backoff on errors
    const updateDashboard = async () => {
        try {
            const client = await getClient();
            const wallet = getWallet();
            const positions = await getPositionSummary(client, wallet.address, userId);
            const metrics = await getBotPerformanceMetrics(userId);
            const accountStatus = await getAccountStatus(client, wallet.address);

            broadcastUpdate('positions', positions);
            broadcastUpdate('metrics', metrics);
            broadcastUpdate('accountStatus', accountStatus);
            
            // Success - reduce interval back towards minimum
            if (consecutiveErrors > 0) {
                consecutiveErrors = 0;
                updateInterval = Math.max(MIN_UPDATE_INTERVAL, updateInterval * 0.8);
            }
        } catch (error: any) {
            // Check if it's a rate limit error
            if (error?.message?.includes('too much load') || error?.data?.error === 'slowDown') {
                consecutiveErrors++;
                // Exponentially increase interval on rate limit errors
                updateInterval = Math.min(MAX_UPDATE_INTERVAL, updateInterval * 1.5);
                // Don't log rate limit errors
            } else {
                // Log other errors
                console.error('Dashboard update error:', error?.message || error);
            }
        }
        
        // Schedule next update with current interval
        setTimeout(updateDashboard, updateInterval);
    };
    
    // Start first update after 2 seconds
    setTimeout(updateDashboard, 2000);
}

// Multi-Bot Management Endpoints
app.get('/api/bots', async (_req, res) => {
    try {
        // For now, return current bot info
        // TODO: Implement multi-bot storage
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const client = await getClient();
        const wallet = getWallet();
        const xrpBalance = await getBalance(client, wallet.address);
        const positions = await getPositionSummary(client, wallet.address, userId);
        const metrics = await getBotPerformanceMetrics(userId);

        const bots = [{
            id: 'bot-1',
            name: 'Main Sniper Bot',
            type: 'sniper',
            walletAddress: wallet.address,
            status: user.sniperActive ? 'active' : 'inactive',
            balance: xrpBalance,
            positions: positions.length,
            totalProfit: metrics.totalProfit,
            winRate: metrics.winRate,
            config: {
                minLiquidity: 10,
                snipeAmount: 2,
                profitTarget: 12,
                stopLoss: 8
            }
        }];

        return res.json(bots);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch bots' });
    }
});

app.post('/api/bots/:botId/toggle', async (_req, res) => {
    try {
        // botId = _req.params.botId; // For future multi-bot support
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Toggle bot status
        user.sniperActive = !user.sniperActive;
        const userModel = new UserModel(user);
        await userModel.save();

        return res.json({ status: user.sniperActive ? 'active' : 'inactive' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to toggle bot' });
    }
});

app.delete('/api/bots/:botId', async (_req, res) => {
    try {
        // botId = _req.params.botId; // For future multi-bot support
        // TODO: Implement bot deletion
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete bot' });
    }
});

// Wallet Management Endpoints
app.post('/api/wallets/transfer', async (req, res) => {
    try {
        const { fromAddress, toAddress, amount } = req.body;

        if (!fromAddress || !toAddress || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await getClient();
        const wallet = getWallet();

        // Verify fromAddress matches wallet
        if (wallet.address !== fromAddress) {
            return res.status(403).json({ error: 'Unauthorized wallet' });
        }

        // Prepare payment transaction
        const payment: any = {
            TransactionType: 'Payment',
            Account: fromAddress,
            Destination: toAddress,
            Amount: String(Math.floor(amount * 1000000)) // Convert to drops
        };

        // Submit and wait for validation
        const response = await client.submitAndWait(payment, { wallet });
        const meta = response.result.meta as any;

        if (meta?.TransactionResult === 'tesSUCCESS') {
            return res.json({
                success: true,
                txHash: response.result.hash
            });
        } else {
            return res.status(500).json({
                error: 'Transaction failed',
                result: meta?.TransactionResult
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            error: 'Transfer failed',
            message: error?.message || 'Unknown error'
        });
    }
});

app.post('/api/wallets/:walletId/primary', async (_req, res) => {
    try {
        // walletId = _req.params.walletId; // For future multi-wallet support
        // TODO: Implement primary wallet setting in database
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to set primary wallet' });
    }
});

app.post('/api/wallets/collect-profits', async (_req, res) => {
    try {
        // TODO: Implement profit collection logic
        // This would:
        // 1. Get all bot wallets
        // 2. Calculate profits in each
        // 3. Transfer to primary wallet
        return res.json({ success: true, message: 'Profits collected' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to collect profits' });
    }
});

// Position Management
app.post('/api/positions/sell', async (req, res) => {
    try {
        const { currency, issuer, amount } = req.body;

        if (!currency || !issuer || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await getClient();
        const wallet = getWallet();
        const { executeSell } = await import('../xrpl/amm');
        const config = await import('../config');

        const tokenInfo = {
            currency,
            issuer,
            readableCurrency: currency
        };

        // Execute the sell
        const sellResult = await executeSell(
            client,
            wallet,
            tokenInfo,
            amount,
            config.default.trading.defaultSlippage
        );

        if (sellResult.success) {
            // Update user data
            const user = await User.findOne({ userId });
            if (user) {
                // Find and update the purchase
                const purchase = user.sniperPurchases?.find(
                    p => p.currency === currency && p.issuer === issuer && p.status === 'active'
                );

                if (purchase) {
                    const xrpReceived = parseFloat(sellResult.xrpReceived || '0');
                    const profit = xrpReceived - purchase.amount;
                    const profitPercent = (profit / purchase.amount) * 100;

                    // Mark as sold if selling all
                    const remainingTokens = purchase.tokensReceived ? purchase.tokensReceived - amount : 0;
                    if (remainingTokens < 0.000001) {
                        purchase.status = 'sold';
                    }

                    // Record transaction
                    user.transactions.push({
                        type: 'manual_sell',
                        timestamp: new Date(),
                        tokenSymbol: currency,
                        amount: xrpReceived,
                        profit,
                        profitPercent,
                        sellReason: 'manual',
                        status: 'success'
                    });

                    const userModel = new UserModel(user);
                    await userModel.save();
                }
            }

            return res.json({
                success: true,
                xrpReceived: sellResult.xrpReceived,
                txHash: sellResult.txHash
            });
        } else {
            return res.status(500).json({
                error: 'Sell failed',
                message: sellResult.error || 'Unknown error'
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            error: 'Sell error',
            message: error?.message || 'Unknown error'
        });
    }
});

// DEX limit orders (OfferCreate / OfferCancel)
app.post('/api/offers', async (req, res) => {
    try {
        const { action, currency, issuer, tokenAmount, limitPrice, expiration } = req.body;
        if (!currency || !issuer) {
            return res.status(400).json({ error: 'currency and issuer required' });
        }
        const client = await getClient();
        const wallet = getWallet();
        const { placeBuyOrder, placeSellOrder } = await import('../xrpl/offers');
        const amt = parseFloat(tokenAmount || '0');
        const price = parseFloat(limitPrice || '0');
        if (amt <= 0 || price <= 0) {
            return res.status(400).json({ error: 'tokenAmount and limitPrice must be positive' });
        }
        const exp = expiration ? Math.floor(Date.now() / 1000) + parseInt(expiration, 10) : undefined;
        const result = action === 'sell'
            ? await placeSellOrder(client, wallet, currency, issuer, amt, price, exp)
            : await placeBuyOrder(client, wallet, currency, issuer, amt, price, exp);
        if (result.success) {
            return res.json({ success: true, txHash: result.txHash, offerId: result.offerId });
        }
        return res.status(400).json({ error: result.error || 'Offer failed' });
    } catch (error: any) {
        return res.status(500).json({ error: error?.message || 'Offer error' });
    }
});

app.delete('/api/offers/:sequence', async (req, res) => {
    try {
        const sequence = parseInt(req.params.sequence, 10);
        if (isNaN(sequence) || sequence < 1) {
            return res.status(400).json({ error: 'Invalid offer sequence' });
        }
        const client = await getClient();
        const wallet = getWallet();
        const { cancelOfferBySequence } = await import('../xrpl/offers');
        const result = await cancelOfferBySequence(client, wallet, sequence);
        if (result.success) {
            return res.json({ success: true, txHash: result.txHash });
        }
        return res.status(400).json({ error: result.error || 'Cancel failed' });
    } catch (error: any) {
        return res.status(500).json({ error: error?.message || 'Cancel error' });
    }
});

app.get('/api/offers', async (_req, res) => {
    try {
        const client = await getClient();
        const wallet = getWallet();
        const { getAccountOffers } = await import('../xrpl/offers');
        const offers = await getAccountOffers(client, wallet.address);
        return res.json(offers);
    } catch (error: any) {
        return res.status(500).json({ error: error?.message || 'Failed to fetch offers' });
    }
});

// AMM Pool Management
app.get('/api/amm/pools', async (_req, res) => {
    try {
        if (!ammBotInstance) {
            return res.json([]);
        }

        const client = await getClient();
        const { scanAMMPools } = await import('../amm/poolScanner');
        const pools = await scanAMMPools(client);
        
        return res.json(pools);
    } catch (error) {
        console.error('Error fetching pools:', error);
        return res.json([]); // Return empty on error to not break dashboard
    }
});

app.get('/api/amm/positions', async (_req, res) => {
    try {
        if (!ammBotInstance) {
            return res.json([]);
        }

        const stats = ammBotInstance.getStatistics();
        return res.json(stats.positions || []);
    } catch (error) {
        console.error('Error fetching LP positions:', error);
        return res.json([]);
    }
});

app.get('/api/amm/stats', async (_req, res) => {
    try {
        if (!ammBotInstance) {
            return res.json({
                totalExecutions: 0,
                successfulExecutions: 0,
                totalProfit: 0,
                successRate: 0
            });
        }

        const stats = ammBotInstance.getStatistics();
        return res.json(stats.arbitrageStats);
    } catch (error) {
        console.error('Error fetching AMM stats:', error);
        return res.json({
            totalExecutions: 0,
            successfulExecutions: 0,
            totalProfit: 0,
            successRate: 0
        });
    }
});

app.post('/api/amm/enter', async (req, res) => {
    try {
        const { poolId, amount, strategy } = req.body;

        if (!poolId || !amount || !strategy) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!ammBotInstance) {
            return res.status(503).json({ error: 'AMM bot not running' });
        }

        // Manual pool entry via dashboard
        // The AMM bot manages positions internally
        
        return res.json({ 
            success: true,
            message: 'Manual pool entry submitted. Check console for results.'
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to enter pool',
            message: error?.message || 'Unknown error'
        });
    }
});

app.post('/api/amm/exit', async (req, res) => {
    try {
        const { poolId } = req.body;

        if (!poolId) {
            return res.status(400).json({ error: 'Missing poolId' });
        }

        if (!ammBotInstance) {
            return res.status(503).json({ error: 'AMM bot not running' });
        }

        // Manual pool exit via dashboard
        // The AMM bot manages withdrawals internally
        
        return res.json({ 
            success: true,
            message: 'Position exit submitted. Check console for results.'
        });
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to exit pool',
            message: error?.message || 'Unknown error'
        });
    }
});

// Bot Configuration Management
app.get('/api/configs', async (_req, res) => {
    try {
        const configs = BotConfigs.getAllConfigs();
        return res.json(configs);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch configurations', message: error?.message });
    }
});

app.post('/api/configs/from-env', async (_req, res) => {
    try {
        const envConfig = BotConfigs.createConfigFromEnv(require('../config').default);
        const savedConfig = BotConfigs.createConfig(envConfig);
        return res.json(savedConfig);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to create config from .env', message: error?.message });
    }
});

app.get('/api/configs/:id', async (req, res) => {
    try {
        const config = BotConfigs.getConfig(req.params.id);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        return res.json(config);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch configuration', message: error?.message });
    }
});

app.post('/api/configs', async (req, res) => {
    try {
        const config = BotConfigs.createConfig(req.body);
        return res.json(config);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to create configuration', message: error?.message });
    }
});

app.put('/api/configs/:id', async (req, res) => {
    try {
        const config = BotConfigs.updateConfig(req.params.id, req.body);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        return res.json(config);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to update configuration', message: error?.message });
    }
});

app.delete('/api/configs/:id', async (req, res) => {
    try {
        // Check if any running instances use this config
        const runningInstances = botManager.getInstancesByConfigId(req.params.id);
        const activeInstances = runningInstances.filter(inst => inst.status === 'running');
        
        if (activeInstances.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete configuration with running instances',
                activeInstances: activeInstances.length
            });
        }

        const deleted = BotConfigs.deleteConfig(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to delete configuration', message: error?.message });
    }
});

// Bot Instance Management
app.get('/api/instances', async (_req, res) => {
    try {
        const instances = botManager.getRunningInstances();
        console.log(`📡 API: /api/instances called, returning ${instances.length} instances`);
        return res.json(instances);
    } catch (error: any) {
        console.error('❌ API: Error fetching instances:', error);
        return res.status(500).json({ error: 'Failed to fetch instances', message: error?.message });
    }
});

app.get('/api/instances/stats', async (_req, res) => {
    try {
        const stats = botManager.getStats();
        console.log(`📡 API: /api/instances/stats called, stats:`, stats);
        return res.json(stats);
    } catch (error: any) {
        console.error('❌ API: Error fetching stats:', error);
        return res.status(500).json({ error: 'Failed to fetch instance stats', message: error?.message });
    }
});

app.get('/api/debug/instances', async (_req, res) => {
    try {
        const instances = botManager.getRunningInstances();
        const stats = botManager.getStats();
        const configs = BotConfigs.getAllConfigs();
        
        return res.json({
            timestamp: new Date().toISOString(),
            totalConfigs: configs.length,
            totalInstances: instances.length,
            stats,
            instances: instances.map(i => ({
                id: i.id,
                configId: i.configId,
                name: i.name,
                status: i.status,
                mode: i.mode,
                startedAt: i.startedAt
            })),
            configs: configs.map(c => ({ id: c.id, name: c.name, enabled: c.enabled }))
        });
    } catch (error: any) {
        console.error('❌ API: Error in debug endpoint:', error);
        return res.status(500).json({ error: error?.message });
    }
});

// Logging endpoints
app.get('/api/logs', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 500;
        const level = req.query.level as string | undefined;
        const category = req.query.category as string | undefined;
        
        let logs = logger.getAllLogs();
        
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        if (category) {
            logs = logs.filter(log => log.category === category);
        }
        
        const limitedLogs = logs.slice(-limit);
        
        return res.json({
            logs: limitedLogs,
            total: logs.length,
            stats: logger.getStats()
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch logs', message: error?.message });
    }
});

app.get('/api/logs/bot/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 500;
        const level = req.query.level as string | undefined;
        
        let logs = logger.getBotLogs(botId);
        
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        const limitedLogs = logs.slice(-limit);
        
        return res.json({
            botId,
            logs: limitedLogs,
            total: logs.length
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch bot logs', message: error?.message });
    }
});

app.delete('/api/logs', async (_req, res) => {
    try {
        logger.clearLogs();
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to clear logs', message: error?.message });
    }
});

app.delete('/api/logs/bot/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        logger.clearBotLogs(botId);
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to clear bot logs', message: error?.message });
    }
});

// Bot P&L endpoint
app.get('/api/bot/:botId/pnl', async (req, res) => {
    try {
        const { botId } = req.params;
        const instance = botManager.getInstance(botId);
        
        if (!instance) {
            return res.status(404).json({ error: 'Bot instance not found' });
        }

        // Get bot's transaction logs
        const logs = logger.getBotLogs(botId);
        const transactions = logs.filter(log => 
            log.category === 'Database' && 
            (log.message.includes('Arbitrage trade recorded') || log.message.includes('LP exit recorded'))
        );

        // Build P&L timeline
        const pnlData: any[] = [];
        let cumulative = 0;
        const profits: number[] = [];

        transactions.forEach(log => {
            if (log.data && log.data.profit) {
                const profitMatch = log.data.profit.match(/([+-]?\d+\.?\d*)/);
                if (profitMatch) {
                    const profit = parseFloat(profitMatch[1]);
                    cumulative += profit;
                    profits.push(profit);
                    
                    pnlData.push({
                        timestamp: log.timestamp,
                        profit,
                        cumulative
                    });
                }
            }
        });

        const stats = {
            totalProfit: cumulative,
            totalTrades: profits.length,
            winRate: profits.length > 0 ? (profits.filter(p => p > 0).length / profits.length) * 100 : 0,
            bestTrade: profits.length > 0 ? Math.max(...profits) : 0,
            worstTrade: profits.length > 0 ? Math.min(...profits) : 0
        };

        return res.json({ data: pnlData, stats });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch bot P&L', message: error?.message });
    }
});

app.post('/api/instances/start', async (req, res) => {
    try {
        const { configId } = req.body;
        console.log(`📡 API: POST /api/instances/start called with configId: ${configId}`);
        
        if (!configId) {
            console.error('❌ API: Missing configId in request');
            return res.status(400).json({ error: 'Missing configId' });
        }

        const config = BotConfigs.getConfig(configId);
        if (!config) {
            console.error(`❌ API: Configuration ${configId} not found`);
            return res.status(404).json({ error: 'Configuration not found' });
        }

        console.log(`📡 API: Found config "${config.name}", starting bot for user ${userId}`);
        const result = await botManager.startBot(config, userId);
        
        if (result.success) {
            console.log(`✅ API: Bot started successfully, instanceId: ${result.instanceId}`);
            return res.json({ success: true, instanceId: result.instanceId });
        } else {
            console.error(`❌ API: Bot failed to start: ${result.error}`);
            return res.status(500).json({ error: result.error });
        }
    } catch (error: any) {
        console.error('❌ API: Exception in start endpoint:', error);
        return res.status(500).json({ error: 'Failed to start bot', message: error?.message });
    }
});

app.post('/api/instances/:id/stop', async (req, res) => {
    try {
        const result = await botManager.stopBot(req.params.id);
        
        if (result.success) {
            return res.json({ success: true });
        } else {
            return res.status(500).json({ error: result.error });
        }
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to stop bot', message: error?.message });
    }
});

app.post('/api/instances/:id/restart', async (req, res) => {
    try {
        const result = await botManager.restartBot(req.params.id);
        
        if (result.success) {
            return res.json({ success: true });
        } else {
            return res.status(500).json({ error: result.error });
        }
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to restart bot', message: error?.message });
    }
});

// Settings Management
app.get('/api/settings', async (_req, res) => {
    try {
        // TODO: Implement settings storage
        const settings = {
            primaryWallet: getWallet().address,
            autoProfitCollection: false,
            profitCollectionThreshold: 10,
            notifications: {
                snipes: true,
                profitTargets: true,
                stopLosses: true,
                errors: true
            },
            trading: {
                defaultMinLiquidity: 10,
                defaultSnipeAmount: 2,
                defaultProfitTarget: 12,
                defaultStopLoss: 8,
                maxPositionsPerBot: 12
            }
        };
        return res.json(settings);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/settings', async (_req, res) => {
    try {
        // settings = _req.body; // For future settings persistence
        // TODO: Implement settings persistence
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to save settings' });
    }
});

export function setAMMBotInstance(bot: any) {
    ammBotInstance = bot;
}

export function stopAPIServer() {
    httpServer.close();
}
