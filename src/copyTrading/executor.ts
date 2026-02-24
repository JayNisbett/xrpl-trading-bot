import { Client, Wallet } from 'xrpl';
import { executeBuy, executeSell } from '../xrpl/amm';
import { IUser } from '../database/models';
import { TradeInfo } from '../types';
import config from '../config';

interface CopyTradeResult {
    success: boolean;
    txHash?: string;
    tokensReceived?: number | string;
    actualRate?: string;
    xrpSpent?: number;
    xrpReceived?: string;
    tokensSold?: string;
    error?: string;
}

/** Optional per-bot copy config (from getEffectiveCopyConfig). */
export interface CopyConfigOverride {
    tradingAmountMode: 'fixed' | 'percentage';
    fixedAmount: number;
    matchTraderPercentage: number;
    maxSpendPerTrade: number;
}

export function calculateCopyTradeAmount(
    _user: IUser,
    tradeInfo: TradeInfo,
    copyConfig?: CopyConfigOverride
): number {
    try {
        const mode = copyConfig?.tradingAmountMode ?? config.copyTrading.tradingAmountMode;
        const fixedAmount = copyConfig?.fixedAmount ?? config.copyTrading.fixedAmount;
        const matchPct = copyConfig?.matchTraderPercentage ?? config.copyTrading.matchTraderPercentage;
        const maxSpend = copyConfig?.maxSpendPerTrade ?? config.copyTrading.maxSpendPerTrade;

        if (mode === 'fixed') {
            return fixedAmount;
        }

        if (mode === 'percentage') {
            const traderAmount = tradeInfo.xrpAmount || 0;
            const calculatedAmount = (traderAmount * matchPct) / 100;
            if (calculatedAmount > maxSpend) return maxSpend;
            return calculatedAmount;
        }

        return fixedAmount || (tradeInfo.xrpAmount || 0) * 0.1;
    } catch (error) {
        console.error('Error calculating copy trade amount:', error);
        return 0;
    }
}

/**
 * Execute copy buy trade
 */
export async function executeCopyBuyTrade(
    client: Client,
    wallet: Wallet,
    _user: IUser,
    tradeInfo: TradeInfo,
    xrpAmount: number,
    defaultSlippage?: number
): Promise<CopyTradeResult> {
    try {
        const slippage = defaultSlippage ?? config.trading.defaultSlippage;
        const tokenInfo = {
            currency: tradeInfo.currency,
            issuer: tradeInfo.issuer,
            readableCurrency: tradeInfo.readableCurrency
        };

        const buyResult = await executeBuy(
            client,
            wallet,
            tokenInfo,
            xrpAmount,
            slippage
        );

        if (buyResult.success) {
            return {
                success: true,
                txHash: buyResult.txHash,
                tokensReceived: buyResult.tokensReceived,
                actualRate: buyResult.actualRate,
                xrpSpent: buyResult.xrpSpent || xrpAmount
            };
        } else {
            console.error(`Copy buy failed: ${buyResult.error}`);
            return {
                success: false,
                error: buyResult.error
            };
        }
    } catch (error) {
        console.error('Error executing copy buy trade:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Copy buy execution failed'
        };
    }
}

/**
 * Execute copy sell trade
 */
export async function executeCopySellTrade(
    client: Client,
    wallet: Wallet,
    _user: IUser,
    tradeInfo: TradeInfo,
    tokenAmount: number,
    defaultSlippage?: number
): Promise<CopyTradeResult> {
    try {
        const slippage = defaultSlippage ?? config.trading.defaultSlippage;
        const tokenInfo = {
            currency: tradeInfo.currency,
            issuer: tradeInfo.issuer,
            readableCurrency: tradeInfo.readableCurrency
        };

        const sellResult = await executeSell(
            client,
            wallet,
            tokenInfo,
            tokenAmount,
            slippage
        );

        if (sellResult.success) {
            return {
                success: true,
                txHash: sellResult.txHash,
                xrpReceived: sellResult.xrpReceived,
                tokensSold: sellResult.tokensSold,
                actualRate: sellResult.actualRate
            };
        } else {
            console.error(`Copy sell failed: ${sellResult.error}`);
            return {
                success: false,
                error: sellResult.error
            };
        }
    } catch (error) {
        console.error('Error executing copy sell trade:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Copy sell execution failed'
        };
    }
}

export { isTokenBlacklisted } from '../utils/tokenUtils';

/**
 * Check if transaction was already copied
 */
export function wasTransactionCopied(transactions: any[], originalTxHash: string): boolean {
    return transactions.some(t => t.originalTxHash === originalTxHash);
}

