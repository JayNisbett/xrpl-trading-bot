import { Client } from 'xrpl';
import { getClient } from '../xrpl/client';
import { getBalance, getTokenBalances } from '../xrpl/wallet';
import { getWalletForUser } from '../xrpl/walletProvider';
import { IUser } from '../database/models';
import { User, UserModel } from '../database/user';
import { checkTraderTransactions } from './monitor';
import {
    calculateCopyTradeAmount,
    executeCopyBuyTrade,
    executeCopySellTrade,
    isTokenBlacklisted,
    wasTransactionCopied
} from './executor';
import { TradeInfo } from '../types';
import config from '../config';
import { checkSufficientBalance, checkPositionLimit, getAccountStatus, logAccountStatus } from '../utils/safetyChecks';
import type { BotConfiguration } from '../database/botConfigs';
import { canExecuteXrpTrade, recordExecutedTrade } from '../llmCapital/guards';
import { llmAllowsTrade } from '../llmCapital/llmDecision';

let copyTradingIntervals = new Map<string, NodeJS.Timeout>();
const monitorLocks = new Set<string>();
let isRunning: boolean = false;

const copyOverlay = new Map<string, Pick<BotConfiguration, 'copyTrading' | 'trading'>>();

export interface EffectiveCopyConfig {
    traderAddresses: string[];
    checkInterval: number;
    maxTransactionsToCheck: number;
    tradingAmountMode: 'fixed' | 'percentage';
    matchTraderPercentage: number;
    maxSpendPerTrade: number;
    fixedAmount: number;
    defaultSlippage: number;
}

export function setCopyOverlay(userId: string, overlay: Pick<BotConfiguration, 'copyTrading' | 'trading'>): void {
    copyOverlay.set(userId, overlay);
}

export function clearCopyOverlay(userId: string): void {
    copyOverlay.delete(userId);
}

export function getEffectiveCopyConfig(userId: string): EffectiveCopyConfig {
    const overlay = copyOverlay.get(userId);
    if (overlay) {
        const c = overlay.copyTrading;
        const t = overlay.trading;
        return {
            traderAddresses: c.traderAddresses,
            checkInterval: c.checkInterval,
            maxTransactionsToCheck: c.maxTransactionsToCheck,
            tradingAmountMode: c.tradingAmountMode,
            matchTraderPercentage: c.matchTraderPercentage,
            maxSpendPerTrade: c.maxSpendPerTrade,
            fixedAmount: c.fixedAmount,
            defaultSlippage: t.defaultSlippage
        };
    }
    return {
        traderAddresses: config.copyTrading.traderAddresses,
        checkInterval: config.copyTrading.checkInterval,
        maxTransactionsToCheck: config.copyTrading.maxTransactionsToCheck,
        tradingAmountMode: config.copyTrading.tradingAmountMode as 'fixed' | 'percentage',
        matchTraderPercentage: config.copyTrading.matchTraderPercentage,
        maxSpendPerTrade: config.copyTrading.maxSpendPerTrade,
        fixedAmount: config.copyTrading.fixedAmount,
        defaultSlippage: config.trading.defaultSlippage
    };
}

interface Result {
    success: boolean;
    error?: string;
}

export interface StartCopyTradingOptions {
    overlay?: Pick<BotConfiguration, 'copyTrading' | 'trading'>;
}

