import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { User, UserModel } from '../database/user';
import { getClient } from '../xrpl/client';
import { getBalance, getTokenBalances } from '../xrpl/wallet';
import { Wallet } from 'xrpl';
import { getWalletForUser, getWalletAddressForUser, setWalletSeedForUser, generateNewWallet, listWalletOptions, getSeedForAddress } from '../xrpl/walletProvider';
import { getPositionSummary, getBotPerformanceMetrics } from '../utils/positionTracker';
import { getAccountStatus } from '../utils/safetyChecks';
import { getLedgerTransactions } from '../utils/ledgerTransactions';
import * as BotConfigs from '../database/botConfigs';
import type { BotConfiguration } from '../database/botConfigs';
import { loadSettings, saveSettings, AppSettings } from '../database/settingsStore';

function getEnabledStrategiesForConfig(config: BotConfiguration): Array<'sniper' | 'copyTrading' | 'amm'> {
    const out: Array<'sniper' | 'copyTrading' | 'amm'> = [];
    if (config.sniper.enabled && (config.mode === 'sniper' || config.mode === 'hybrid')) out.push('sniper');
    if (config.copyTrading.enabled && (config.mode === 'copyTrading' || config.mode === 'hybrid')) out.push('copyTrading');
    if (config.amm.enabled && (config.mode === 'amm' || config.mode === 'hybrid')) out.push('amm');
    return out;
}
import { botManager } from '../botManager';
import { logger } from '../utils/logger';
import { startSniper, stopSniper, isRunningSniper } from '../sniper';
import { startCopyTrading, stopCopyTrading, isRunningCopyTrading } from '../copyTrading';
import { llmCapitalManager } from '../llmCapital/manager';
import { XRPLMCPClient } from '../mcp/xrplMcpClient';

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
const mcpClient = new XRPLMCPClient();

// REST API Endpoints
app.get('/api/status', async (_req, res) => {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const client = await getClient();
        const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
        const { action } = req.body as { action: 'start' | 'stop' };
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (action === 'start') {
            const result = await startSniper(userId);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Failed to start sniper' });
            }
        } else if (action === 'stop') {
            const result = await stopSniper(userId);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Failed to stop sniper' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action. Use start|stop' });
        }

        const updated = await User.findOne({ userId });
        const sniperActive = !!updated?.sniperActive && isRunningSniper();

        broadcastUpdate('status', {
            sniperActive,
            message: `Sniper ${action}ed`
        });

        return res.json({ sniperActive });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to toggle sniper' });
    }
});

app.post('/api/controls/copytrading', async (req, res) => {
    try {
        const { action } = req.body as { action: 'start' | 'stop' };
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (action === 'start') {
            const result = await startCopyTrading(userId);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Failed to start copy trading' });
            }
        } else if (action === 'stop') {
            const result = await stopCopyTrading(userId);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Failed to stop copy trading' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action. Use start|stop' });
        }

        const updated = await User.findOne({ userId });
        const copyTradingActive = !!updated?.copyTraderActive && isRunningCopyTrading();

        broadcastUpdate('status', {
            copyTradingActive,
            message: `Copy trading ${action}ed`
        });

        return res.json({ copyTradingActive });
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
            const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
