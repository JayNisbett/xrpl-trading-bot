import { getClient } from '../xrpl/client';
import { getWallet, getBalance, getTokenBalances } from '../xrpl/wallet';
import { executeBuy } from '../xrpl/amm';
import { IUser } from '../database/models';
import { User, UserModel } from '../database/user';
import { detectNewTokensFromAMM } from './monitor';
import { evaluateToken, isTokenBlacklisted } from './evaluator';
import { TokenInfo } from '../types';
import config from '../config';
import { checkSufficientBalance, checkPositionLimit, getAccountStatus, logAccountStatus } from '../utils/safetyChecks';
import { checkAndTakeProfits } from '../utils/profitManager';
import { getPositionSummary, logPositionSummary, getBotPerformanceMetrics } from '../utils/positionTracker';
import TradeLogger from '../utils/tradeLogger';
import { broadcastUpdate } from '../api/server';
import type { BotConfiguration } from '../database/botConfigs';

/** Per-user sniper intervals so multiple users can run sniper independently. */
const sniperIntervals = new Map<string, NodeJS.Timeout>();

/** Per-bot config overlay (when started by botManager). Keyed by userId. */
const sniperOverlay = new Map<string, Pick<BotConfiguration, 'sniper' | 'trading'>>();

export interface EffectiveSniperConfig {
    checkInterval: number;
    maxTokensPerScan: number;
    buyMode: boolean;
    snipeAmount: string;
    customSnipeAmount: string;
    minimumPoolLiquidity: number;
    riskScore: 'low' | 'medium' | 'high';
    maxSnipeAmount: number;
    defaultSlippage: number;
}

export function setSniperOverlay(userId: string, overlay: Pick<BotConfiguration, 'sniper' | 'trading'>): void {
    sniperOverlay.set(userId, overlay);
}

export function clearSniperOverlay(userId: string): void {
    sniperOverlay.delete(userId);
}

export function getEffectiveSniperConfig(userId: string): EffectiveSniperConfig {
    const overlay = sniperOverlay.get(userId);
    if (overlay) {
        const s = overlay.sniper;
        const t = overlay.trading;
        return {
            checkInterval: s.checkInterval,
            maxTokensPerScan: s.maxTokensPerScan,
            buyMode: s.buyMode,
            snipeAmount: s.snipeAmount,
            customSnipeAmount: s.customSnipeAmount ?? '',
            minimumPoolLiquidity: s.minimumPoolLiquidity,
            riskScore: s.riskScore,
            maxSnipeAmount: t.maxSnipeAmount,
            defaultSlippage: t.defaultSlippage
        };
    }
    return {
        checkInterval: config.sniper.checkInterval,
        maxTokensPerScan: config.sniper.maxTokensPerScan,
        buyMode: config.sniperUser.buyMode,
        snipeAmount: config.sniperUser.snipeAmount ?? '1',
        customSnipeAmount: config.sniperUser.customSnipeAmount ?? '',
        minimumPoolLiquidity: config.sniperUser.minimumPoolLiquidity,
        riskScore: (config.sniperUser.riskScore as 'low' | 'medium' | 'high') ?? 'medium',
        maxSnipeAmount: config.trading.maxSnipeAmount,
        defaultSlippage: config.trading.defaultSlippage
    };
}

interface Result {
    success: boolean;
    error?: string;
}

export interface StartSniperOptions {
    overlay?: Pick<BotConfiguration, 'sniper' | 'trading'>;
}

function clearSniperIntervalForUser(userId: string): void {
    const id = sniperIntervals.get(userId);
    if (id) {
        clearInterval(id);
        sniperIntervals.delete(userId);
    }
}

