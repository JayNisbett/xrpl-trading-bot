import { Client } from 'xrpl';
import { getTokenBalances } from '../xrpl/wallet';
import { getAMMInfo } from '../xrpl/amm';
import { User } from '../database/user';
import { getReadableCurrency } from '../xrpl/utils';

/** Known token display names: currency code or hex -> common name/symbol for UI */
const KNOWN_TOKEN_NAMES: Record<string, string> = {
    CORE: 'Coreum',
    SGB: 'Songbird',
    SOLO: 'Solo',
    USD: 'US Dollar',
    EUR: 'Euro',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    // Add more as needed; 40-char hex can be looked up by decoded symbol
};

export interface PositionSnapshot {
    symbol: string;
    /** Human-readable name for UI (e.g. "Coreum" instead of "CORE") */
    displayName: string;
    currency: string;
    issuer: string;
    tokensHeld: number;
    /** Total XRP spent on buys for this token (historical) */
    xrpInvested: number;
    /** Cost basis of current holding: proportional when partial sells occurred */
    costBasis: number;
    currentValue: number;
    profit: number;
    profitPercent: number;
    entryPrice: number;
    currentPrice: number;
    entryTime?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    liquidity?: number;
    /** How we know about this position: sniper purchase, copy trade, or wallet-only (no entry) */
    source?: 'sniper' | 'copy' | 'wallet';
}

/**
 * POSITION TRACKING SYSTEM
 * Real-time monitoring of all active positions
 */
// Rate limiting for position summary to avoid overwhelming RPC
let lastPositionCheckTime = 0;
const POSITION_CHECK_COOLDOWN = 10000; // Check positions max every 10 seconds
let cachedPositions: PositionSnapshot[] = [];

export async function getPositionSummary(
    client: Client,
    walletAddress: string,
    userId: string
): Promise<PositionSnapshot[]> {
    try {
        // Rate limit position checks
        const now = Date.now();
        if (now - lastPositionCheckTime < POSITION_CHECK_COOLDOWN) {
            return cachedPositions; // Return cached data if too soon
        }
        lastPositionCheckTime = now;
        
        const user = await User.findOne({ userId });
        if (!user) return [];

        const tokenBalances = await getTokenBalances(client, walletAddress);
        const positions: PositionSnapshot[] = [];

        for (const balance of tokenBalances) {
            const balanceValue = parseFloat(balance.balance);
            if (balanceValue <= 0) continue;

            const tokenInfo = {
                currency: balance.currency,
                issuer: balance.issuer,
                readableCurrency: balance.currency
            };

            let xrpInvested = 0;
            let tokensReceived = balanceValue;
            let entryTime: string | undefined;
            let symbol = balance.currency;
            let source: 'sniper' | 'copy' | 'wallet' = 'wallet';

            const issuerMatches = (issuer?: string, tokenAddress?: string) =>
                (issuer && issuer === balance.issuer) || (tokenAddress && tokenAddress === balance.issuer);
            const currencyMatches = (currency?: string, tokenSymbol?: string) => {
                const c = currency ?? tokenSymbol;
                if (!c) return false;
                return c === balance.currency || c === getReadableCurrency(balance.currency);
            };

            const purchase = user.sniperPurchases?.find(
                (p: any) =>
                    p.status === 'active' &&
                    issuerMatches(p.issuer, p.tokenAddress) &&
                    currencyMatches(p.currency, p.tokenSymbol)
            );
            if (purchase) {
                xrpInvested = purchase.amount;
                tokensReceived = purchase.tokensReceived ?? balanceValue;
                entryTime = String(purchase.timestamp);
                symbol = purchase.tokenSymbol || balance.currency;
                source = 'sniper';
            } else {
                const isBuyType = (t: any) =>
                    t.type === 'snipe_buy' || t.type === 'sniper_buy' || t.type === 'copy_buy';
                const buyTxs = (user.transactions || []).filter(
                    (tx: any) =>
                        isBuyType(tx) &&
                        tx.tokenAddress === balance.issuer &&
                        (tx.tokenSymbol === balance.currency ||
                            tx.tokenSymbol === getReadableCurrency(balance.currency) ||
                            (balance.currency && tx.tokenSymbol === balance.currency.replace(/\0/g, '').trim()))
                );
                if (buyTxs.length > 0) {
                    xrpInvested = buyTxs.reduce((sum: number, tx: any) => sum + (tx.xrpSpent || tx.amount || 0), 0);
                    const totalTokens = buyTxs.reduce((sum: number, tx: any) => sum + (tx.tokensReceived || 0), 0);
                    if (totalTokens > 0) tokensReceived = totalTokens;
                    const latest = buyTxs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    entryTime = String(latest.timestamp);
                    symbol = latest.tokenSymbol || balance.currency;
                    source = latest.type === 'copy_buy' ? 'copy' : 'sniper';
                }
            }

            // Cost basis: when user sold part of position, only the remaining tokens' share of xrpInvested counts
            const costBasis = tokensReceived > 0 && balanceValue <= tokensReceived
                ? xrpInvested * (balanceValue / tokensReceived)
                : xrpInvested;

            const entryPrice = tokensReceived > 0 ? xrpInvested / tokensReceived : 0;

            let currentPrice = 0;
            let currentValue = 0;
            let liquidity: number | undefined;
            const ammInfo = await getAMMInfo(client, tokenInfo);
            if (ammInfo && ammInfo.amount != null && ammInfo.amount2 != null) {
                const xrpInPool = typeof ammInfo.amount === 'string' ? parseFloat(ammInfo.amount) / 1000000 : Number(ammInfo.amount) / 1000000;
                const tokensInPoolVal = typeof ammInfo.amount2 === 'object' && (ammInfo.amount2 as any).value != null
                    ? parseFloat(String((ammInfo.amount2 as any).value))
                    : parseFloat(String(ammInfo.amount2));
                if (tokensInPoolVal > 0) {
                    currentPrice = xrpInPool / tokensInPoolVal;
                    currentValue = balanceValue * currentPrice;
                    liquidity = xrpInPool;
                }
            }

            const profit = costBasis > 0 ? currentValue - costBasis : 0;
            const profitPercent = costBasis > 0 ? (profit / costBasis) * 100 : 0;

            let riskLevel: 'low' | 'medium' | 'high' = 'medium';
            if (liquidity != null) {
                if (liquidity < 50) riskLevel = 'high';
                else if (liquidity > 200) riskLevel = 'low';
            }

            const readableSymbol = symbol === balance.currency ? getReadableCurrency(balance.currency) : symbol;
            const displayName = KNOWN_TOKEN_NAMES[readableSymbol] ?? KNOWN_TOKEN_NAMES[balance.currency] ?? readableSymbol;

            positions.push({
                symbol: readableSymbol,
                displayName,
                currency: balance.currency,
                issuer: balance.issuer,
                tokensHeld: balanceValue,
                xrpInvested,
                costBasis,
                currentValue,
                profit,
                profitPercent,
                entryPrice,
                currentPrice,
                entryTime,
                riskLevel,
                liquidity,
                source
            });
        }

        cachedPositions = positions;
        return positions;
    } catch (error: any) {
        // Only log non-rate-limit errors
        if (!error?.message?.includes('too much load') && error?.data?.error !== 'slowDown') {
            console.error('Error getting position summary:', error);
        }
        return cachedPositions; // Return cached data on error
    }
}