app.post('/api/wallets/generate', (_req, res) => {
    try {
        const wallet = generateNewWallet();
        return res.json({
            address: wallet.address,
            publicKey: wallet.publicKey,
            seed: wallet.seed,
            warning: 'Store this seed securely. It is returned only once. Do not share or log it.'
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to generate wallet', message: error?.message });
    }
});

app.get('/api/wallets/list', (_req, res) => {
    try {
        const options = listWalletOptions();
        return res.json({ wallets: options });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to list wallets', message: error?.message });
    }
});

/**
 * List all wallets known to the platform (seed store + default) with balance and linked agent (if any).
 * Used by the Wallets page so agent-created wallets appear.
 */
app.get('/api/wallets', async (_req, res) => {
    try {
        const options = listWalletOptions();
        const client = await getClient();
        const agents = llmCapitalManager.listAgents();
        const walletsWithBalance = await Promise.all(
            options.map(async (opt) => {
                let balance = 0;
                try {
                    balance = await getBalance(client, opt.walletAddress);
                } catch {
                    // leave 0
                }
                const agent = agents.find(a => a.walletAddress === opt.walletAddress);
                return {
                    userId: opt.userId,
                    walletAddress: opt.walletAddress,
                    label: opt.label,
                    balance,
                    agentId: agent?.id,
                    agentName: agent?.name
                };
            })
        );
        return res.json({ wallets: walletsWithBalance });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to list wallets', message: error?.message });
    }
});

/**
 * Fund a destination address (e.g. new agent wallet) from a master/source wallet.
 * Only works for source wallets we have the seed for (from seed store or default config).
 */
app.post('/api/wallets/fund-address', async (req, res) => {
    try {
        const { fromWalletAddress, toAddress, amount } = req.body as { fromWalletAddress?: string; toAddress?: string; amount?: number };

        if (!fromWalletAddress || !toAddress || amount == null || amount <= 0) {
            return res.status(400).json({ error: 'Missing or invalid: fromWalletAddress, toAddress, amount (positive number)' });
        }

        const seed = getSeedForAddress(fromWalletAddress.trim());
        if (!seed) {
            return res.status(400).json({
                error: 'Master wallet not found or not controlled by this platform. Use a wallet from the list (e.g. Default wallet or an existing agent wallet).'
            });
        }

        const masterWallet = Wallet.fromSeed(seed);
        if (masterWallet.address !== fromWalletAddress.trim()) {
            return res.status(400).json({ error: 'Master wallet address does not match' });
        }

        const client = await getClient();
        const drops = Math.floor(amount * 1_000_000);
        const payment: any = {
            TransactionType: 'Payment',
            Account: masterWallet.address,
            Destination: toAddress.trim(),
            Amount: String(drops)
        };

        const response = await client.submitAndWait(payment, { wallet: masterWallet });
        const meta = response.result.meta as any;

        if (meta?.TransactionResult === 'tesSUCCESS') {
            return res.json({
                success: true,
                txHash: response.result.hash,
                from: masterWallet.address,
                to: toAddress.trim(),
                amount
            });
        } else {
            return res.status(500).json({
                error: 'Transfer failed',
                result: meta?.TransactionResult
            });
        }
    } catch (error: any) {
        return res.status(500).json({
            error: 'Failed to fund address',
            message: error?.message || 'Unknown error'
        });
    }
});

app.post('/api/wallets/transfer', async (req, res) => {
    try {
        const { fromAddress, toAddress, amount } = req.body;

        if (!fromAddress || !toAddress || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await getClient();
        const trimmedFrom = String(fromAddress).trim();
        const seed = getSeedForAddress(trimmedFrom);
        if (!seed) {
            return res.status(403).json({
                error: 'From wallet is not controlled by this platform. Use a wallet from your Wallets list.'
            });
        }
        const wallet = Wallet.fromSeed(seed);

        // Prepare payment transaction
        const payment: any = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: String(toAddress).trim(),
            Amount: String(Math.floor(Number(amount) * 1000000)) // Convert to drops
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
        const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
        const wallet = getWalletForUser(userId);
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
            BotConfigs.updateConfig(configId, { enabled: true });
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
        const instance = botManager.getInstance(req.params.id);
        const result = await botManager.stopBot(req.params.id);
        
        if (result.success) {
            if (instance?.configId) {
                BotConfigs.updateConfig(instance.configId, { enabled: false });
            }
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
        const instance = botManager.getInstance(req.params.id);
        const result = await botManager.restartBot(req.params.id);
        
        if (result.success) {
            if (instance?.configId) {
                BotConfigs.updateConfig(instance.configId, { enabled: true });
            }
            return res.json({ success: true });
        } else {
            return res.status(500).json({ error: result.error });
        }
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to restart bot', message: error?.message });
    }
});

// LLM Capital Agent Management
app.get('/api/llm-agents', async (_req, res) => {
    try {
        return res.json({ agents: llmCapitalManager.listAgents() });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch LLM agents', message: error?.message });
    }
});

app.post('/api/llm-agents', async (req, res) => {
    try {
        const { name, userId: llmUserId, walletAddress, allocatedXrp, policy, parentId, defaultConfigId, prompt } = req.body;
        if (!name || !walletAddress || !allocatedXrp || !policy) {
            return res.status(400).json({ error: 'Missing required fields: name, walletAddress, allocatedXrp, policy' });
        }

        const agent = llmCapitalManager.createAgent({
            name,
            userId: llmUserId,
            walletAddress,
            allocatedXrp: Number(allocatedXrp),
            policy,
            parentId,
            defaultConfigId: defaultConfigId || undefined,
            prompt: prompt || undefined
        });

        return res.json({ success: true, agent });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to create LLM agent', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/spawn', async (req, res) => {
    try {
        const { name, walletAddress, allocatedXrp, policy } = req.body;
        if (!name || !walletAddress || !allocatedXrp) {
            return res.status(400).json({ error: 'Missing required fields: name, walletAddress, allocatedXrp' });
        }

        const child = llmCapitalManager.spawnChildAgent(req.params.id, {
            name,
            walletAddress,
            allocatedXrp: Number(allocatedXrp),
            policy
        });

        return res.json({ success: true, agent: child });
    } catch (error: any) {
        return res.status(400).json({ error: 'Failed to spawn child agent', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/status', async (req, res) => {
    try {
        const { status } = req.body as { status: 'active' | 'paused' | 'error' };
        if (!status || !['active', 'paused', 'error'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use active|paused|error' });
        }

        const agent = llmCapitalManager.updateAgentStatus(req.params.id, status);
        return res.json({ success: true, agent });
    } catch (error: any) {
        return res.status(400).json({ error: 'Failed to update agent status', message: error?.message });
    }
});

app.patch('/api/llm-agents/:id', async (req, res) => {
    try {
        const { defaultConfigId, prompt } = req.body as { defaultConfigId?: string | null; prompt?: string | null };
        const agent = llmCapitalManager.updateAgent(req.params.id, { defaultConfigId, prompt });
        return res.json({ success: true, agent });
    } catch (error: any) {
        return res.status(400).json({ error: 'Failed to update agent', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/bind-existing-wallet', async (req, res) => {
    try {
        const { walletAddress } = req.body as { walletAddress: string };
        if (!walletAddress || typeof walletAddress !== 'string') {
            return res.status(400).json({ error: 'Missing required field: walletAddress' });
        }

        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        if (agent.walletAddress !== walletAddress.trim()) {
            return res.status(400).json({
                error: 'Wallet address does not match this agent. Create the agent with this wallet address first.'
            });
        }

        const seed = getSeedForAddress(walletAddress);
        if (!seed) {
            return res.status(400).json({
                error: 'No known seed for this wallet. Use "Bind seed" with the wallet secret, or select a wallet that is already on this platform.'
            });
        }

        setWalletSeedForUser(agent.userId, seed);
        return res.json({ success: true, userId: agent.userId, walletAddress: agent.walletAddress });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to bind existing wallet', message: error?.message });
    }
});

app.get('/api/llm-agents/:id/instances', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const instances = botManager.getInstancesByUserId(agent.userId);
        return res.json({ userId: agent.userId, instances });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch LLM agent instances', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/wallet-seed', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const { seed } = req.body as { seed: string };
        if (!seed) {
            return res.status(400).json({ error: 'Missing required field: seed' });
        }

        const bound = setWalletSeedForUser(agent.userId, seed);
        if (bound.walletAddress !== agent.walletAddress) {
            return res.status(400).json({
                error: 'Seed wallet address does not match agent wallet address',
                expected: agent.walletAddress,
                got: bound.walletAddress
            });
        }

        return res.json({ success: true, userId: agent.userId, walletAddress: bound.walletAddress });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to set LLM agent wallet seed', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/start-config', async (req, res) => {
    try {
        let { configId } = req.body as { configId?: string };
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        if (!configId && agent.defaultConfigId) {
            configId = agent.defaultConfigId;
        }
        if (!configId) {
            return res.status(400).json({ error: 'Missing configId. Set a default config for this agent or pass configId in the request.' });
        }
        if (agent.status !== 'active') {
            return res.status(400).json({ error: `Agent must be active (current: ${agent.status})` });
        }

        const config = BotConfigs.getConfig(configId!);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        const enabledStrategies = getEnabledStrategiesForConfig(config);
        const notAllowed = enabledStrategies.filter(s => !agent.policy.allowedStrategies.includes(s));
        if (notAllowed.length > 0) {
            return res.status(400).json({
                error: `Config enables strategies not allowed for this agent: ${notAllowed.join(', ')}. Allowed: ${agent.policy.allowedStrategies.join(', ')}.`
            });
        }

        const runtimeWallet = getWalletAddressForUser(agent.userId);
        if (agent.walletAddress !== runtimeWallet) {
            return res.status(400).json({
                error: 'Agent wallet does not match currently configured runtime wallet. Multi-seed wallet routing not yet enabled.',
                runtimeWallet,
                agentWallet: agent.walletAddress
            });
        }

        const result = await botManager.startBot(config, agent.userId);
        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to start config for agent' });
        }

        BotConfigs.updateConfig(configId, { enabled: true });
        return res.json({ success: true, instanceId: result.instanceId, userId: agent.userId });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to start LLM agent config', message: error?.message });
    }
});

app.post('/api/llm-agents/:id/stop-all', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const instances = botManager.getInstancesByUserId(agent.userId)
            .filter(i => i.status === 'running');

        const results = await Promise.all(instances.map(i => botManager.stopBot(i.id)));
        const failed = results.filter(r => !r.success);

        if (failed.length > 0) {
            return res.status(500).json({ error: 'Some instances failed to stop', details: failed });
        }

        return res.json({ success: true, stopped: instances.length, userId: agent.userId });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to stop LLM agent instances', message: error?.message });
    }
});

/** Start agent: set status active and run with its default config (one-click). */
app.post('/api/llm-agents/:id/start', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const configId = agent.defaultConfigId;
        if (!configId) {
            return res.status(400).json({ error: 'Set a config for this agent first (Config dropdown), then start the agent.' });
        }

        const config = BotConfigs.getConfig(configId);
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found. The selected config may have been deleted.' });
        }

        const enabledStrategies = getEnabledStrategiesForConfig(config);
        const notAllowed = enabledStrategies.filter(s => !agent.policy.allowedStrategies.includes(s));
        if (notAllowed.length > 0) {
            return res.status(400).json({
                error: `Config enables strategies not allowed for this agent: ${notAllowed.join(', ')}. Allowed: ${agent.policy.allowedStrategies.join(', ')}.`
            });
        }

        let runtimeWallet: string;
        try {
            runtimeWallet = getWalletAddressForUser(agent.userId);
        } catch (walletError: any) {
            return res.status(400).json({
                error: walletError?.message?.includes('No wallet seed')
                    ? 'Bind a wallet seed for this agent first (Wallet section → enter seed and click Bind Seed).'
                    : (walletError?.message || 'Wallet not configured for this agent.')
            });
        }

        if (agent.walletAddress !== runtimeWallet) {
            return res.status(400).json({
                error: 'Agent wallet address does not match the bound seed. Bind the correct wallet seed for this agent.'
            });
        }

        llmCapitalManager.updateAgentStatus(agent.id, 'active');

        const result = await botManager.startBot(config, agent.userId);
        if (!result.success) {
            llmCapitalManager.updateAgentStatus(agent.id, 'paused');
            return res.status(400).json({ error: result.error || 'Failed to start agent' });
        }

        BotConfigs.updateConfig(configId, { enabled: true });
        return res.json({ success: true, instanceId: result.instanceId, userId: agent.userId });
    } catch (error: any) {
        const message = error?.message || 'Failed to start agent';
        return res.status(500).json({ error: message });
    }
});

/** Stop agent: stop all instances and set status to paused (one-click). */
app.post('/api/llm-agents/:id/stop', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        const instances = botManager.getInstancesByUserId(agent.userId).filter(i => i.status === 'running');
        const stopResults = await Promise.all(instances.map(i => botManager.stopBot(i.id)));
        const failed = stopResults.filter(r => !r.success);

        llmCapitalManager.updateAgentStatus(agent.id, 'paused');

        if (failed.length > 0) {
            return res.status(200).json({
                success: true,
                stopped: instances.length - failed.length,
                userId: agent.userId,
                warning: `${failed.length} instance(s) could not be stopped cleanly`
            });
        }
        return res.json({ success: true, stopped: instances.length, userId: agent.userId });
    } catch (error: any) {
        const message = error?.message || 'Failed to stop agent';
        return res.status(500).json({ error: message });
    }
});

app.get('/api/mcp/server-info', async (_req, res) => {
    const result = await mcpClient.serverInfo();
    if (!result.ok) {
        return res.status(502).json({ error: result.error });
    }
    return res.json(result.data);
});

app.get('/api/llm-agents/:id/mcp/account', async (req, res) => {
    try {
        const agent = llmCapitalManager.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const [accountInfo, accountTx] = await Promise.all([
            mcpClient.accountInfo(agent.walletAddress),
            mcpClient.accountTransactions(agent.walletAddress, 20)
        ]);

        if (!accountInfo.ok) {
            return res.status(502).json({ error: accountInfo.error || 'MCP account_info failed' });
        }

        return res.json({
            walletAddress: agent.walletAddress,
            accountInfo: accountInfo.data,
            recentTransactions: accountTx.ok ? accountTx.data : { error: accountTx.error }
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch agent MCP account context', message: error?.message });
    }
});

// Settings Management
app.get('/api/settings', async (_req, res) => {
    try {
        const settings = loadSettings();
        settings.primaryWallet = getWalletForUser(userId).address;
        return res.json(settings);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const current = loadSettings();
        const body = req.body as Partial<AppSettings>;
        const updated: AppSettings = {
            ...current,
            ...(typeof body.autoProfitCollection === 'boolean' && { autoProfitCollection: body.autoProfitCollection }),
            ...(typeof body.profitCollectionThreshold === 'number' && { profitCollectionThreshold: body.profitCollectionThreshold }),
            ...(body.notifications && typeof body.notifications === 'object' && {
                notifications: { ...current.notifications, ...body.notifications }
            }),
            ...(body.trading && typeof body.trading === 'object' && {
                trading: { ...current.trading, ...body.trading }
            })
        };
        saveSettings(updated);
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