export async function startSniper(userId: string, options?: StartSniperOptions): Promise<Result> {
    if (sniperIntervals.has(userId)) {
        return { success: false, error: 'Sniper is already running for this user' };
    }

    try {
        if (options?.overlay) {
            setSniperOverlay(userId, options.overlay);
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const effective = getEffectiveSniperConfig(userId);

        if (user.sniperActive && !sniperIntervals.has(userId)) {
            user.sniperActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        if (!effective.buyMode && (!user.whiteListedTokens || user.whiteListedTokens.length === 0)) {
            return { success: false, error: 'No whitelisted tokens for whitelist-only mode' };
        }

        const snipeAmount = parseFloat(
            effective.snipeAmount === 'custom' ? (effective.customSnipeAmount || '1') : (effective.snipeAmount || '1')
        ) || 1;

        if (snipeAmount > effective.maxSnipeAmount) {
            return {
                success: false,
                error: `Snipe amount too high. Maximum: ${effective.maxSnipeAmount} XRP`
            };
        }

        if (!user.sniperPurchases) {
            user.sniperPurchases = [];
        }

        const client = await getClient();
        const wallet = getWallet();
        const xrpBalance = await getBalance(client, wallet.address);
        const tokenBalances = await getTokenBalances(client, wallet.address);

        console.log('Sniper Account Info:');
        console.log(`  Wallet: ${wallet.address}`);
        console.log(`  XRP Balance: ${xrpBalance.toFixed(6)} XRP`);
        console.log(`  Token Holdings: ${tokenBalances.length}`);
        console.log(`  Snipe Amount: ${snipeAmount} XRP`);
        console.log(`  Buy Mode: ${effective.buyMode ? 'Auto-buy' : 'Whitelist-only'}`);
        console.log(`  Min Liquidity: ${effective.minimumPoolLiquidity} XRP`);
        console.log(`  Risk Score: ${effective.riskScore}`);

        // Display detailed account status with safety checks
        const accountStatus = await getAccountStatus(client, wallet.address);
        logAccountStatus(accountStatus);

        // Display current positions
        const positions = await getPositionSummary(client, wallet.address, userId);
        logPositionSummary(positions);

        // Display bot performance metrics
        const metrics = await getBotPerformanceMetrics(userId);
        if (metrics.totalTrades > 0) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎯 BOT PERFORMANCE METRICS');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`   Total Completed Trades: ${metrics.totalTrades}`);
            console.log(`   Winning Trades: ${metrics.winningTrades}`);
            console.log(`   Losing Trades: ${metrics.losingTrades}`);
            console.log(`   Win Rate: ${metrics.winRate.toFixed(1)}%`);
            console.log(`   Total Profit: ${metrics.totalProfit >= 0 ? '+' : ''}${metrics.totalProfit.toFixed(2)} XRP`);
            console.log(`   Average Profit per Trade: ${metrics.averageProfit >= 0 ? '+' : ''}${metrics.averageProfit.toFixed(2)} XRP`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

        // Check if we have enough balance to even start sniping
        const initialCheck = await checkSufficientBalance(client, wallet.address, snipeAmount);
        if (!initialCheck.canTrade) {
            return { 
                success: false, 
                error: `Insufficient balance to start sniper. ${initialCheck.reason}` 
            };
        }

        user.sniperActive = true;
        user.sniperStartTime = new Date();
        const userModel = new UserModel(user);
        await userModel.save();

        const logger = TradeLogger.getInstance();
        const id = setInterval(async () => {
            await monitorTokenMarkets(userId);
            if (Math.random() < 0.02) {
                logger.displayStats();
            }
        }, effective.checkInterval);
        sniperIntervals.set(userId, id);

        return { success: true };
    } catch (error) {
        console.error('Error starting sniper:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function stopSniper(userId: string): Promise<Result> {
    try {
        clearSniperIntervalForUser(userId);

        const user = await User.findOne({ userId });
        if (user) {
            user.sniperActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        clearSniperOverlay(userId);
        return { success: true };
    } catch (error) {
        console.error('Error stopping sniper:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function monitorTokenMarkets(userId: string): Promise<void> {
    try {
        const user = await User.findOne({ userId });
        if (!user || !user.sniperActive) {
            clearSniperIntervalForUser(userId);
            return;
        }

        const client = await getClient();
        
        // PROFIT MANAGEMENT: Check for profit-taking opportunities first
        await checkAndTakeProfits(userId);
        
        // Then look for new tokens
        const newTokens = await detectNewTokensFromAMM(client);

        const effective = getEffectiveSniperConfig(userId);
        const evaluationPromises = newTokens
            .slice(0, effective.maxTokensPerScan)
            .map(tokenInfo => evaluateAndSnipeToken(client, user, tokenInfo, effective));
        
        await Promise.all(evaluationPromises);
    } catch (error) {
        console.error('Monitor error:', error instanceof Error ? error.message : 'Unknown error');
    }
}

async function evaluateAndSnipeToken(
    client: any,
    user: IUser,
    tokenInfo: TokenInfo,
    effective: EffectiveSniperConfig
): Promise<void> {
    try {
        const evaluation = await evaluateToken(client, user, tokenInfo, effective);

        if (!evaluation.shouldSnipe) {
            return;
        }

        await executeSnipe(client, user, tokenInfo, effective);
    } catch (error) {
        console.error(`Error evaluating token:`, error instanceof Error ? error.message : 'Unknown error');
    }
}

async function executeSnipe(
    client: any,
    user: IUser,
    tokenInfo: TokenInfo,
    effective: EffectiveSniperConfig
): Promise<void> {
    try {
        const wallet = getWallet();
        let snipeAmount: number;
        if (effective.snipeAmount === 'custom') {
            if (!effective.customSnipeAmount || isNaN(parseFloat(effective.customSnipeAmount))) {
                console.error('Invalid custom snipe amount');
                return;
            }
            snipeAmount = parseFloat(effective.customSnipeAmount);
        } else {
            snipeAmount = parseFloat(effective.snipeAmount || '1') || 1;
        }

        if (isNaN(snipeAmount) || snipeAmount <= 0) {
            console.error('Invalid snipe amount');
            return;
        }

        if (snipeAmount > effective.maxSnipeAmount) {
            console.error(`Snipe amount exceeds maximum: ${snipeAmount} > ${effective.maxSnipeAmount}`);
            return;
        }

        // Enhanced safety check using new safety module
        const balanceCheck = await checkSufficientBalance(client, wallet.address, snipeAmount);
        if (!balanceCheck.canTrade) {
            console.error(`❌ Snipe blocked: ${balanceCheck.reason}`);
            return;
        }

        // Check position limit
        const positionCheck = checkPositionLimit(balanceCheck.activePositions, balanceCheck.availableXRP);
        if (!positionCheck.canAddPosition) {
            console.error(`❌ Snipe blocked: ${positionCheck.reason}`);
            return;
        }

        console.log(`✅ Safety checks passed. Tradable: ${balanceCheck.tradableXRP.toFixed(2)} XRP, Positions: ${balanceCheck.activePositions}`);

        if (isTokenBlacklisted(user.blackListedTokens, tokenInfo.currency, tokenInfo.issuer)) {
            return;
        }

        const buyResult = await executeBuy(
            client,
            wallet,
            tokenInfo,
            snipeAmount,
            effective.defaultSlippage
        );

        if (buyResult.success && buyResult.txHash) {
            // Log successful snipe
            const logger = TradeLogger.getInstance();
            logger.recordSuccessfulSnipe(
                tokenInfo.readableCurrency || tokenInfo.currency,
                snipeAmount
            );
            
            // Broadcast to dashboard
            broadcastUpdate('snipe', {
                symbol: tokenInfo.readableCurrency || tokenInfo.currency,
                amount: snipeAmount,
                timestamp: new Date()
            });
            
            if (!user.sniperPurchases) {
                user.sniperPurchases = [];
            }

            user.sniperPurchases.push({
                tokenSymbol: tokenInfo.readableCurrency || tokenInfo.currency,
                tokenAddress: tokenInfo.issuer,
                currency: tokenInfo.currency,
                issuer: tokenInfo.issuer,
                amount: snipeAmount,
                tokensReceived: typeof buyResult.tokensReceived === 'number' ? buyResult.tokensReceived : parseFloat(String(buyResult.tokensReceived || 0)),
                timestamp: new Date(),
                txHash: buyResult.txHash,
                status: 'active'
            });

            user.transactions.push({
                type: 'snipe_buy',
                ourTxHash: buyResult.txHash,
                amount: snipeAmount,
                tokenSymbol: tokenInfo.readableCurrency || tokenInfo.currency,
                tokenAddress: tokenInfo.issuer,
                timestamp: new Date(),
                status: 'success',
                tokensReceived: typeof buyResult.tokensReceived === 'number' ? buyResult.tokensReceived : parseFloat(String(buyResult.tokensReceived || 0)),
                xrpSpent: snipeAmount,
                actualRate: buyResult.actualRate || '0'
            });

            const userModel = new UserModel(user);
            await userModel.save();
        } else {
            console.error(`Snipe failed: ${buyResult.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error executing snipe:', error);
    }
}

export function isRunningSniper(): boolean {
    return sniperIntervals.size > 0;
}