/**
 * Display formatted position summary
 */
export function logPositionSummary(positions: PositionSnapshot[]): void {
    if (positions.length === 0) {
        console.log('\n📊 No active positions');
        return;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ACTIVE POSITIONS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let totalInvested = 0;
    let totalValue = 0;

    for (const pos of positions) {
        const profitEmoji = pos.profit >= 0 ? '📈' : '📉';
        const profitSign = pos.profit >= 0 ? '+' : '';
        
        console.log(`\n${profitEmoji} ${pos.displayName || pos.symbol}`);
        console.log(`   Entry: ${pos.entryPrice.toFixed(8)} XRP`);
        console.log(`   Current: ${pos.currentPrice.toFixed(8)} XRP`);
        console.log(`   Tokens: ${pos.tokensHeld.toFixed(2)}`);
        console.log(`   Cost basis: ${pos.costBasis.toFixed(2)} XRP`);
        console.log(`   Current Value: ${pos.currentValue.toFixed(2)} XRP`);
        console.log(`   P/L: ${profitSign}${pos.profit.toFixed(2)} XRP (${profitSign}${pos.profitPercent.toFixed(2)}%)`);

        totalInvested += pos.costBasis;
        totalValue += pos.currentValue;
    }

    const totalProfit = totalValue - totalInvested;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const portfolioEmoji = totalProfit >= 0 ? '🟢' : '🔴';

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${portfolioEmoji} PORTFOLIO TOTAL`);
    console.log(`   Total Invested: ${totalInvested.toFixed(2)} XRP`);
    console.log(`   Current Value: ${totalValue.toFixed(2)} XRP`);
    console.log(`   Total P/L: ${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} XRP (${totalProfit >= 0 ? '+' : ''}${totalProfitPercent.toFixed(2)}%)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Calculate overall bot performance metrics
 */
export async function getBotPerformanceMetrics(userId: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number;
    averageProfit: number;
}> {
    try {
        const user = await User.findOne({ userId });
        if (!user || !user.transactions) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalProfit: 0,
                averageProfit: 0
            };
        }

        const sellTxs = user.transactions.filter(
            tx => tx.type === 'auto_sell' && tx.status === 'success'
        );

        let totalProfit = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        for (const tx of sellTxs) {
            if (tx.profit) {
                totalProfit += tx.profit;
                if (tx.profit > 0) {
                    winningTrades++;
                } else {
                    losingTrades++;
                }
            }
        }

        const totalTrades = sellTxs.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalProfit,
            averageProfit
        };
    } catch (error) {
        console.error('Error calculating performance:', error);
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalProfit: 0,
            averageProfit: 0
        };
    }
}
