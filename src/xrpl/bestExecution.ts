import { Client, Wallet, xrpToDrops } from 'xrpl';
import { TokenInfo, TradeResult } from '../types';
import { formatTokenAmountSimple } from './utils';
import { getAMMInfo } from './amm';
import {
    findPathXRPToToken,
    findPathTokenToXRP,
    getBestPathForPayment,
    RipplePathFindResult
} from './pathFinding';
import {
    getBookOffersBuyToken,
    getBookOffersSellToken,
    getBookBuyQuote,
    getBookSellQuote,
    BookOffer
} from './orderBook';

export type ExecutionVenue = 'path_find' | 'amm' | 'book';

export interface BuyQuote {
    venue: ExecutionVenue;
    estimatedTokens: number;
    xrpSpent: number;
    rate: number;
    paths?: RipplePathFindResult;
}

export interface SellQuote {
    venue: ExecutionVenue;
    estimatedXrp: number;
    tokensSold: number;
    rate: number;
    paths?: RipplePathFindResult;
}

/**
 * Get AMM buy quote (XRP -> token).
 */
async function getAMMBuyQuote(
    client: Client,
    tokenInfo: TokenInfo,
    xrpAmount: number
): Promise<{ estimatedTokens: number; rate: number } | null> {
    const amm = await getAMMInfo(client, tokenInfo);
    if (!amm || !amm.amount || !amm.amount2) return null;
    const xrpPool = typeof amm.amount === 'string' ? parseFloat(amm.amount) / 1e6 : Number(amm.amount) / 1e6;
    const tokenPool = typeof amm.amount2 === 'object' && (amm.amount2 as any).value != null
        ? parseFloat(String((amm.amount2 as any).value))
        : parseFloat(String(amm.amount2));
    if (tokenPool <= 0) return null;
    const rate = tokenPool / xrpPool;
    const estimatedTokens = xrpAmount * rate;
    return { estimatedTokens, rate };
}

/**
 * Get AMM sell quote (token -> XRP).
 */
async function getAMMSellQuote(
    client: Client,
    tokenInfo: TokenInfo,
    tokenAmount: number
): Promise<{ estimatedXrp: number; rate: number } | null> {
    const amm = await getAMMInfo(client, tokenInfo);
    if (!amm || !amm.amount || !amm.amount2) return null;
    const xrpPool = typeof amm.amount === 'string' ? parseFloat(amm.amount) / 1e6 : Number(amm.amount) / 1e6;
    const tokenPool = typeof amm.amount2 === 'object' && (amm.amount2 as any).value != null
        ? parseFloat(String((amm.amount2 as any).value))
        : parseFloat(String(amm.amount2));
    if (tokenPool <= 0) return null;
    const rate = xrpPool / tokenPool;
    const estimatedXrp = tokenAmount * rate;
    return { estimatedXrp, rate };
}

/**
 * Compare buy quotes and return the best (most tokens for same XRP).
 */
