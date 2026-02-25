import { Client } from 'xrpl';
import { getTokenBalances } from '../xrpl/wallet';
import { getWalletForUser } from '../xrpl/walletProvider';
import { executeSell, getAMMInfo } from '../xrpl/amm';
import { User, UserModel } from '../database/user';
import config from '../config';
import TradeLogger from './tradeLogger';
import { broadcastUpdate } from '../api/server';
import { recordRealizedLoss } from '../llmCapital/guards';

/**
 * PROFIT MANAGEMENT SYSTEM
 * Automatically sells positions when profit targets are hit for 90% win rate
 */
// Track last profit check time to avoid overwhelming RPC
let lastProfitCheckTime = 0;
const PROFIT_CHECK_COOLDOWN = 5000; // Check profits max every 5 seconds

export async function checkAndTakeProfits(userId: string): Promise<void> {
    try {
        // Rate limit profit checks
        const now = Date.now();
        if (now - lastProfitCheckTime < PROFIT_CHECK_COOLDOWN) {
            return; // Skip this check, too soon
        }
        lastProfitCheckTime = now;
        
        const user = await User.findOne({ userId });
        if (!user) return;

        const client = (await import('../xrpl/client')).getClient();
        const wallet = getWalletForUser(userId);
        
        // Get current token holdings with timeout handling
        let tokenBalances;
        try {
            tokenBalances = await getTokenBalances(await client, wallet.address);
        } catch (error) {
            // Skip this check if we can't get balances (likely timeout)
            return;
        }
        
        // Check each sniper purchase for profit opportunities
        if (!user.sniperPurchases || user.sniperPurchases.length === 0) {
            return;
        }

        for (const purchase of user.sniperPurchases) {
            // Skip if not active (includes 'selling', 'sold', 'sale_failed' states)
            if (purchase.status !== 'active') continue;
            
            // Find matching token balance
            const balance = tokenBalances.find(
                t => t.currency === purchase.currency && t.issuer === purchase.issuer
            );
            
            if (!balance || parseFloat(balance.balance) <= 0) {
                // No tokens left, mark as sold
                purchase.status = 'sold';
                continue;
            }

            // Get current price from AMM with timeout handling
            const tokenInfo = {
                currency: purchase.currency || '',
                issuer: purchase.issuer || '',
                readableCurrency: purchase.tokenSymbol
            };
            
            let ammInfo;
            try {
                ammInfo = await getAMMInfo(await client, tokenInfo);
                if (!ammInfo) continue;
            } catch (error) {
                // Skip this token if we can't get AMM info
                continue;
            }

            const xrpInPool = parseFloat(ammInfo.amount) / 1000000;
            const tokensInPool = parseFloat(ammInfo.amount2.value);
            const currentPrice = xrpInPool / tokensInPool; // XRP per token
            
            // Calculate entry price
            const entryPrice = purchase.amount / (purchase.tokensReceived || 1);
            
            // Calculate current profit/loss percentage
            const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
            
            // QUICK FLIP STRATEGY: Take profits at 10-20% gains
            const profitTarget = 12; // 12% profit target
            const stopLoss = -8; // 8% stop loss
            
            console.log(`📊 ${purchase.tokenSymbol}: Entry: ${entryPrice.toFixed(8)}, Current: ${currentPrice.toFixed(8)}, Change: ${priceChange.toFixed(2)}%`);
            
            const balanceValue = parseFloat(balance.balance);
            
            // Check if we actually hold enough tokens to sell
            if (balanceValue < 0.000001) {
                // No tokens left, mark as sold
                purchase.status = 'sold';
                continue;
            }
            
            // TAKE PROFIT
            if (priceChange >= profitTarget) {
                // Mark as selling BEFORE attempting to prevent duplicate sells
                purchase.status = 'selling';
                console.log(`🎯 PROFIT TARGET HIT for ${purchase.tokenSymbol}! Selling at +${priceChange.toFixed(2)}%`);
                await executeProfitTake(await client, wallet, user, purchase, balanceValue, 'profit_target');
            }
            // STOP LOSS
            else if (priceChange <= stopLoss) {
                purchase.status = 'selling';
                console.log(`🛑 STOP LOSS TRIGGERED for ${purchase.tokenSymbol} at ${priceChange.toFixed(2)}%`);
                await executeProfitTake(await client, wallet, user, purchase, balanceValue, 'stop_loss');
            }
            // TRAILING TAKE PROFIT: If up 20%+, take 50% profit
            else if (priceChange >= 20) {
                console.log(`💰 Partial profit take for ${purchase.tokenSymbol} at +${priceChange.toFixed(2)}%`);
                await executeProfitTake(await client, wallet, user, purchase, balanceValue * 0.5, 'partial_profit');
                // Don't mark as selling for partial takes, keep monitoring
            }
        }

        // Save updated user data
        const userModel = new UserModel(user);
        await userModel.save();
        
    } catch (error) {
        // Only log non-timeout errors to reduce console spam
        if (error instanceof Error && !error.message.includes('Timeout')) {
            console.error('Error checking profits:', error.message);
        }
    }
}