export async function startCopyTrading(userId: string, options?: StartCopyTradingOptions): Promise<Result> {
    try {
        if (copyTradingIntervals.has(userId)) {
            return { success: false, error: 'Copy trading is already running' };
        }

        if (options?.overlay) {
            setCopyOverlay(userId, options.overlay);
        }

        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const effective = getEffectiveCopyConfig(userId);

        if (user.copyTraderActive && !copyTradingIntervals.has(userId)) {
            user.copyTraderActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        if (!effective.traderAddresses || effective.traderAddresses.length === 0) {
            return { success: false, error: 'No traders added. Please set COPY_TRADER_ADDRESSES in .env or configure in bot config' };
        }

        const client = await getClient();
        const wallet = getWalletForUser(userId);
        const xrpBalance = await getBalance(client, wallet.address);
        const tokenBalances = await getTokenBalances(client, wallet.address);

        console.log('Copy Trading Account Info:');
        console.log(`  Wallet: ${wallet.address}`);
        console.log(`  XRP Balance: ${xrpBalance.toFixed(6)} XRP`);
        console.log(`  Token Holdings: ${tokenBalances.length}`);
        console.log(`  Monitoring ${effective.traderAddresses.length} trader(s)`);
        console.log(`  Amount Mode: ${effective.tradingAmountMode}`);
        if (effective.tradingAmountMode === 'percentage') {
            console.log(`  Match Percentage: ${effective.matchTraderPercentage}%`);
        } else {
            console.log(`  Fixed Amount: ${effective.fixedAmount} XRP`);
        }
        console.log(`  Max Spend Per Trade: ${effective.maxSpendPerTrade} XRP`);

        const accountStatus = await getAccountStatus(client, wallet.address);
        logAccountStatus(accountStatus);

        const minAmount = effective.tradingAmountMode === 'fixed' ? effective.fixedAmount : 1;
        const initialCheck = await checkSufficientBalance(client, wallet.address, minAmount);
        if (!initialCheck.canTrade) {
            return {
                success: false,
                error: `Insufficient balance to start copy trading. ${initialCheck.reason}`
            };
        }

        user.copyTraderActive = true;
        user.copyTradingStartTime = new Date();
        const userModel = new UserModel(user);
        await userModel.save();

        const runMonitor = async () => {
            if (!copyTradingIntervals.has(userId)) return;
            await monitorTraders(userId);
            const timeout = setTimeout(runMonitor, effective.checkInterval);
            copyTradingIntervals.set(userId, timeout);
        };

        const timeout = setTimeout(runMonitor, effective.checkInterval);
        copyTradingIntervals.set(userId, timeout);
        isRunning = true;

        return { success: true };
    } catch (error) {
        console.error('Error starting copy trading:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function stopCopyTrading(userId: string): Promise<Result> {
    try {
        const interval = copyTradingIntervals.get(userId);
        if (interval) {
            clearTimeout(interval);
            copyTradingIntervals.delete(userId);
        }
        monitorLocks.delete(userId);

        const user = await User.findOne({ userId });
        if (user) {
            user.copyTraderActive = false;
            const userModel = new UserModel(user);
            await userModel.save();
        }

        clearCopyOverlay(userId);

        if (copyTradingIntervals.size === 0) {
            isRunning = false;
        }

        return { success: true };
    } catch (error) {
        console.error('Error stopping copy trading:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function monitorTraders(userId: string): Promise<void> {
    if (monitorLocks.has(userId)) {
        return;
    }

    monitorLocks.add(userId);
    try {
        const user = await User.findOne({ userId });
        if (!user || !user.copyTraderActive) {
            const interval = copyTradingIntervals.get(userId);
            if (interval) {
                clearTimeout(interval);
                copyTradingIntervals.delete(userId);
            }
            return;
        }

        const effective = getEffectiveCopyConfig(userId);
        if (!effective.traderAddresses || effective.traderAddresses.length === 0) {
            return;
        }

        const client = await getClient();

        for (const traderAddress of effective.traderAddresses) {
            await checkAndCopyTrades(client, user, traderAddress, effective);
        }
    } catch (error) {
        console.error('Error monitoring traders:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
        monitorLocks.delete(userId);
    }
}

async function checkAndCopyTrades(
    client: Client,
    user: IUser,
    traderAddress: string,
    effective: EffectiveCopyConfig
): Promise<void> {
    try {
        const newTrades = await checkTraderTransactions(
            client,
            user.userId,
            traderAddress,
            user.copyTradingStartTime,
            effective.maxTransactionsToCheck
        );

        for (const tradeData of newTrades) {
            const { txHash, tradeInfo } = tradeData;

            if (wasTransactionCopied(user.transactions, txHash)) {
                continue;
            }

            if (isTokenBlacklisted(user.blackListedTokens, tradeInfo.currency, tradeInfo.issuer)) {
                continue;
            }

            const tradeAmount = calculateCopyTradeAmount(user, tradeInfo, effective);
            if (!tradeAmount || tradeAmount <= 0) {
                continue;
            }

            await executeCopyTrade(client, user, traderAddress, tradeInfo, tradeAmount, txHash, effective, user.userId);
        }
    } catch (error) {
        console.error(`Error checking trades for ${traderAddress}:`, error instanceof Error ? error.message : 'Unknown error');
    }
}

async function executeCopyTrade(
    client: Client,
    user: IUser,
    traderAddress: string,
    tradeInfo: TradeInfo,
    tradeAmount: number,
    originalTxHash: string,
    effective: EffectiveCopyConfig,
    userId: string
): Promise<void> {
    try {
        const wallet = getWalletForUser(userId);

        // Safety check for buy trades
        if (tradeInfo.type === 'buy') {
            const llmGuard = canExecuteXrpTrade(userId, 'copyTrading', tradeAmount);
            if (!llmGuard.allowed) {
                console.error(`❌ LLM policy blocked copy trade: ${llmGuard.reason}`);
                return;
            }

            const llmOk = await llmAllowsTrade(userId, 'copyTrading', tradeAmount, { description: 'copy trade' });
            if (!llmOk.allowed) {
                console.error(`❌ LLM service declined copy trade: ${llmOk.reason}`);
                return;
            }

            const balanceCheck = await checkSufficientBalance(client, wallet.address, tradeAmount);
            if (!balanceCheck.canTrade) {
                console.error(`❌ Copy trade blocked: ${balanceCheck.reason}`);
                return;
            }

            const positionCheck = checkPositionLimit(balanceCheck.activePositions, balanceCheck.availableXRP);
            if (!positionCheck.canAddPosition) {
                console.error(`❌ Copy trade blocked: ${positionCheck.reason}`);
                return;
            }

            console.log(`✅ Safety checks passed for copy trade. Tradable: ${balanceCheck.tradableXRP.toFixed(2)} XRP`);
        }

        let copyResult;

        if (tradeInfo.type === 'buy') {
            copyResult = await executeCopyBuyTrade(client, wallet, user, tradeInfo, tradeAmount, effective.defaultSlippage);
        } else if (tradeInfo.type === 'sell') {
            const tokenAmount = tradeAmount;
            copyResult = await executeCopySellTrade(client, wallet, user, tradeInfo, tokenAmount, effective.defaultSlippage);
        } else {
            return;
        }

        if (copyResult && copyResult.success && copyResult.txHash) {
            if (tradeInfo.type === 'buy') {
                recordExecutedTrade(userId, 'copyTrading', tradeAmount);
            }

            user.transactions.push({
                type: `copy_${tradeInfo.type}`,
                originalTxHash: originalTxHash,
                ourTxHash: copyResult.txHash,
                amount: tradeAmount,
                tokenSymbol: tradeInfo.readableCurrency,
                tokenAddress: tradeInfo.issuer,
                timestamp: new Date(),
                status: 'success',
                traderAddress: traderAddress,
                tokensReceived: typeof copyResult.tokensReceived === 'number' 
                    ? copyResult.tokensReceived 
                    : parseFloat(String(copyResult.tokensReceived || 0)),
                xrpSpent: copyResult.xrpSpent || tradeAmount,
                actualRate: copyResult.actualRate || '0'
            });

            const userModel = new UserModel(user);
            await userModel.save();
        } else {
            console.error(`Copy trade failed: ${copyResult?.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error executing copy trade:', error);
    }
}

export function isRunningCopyTrading(): boolean {
    return isRunning;
}