export async function getBestBuyQuote(
    client: Client,
    account: string,
    tokenInfo: TokenInfo,
    xrpAmount: number
): Promise<BuyQuote | null> {
    const [ammQuote, bookOffers] = await Promise.all([
        getAMMBuyQuote(client, tokenInfo, xrpAmount),
        getBookOffersBuyToken(client, tokenInfo.currency, tokenInfo.issuer, 30)
    ]);
    const estTokens = ammQuote?.estimatedTokens ?? xrpAmount * 0.001;
    const pathResult = await findPathXRPToToken(
        client,
        account,
        tokenInfo.currency,
        tokenInfo.issuer,
        formatTokenAmountSimple(estTokens),
        xrpAmount * 1.05
    );

    const candidates: BuyQuote[] = [];

    if (pathResult) {
        const best = getBestPathForPayment(pathResult);
        if (best && best.source_amount) {
            const srcVal = typeof best.source_amount === 'string'
                ? parseFloat(best.source_amount) / 1e6
                : parseFloat((best.source_amount as any).value || '0');
            const destVal = pathResult.destination_amount?.value
                ? parseFloat(pathResult.destination_amount.value)
                : 0;
            if (destVal > 0 && srcVal <= xrpAmount * 1.05) {
                candidates.push({
                    venue: 'path_find',
                    estimatedTokens: destVal,
                    xrpSpent: srcVal,
                    rate: srcVal / destVal,
                    paths: pathResult
                });
            }
        }
    }

    if (ammQuote && ammQuote.estimatedTokens > 0) {
        candidates.push({
            venue: 'amm',
            estimatedTokens: ammQuote.estimatedTokens,
            xrpSpent: xrpAmount,
            rate: ammQuote.rate
        });
    }

    const bookQuote = getBookBuyQuote(bookOffers as BookOffer[], xrpAmount);
    if (bookQuote.tokensReceived > 0) {
        candidates.push({
            venue: 'book',
            estimatedTokens: bookQuote.tokensReceived,
            xrpSpent: bookQuote.xrpSpent,
            rate: bookQuote.effectiveRate
        });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    return candidates[0];
}

/**
 * Compare sell quotes and return the best (most XRP for same tokens).
 */
export async function getBestSellQuote(
    client: Client,
    account: string,
    tokenInfo: TokenInfo,
    tokenAmount: number
): Promise<SellQuote | null> {
    const minXrp = (tokenAmount * 1e-8).toFixed(6);
    const tokenVal = formatTokenAmountSimple(tokenAmount);

    const [pathResult, ammQuote, bookOffers] = await Promise.all([
        findPathTokenToXRP(client, account, tokenInfo.currency, tokenInfo.issuer, minXrp, tokenVal),
        getAMMSellQuote(client, tokenInfo, tokenAmount),
        getBookOffersSellToken(client, tokenInfo.currency, tokenInfo.issuer, 30)
    ]);

    const candidates: SellQuote[] = [];

    if (pathResult) {
        const best = getBestPathForPayment(pathResult);
        if (best && pathResult.destination_amount) {
            const destXrp = typeof pathResult.destination_amount === 'string'
                ? parseFloat(pathResult.destination_amount) / 1e6
                : parseFloat((pathResult.destination_amount as any).value || '0');
            if (destXrp > 0) {
                candidates.push({
                    venue: 'path_find',
                    estimatedXrp: destXrp,
                    tokensSold: tokenAmount,
                    rate: destXrp / tokenAmount,
                    paths: pathResult
                });
            }
        }
    }

    if (ammQuote && ammQuote.estimatedXrp > 0) {
        candidates.push({
            venue: 'amm',
            estimatedXrp: ammQuote.estimatedXrp,
            tokensSold: tokenAmount,
            rate: ammQuote.rate
        });
    }

    const bookQuote = getBookSellQuote(bookOffers as BookOffer[], tokenAmount);
    if (bookQuote.xrpReceived > 0) {
        candidates.push({
            venue: 'book',
            estimatedXrp: bookQuote.xrpReceived,
            tokensSold: bookQuote.tokensSold,
            rate: bookQuote.effectiveRate
        });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.estimatedXrp - a.estimatedXrp);
    return candidates[0];
}

/**
 * Execute buy using best venue. If path_find won, build Payment with Paths; else delegate to AMM.
 */
export async function executeBuyBestExecution(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    xrpAmount: number,
    slippagePercent: number,
    executeAMMBuy: (client: Client, wallet: Wallet, tokenInfo: TokenInfo, xrpAmount: number, slippage: number) => Promise<TradeResult>
): Promise<TradeResult> {
    const quote = await getBestBuyQuote(client, wallet.address, tokenInfo, xrpAmount);
    if (!quote) {
        return executeAMMBuy(client, wallet, tokenInfo, xrpAmount, slippagePercent);
    }

    if (quote.venue === 'path_find' && quote.paths) {
        const bestPath = getBestPathForPayment(quote.paths);
        const pathSteps = bestPath?.paths_computed?.map(path =>
            path.map((step: any) => {
                const s: any = {};
                if (step.account) s.account = step.account;
                if (step.currency) s.currency = step.currency;
                if (step.issuer) s.issuer = step.issuer;
                return Object.keys(s).length ? s : step;
            })
        );
        if (pathSteps?.length) {
            const minTokens = quote.estimatedTokens * (1 - slippagePercent / 100);
            try {
                const paymentTx: any = {
                    TransactionType: 'Payment',
                    Account: wallet.address,
                    Destination: wallet.address,
                    Amount: {
                        currency: tokenInfo.currency,
                        issuer: tokenInfo.issuer,
                        value: formatTokenAmountSimple(minTokens)
                    },
                    SendMax: xrpToDrops(xrpAmount.toString()),
                    Paths: pathSteps
                };
                const prepared = await client.autofill(paymentTx);
                const signed = wallet.sign(prepared);
                const result = await client.submitAndWait(signed.tx_blob);
                if ((result.result.meta as any).TransactionResult === 'tesSUCCESS') {
                    await new Promise(r => setTimeout(r, 500));
                    const lines = await client.request({ command: 'account_lines', account: wallet.address, ledger_index: 'validated' });
                    const line = (lines.result as any).lines?.find((l: any) =>
                        l.currency === tokenInfo.currency && l.account === tokenInfo.issuer
                    );
                    const received = line ? parseFloat(line.balance) : 0;
                    return {
                        success: true,
                        txHash: (result.result as any).hash,
                        tokensReceived: received,
                        xrpSpent: xrpAmount,
                        actualRate: received > 0 ? (xrpAmount / received).toFixed(8) : '0',
                        method: 'path_find'
                    };
                }
            } catch (err: any) {
                console.warn('Path find payment failed, falling back to AMM:', err?.message);
            }
        }
    }

    return executeAMMBuy(client, wallet, tokenInfo, xrpAmount, slippagePercent);
}

/**
 * Execute sell using best venue. If path_find won, build Payment with Paths; else delegate to AMM.
 */
export async function executeSellBestExecution(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    tokenAmount: number,
    slippagePercent: number,
    executeAMMSell: (client: Client, wallet: Wallet, tokenInfo: TokenInfo, tokenAmount: number, slippage: number) => Promise<TradeResult>
): Promise<TradeResult> {
    const quote = await getBestSellQuote(client, wallet.address, tokenInfo, tokenAmount);
    if (!quote) {
        return executeAMMSell(client, wallet, tokenInfo, tokenAmount, slippagePercent);
    }

    if (quote.venue === 'path_find' && quote.paths) {
        const bestPath = getBestPathForPayment(quote.paths);
        const pathSteps = bestPath?.paths_computed?.map(path =>
            path.map((step: any) => {
                const s: any = {};
                if (step.account) s.account = step.account;
                if (step.currency) s.currency = step.currency;
                if (step.issuer) s.issuer = step.issuer;
                return Object.keys(s).length ? s : step;
            })
        );
        if (pathSteps?.length) {
            const minXrp = quote.estimatedXrp * (1 - slippagePercent / 100);
            try {
                const paymentTx: any = {
                    TransactionType: 'Payment',
                    Account: wallet.address,
                    Destination: wallet.address,
                    Amount: xrpToDrops(minXrp.toFixed(6)),
                    SendMax: {
                        currency: tokenInfo.currency,
                        issuer: tokenInfo.issuer,
                        value: formatTokenAmountSimple(tokenAmount)
                    },
                    DeliverMin: xrpToDrops(minXrp.toFixed(6)),
                    Flags: 0x00020000,
                    Paths: pathSteps
                };
                const prepared = await client.autofill(paymentTx);
                const signed = wallet.sign(prepared);
                const result = await client.submitAndWait(signed.tx_blob);
                if ((result.result.meta as any).TransactionResult === 'tesSUCCESS') {
                    return {
                        success: true,
                        txHash: (result.result as any).hash,
                        xrpReceived: quote.estimatedXrp.toFixed(6),
                        tokensSold: tokenAmount.toString(),
                        method: 'path_find'
                    };
                }
            } catch (err: any) {
                console.warn('Path find sell failed, falling back to AMM:', err?.message);
            }
        }
    }

    return executeAMMSell(client, wallet, tokenInfo, tokenAmount, slippagePercent);
}