async function executeProfitTake(
    client: Client,
    wallet: any,
    user: any,
    purchase: any,
    tokenAmount: number,
    reason: string
): Promise<void> {
    try {
        const tokenInfo = {
            currency: purchase.currency,
            issuer: purchase.issuer,
            readableCurrency: purchase.tokenSymbol
        };

        // Execute sell
        const sellResult = await executeSell(
            client,
            wallet,
            tokenInfo,
            tokenAmount,
            config.trading.defaultSlippage
        );

        if (sellResult.success) {
            const xrpReceived = parseFloat(sellResult.xrpReceived || '0');
            const profit = xrpReceived - purchase.amount;
            const profitPercent = (profit / purchase.amount) * 100;
            
            console.log(`✅ Sold ${purchase.tokenSymbol}: ${xrpReceived.toFixed(2)} XRP (${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
            
            // Log to trade frequency tracker
            const logger = TradeLogger.getInstance();
            if (profit > 0) {
                logger.recordProfitTake(purchase.tokenSymbol, profit, profitPercent);
                // Broadcast profit take to dashboard
                broadcastUpdate('profitTake', {
                    symbol: purchase.tokenSymbol,
                    xrpReceived,
                    profit,
                    profitPercent,
                    reason
                });
            } else {
                logger.recordStopLoss(purchase.tokenSymbol, profit, profitPercent);
                recordRealizedLoss(user.userId, Math.abs(profit));
                // Broadcast stop loss to dashboard
                broadcastUpdate('stopLoss', {
                    symbol: purchase.tokenSymbol,
                    xrpReceived,
                    profit,
                    profitPercent,
                    reason
                });
            }
            
            // Update purchase status
            if (reason === 'profit_target' || reason === 'stop_loss') {
                purchase.status = 'sold';
            }
            
            // Record transaction
            user.transactions.push({
                type: 'auto_sell',
                ourTxHash: sellResult.txHash,
                amount: xrpReceived,
                tokenSymbol: purchase.tokenSymbol,
                tokenAddress: purchase.issuer,
                timestamp: new Date(),
                status: 'success',
                profit: profit,
                profitPercent: profitPercent,
                sellReason: reason
            });
        } else {
            // Sale failed - mark as failed to prevent retry loops
            console.error(`❌ Failed to sell ${purchase.tokenSymbol}: ${sellResult.error}`);
            purchase.status = 'sale_failed';
            
            user.transactions.push({
                type: 'auto_sell',
                ourTxHash: '',
                amount: 0,
                tokenSymbol: purchase.tokenSymbol,
                tokenAddress: purchase.issuer,
                timestamp: new Date(),
                status: 'failed',
                profit: 0,
                profitPercent: 0,
                sellReason: reason + '_failed'
            });
        }
    } catch (error) {
        console.error(`❌ Error executing profit take for ${purchase.tokenSymbol}:`, error);
        // Mark as failed to prevent infinite retry
        purchase.status = 'sale_failed';
    }
}

/**
 * Check if token is showing price momentum (upward trend)
 */
export async function checkPriceMomentum(
    client: Client,
    tokenInfo: { currency: string; issuer: string }
): Promise<{ hasPositiveMomentum: boolean; priceChangePercent: number }> {
    try {
        // Get AMM info at different times to detect price movement
        const ammInfo = await getAMMInfo(client, tokenInfo);
        if (!ammInfo) {
            return { hasPositiveMomentum: false, priceChangePercent: 0 };
        }

        const xrpInPool = parseFloat(ammInfo.amount) / 1000000;
        const tokensInPool = parseFloat(ammInfo.amount2.value);
        const currentPrice = xrpInPool / tokensInPool;

        // Wait 3 seconds and check again
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const ammInfo2 = await getAMMInfo(client, tokenInfo);
        if (!ammInfo2) {
            return { hasPositiveMomentum: false, priceChangePercent: 0 };
        }

        const xrpInPool2 = parseFloat(ammInfo2.amount) / 1000000;
        const tokensInPool2 = parseFloat(ammInfo2.amount2.value);
        const newPrice = xrpInPool2 / tokensInPool2;
        
        const priceChangePercent = ((newPrice - currentPrice) / currentPrice) * 100;
        
        // Positive momentum if price increased by 2%+ in 3 seconds
        const hasPositiveMomentum = priceChangePercent >= 2;
        
        return { hasPositiveMomentum, priceChangePercent };
    } catch (error) {
        return { hasPositiveMomentum: false, priceChangePercent: 0 };
    }
}
