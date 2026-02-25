import { Client, Wallet, xrpToDrops } from 'xrpl';
import { TokenInfo, TradeResult, LPBurnStatus } from '../types';
import { getReadableCurrency, formatTokenAmountSimple } from './utils';
import { executeBuyBestExecution, executeSellBestExecution } from './bestExecution';
import config from '../config';

/**
 * Execute buy (XRP -> token), using path finding + AMM + book when useBestExecution is true.
 */
export async function executeBuy(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    xrpAmount: number,
    slippage: number = 4.0
): Promise<TradeResult> {
    if (config.trading.useBestExecution !== false) {
        return executeBuyBestExecution(
            client,
            wallet,
            tokenInfo,
            xrpAmount,
            slippage,
            executeAMMBuy
        );
    }
    return executeAMMBuy(client, wallet, tokenInfo, xrpAmount, slippage);
}

/**
 * Execute sell (token -> XRP), using path finding + AMM + book when useBestExecution is true.
 */
export async function executeSell(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    tokenAmount: number,
    slippage: number = 4.0
): Promise<TradeResult> {
    if (config.trading.useBestExecution !== false) {
        return executeSellBestExecution(
            client,
            wallet,
            tokenInfo,
            tokenAmount,
            slippage,
            executeAMMSell
        );
    }
    return executeAMMSell(client, wallet, tokenInfo, tokenAmount, slippage);
}

/**
 * Execute AMM buy transaction (direct AMM only; used as fallback or when useBestExecution is false)
 */
export async function executeAMMBuy(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    xrpAmount: number,
    slippage: number = 4.0
): Promise<TradeResult> {
    try {
        // Check if trust line exists
        let hasTrustLine = false;
        let currentTokenBalance = 0;

        try {
            const accountLines = await client.request({
                command: 'account_lines',
                account: wallet.address,
                ledger_index: 'validated'
            });

            const existingLine = (accountLines.result as any).lines.find((line: any) =>
                line.currency === tokenInfo.currency && line.account === tokenInfo.issuer
            );

            if (existingLine) {
                hasTrustLine = true;
                currentTokenBalance = parseFloat(existingLine.balance);
            }
        } catch (error) {
            // Account not activated or no trust lines, will create trust line
        }

        // Create trust line if needed
        if (!hasTrustLine) {
            const trustSetTx = {
                TransactionType: 'TrustSet' as const,
                Account: wallet.address,
                LimitAmount: {
                    currency: tokenInfo.currency,
                    issuer: tokenInfo.issuer,
                    value: '100000'
                }
            };

            const trustPrepared = await client.autofill(trustSetTx);
            const trustSigned = wallet.sign(trustPrepared);
            const trustResult = await client.submitAndWait(trustSigned.tx_blob);

            if ((trustResult.result.meta as any).TransactionResult !== 'tesSUCCESS') {
                return {
                    success: false,
                    error: `Failed to create trust line: ${(trustResult.result.meta as any).TransactionResult}`
                };
            }

            // OPTIMIZATION: Reduced delay from 2000ms to 500ms for faster execution
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Get AMM pool info
        const ammInfo = await client.request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: { currency: tokenInfo.currency, issuer: tokenInfo.issuer }
        });

        if (!ammInfo.result || !(ammInfo.result as any).amm) {
            return {
                success: false,
                error: 'AMM pool not found for this token pair'
            };
        }

        const amm = (ammInfo.result as any).amm;
        const xrpAmountDrops = parseFloat(amm.amount);
        const tokenAmount = parseFloat(amm.amount2.value);
        const currentRate = tokenAmount / (xrpAmountDrops / 1000000);
        const estimatedTokens = xrpAmount * currentRate;
        const slippageMultiplier = (100 - slippage) / 100;
        const minTokensExpected = estimatedTokens * slippageMultiplier;
        const formattedMinTokens = formatTokenAmountSimple(minTokensExpected);

        // Execute buy transaction
        const paymentTx = {
            TransactionType: 'Payment' as const,
            Account: wallet.address,
            Destination: wallet.address,
            Amount: {
                currency: tokenInfo.currency,
                issuer: tokenInfo.issuer,
                value: formattedMinTokens
            },
            SendMax: xrpToDrops(xrpAmount.toString())
        };

        const prepared = await client.autofill(paymentTx);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        if ((result.result.meta as any).TransactionResult === 'tesSUCCESS') {
            // OPTIMIZATION: Reduced delay from 2000ms to 500ms for faster balance check
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get final balance
            const finalBalance = await client.request({
                command: 'account_lines',
                account: wallet.address,
                ledger_index: 'validated'
            });

            const tokenLine = (finalBalance.result as any).lines.find((line: any) =>
                line.currency === tokenInfo.currency && line.account === tokenInfo.issuer
            );

            const tokensReceived = tokenLine ? (parseFloat(tokenLine.balance) - currentTokenBalance) : 0;
            const actualRate = tokensReceived > 0 ? (tokensReceived / xrpAmount) : 0;
            const actualSlippage = ((1 - (actualRate / currentRate)) * 100).toFixed(2);

            return {
                success: true,
                txHash: result.result.hash,
                tokensReceived: tokensReceived,
                xrpSpent: xrpAmount,
                actualRate: actualRate.toFixed(8),
                expectedTokens: estimatedTokens.toFixed(6),
                actualSlippage: actualSlippage,
                slippageUsed: slippage,
                method: 'AMM'
            };
        } else {
            return {
                success: false,
                error: (result.result.meta as any).TransactionResult
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Execute AMM sell transaction
 */
export async function executeAMMSell(
    client: Client,
    wallet: Wallet,
    tokenInfo: TokenInfo,
    tokenAmount: number,
    slippage: number = 4.0
): Promise<TradeResult> {
    try {
        // Check token balance
        let currentTokenBalance = 0;

        const accountLines = await client.request({
            command: 'account_lines',
            account: wallet.address,
            ledger_index: 'validated'
        });

        const existingLine = (accountLines.result as any).lines.find((line: any) =>
            line.currency === tokenInfo.currency && line.account === tokenInfo.issuer
        );

        if (!existingLine) {
            return {
                success: false,
                error: `No trust line found for ${getReadableCurrency(tokenInfo.currency)}. Cannot sell tokens you don't have.`
            };
        }

        currentTokenBalance = parseFloat(existingLine.balance);

        if (currentTokenBalance < tokenAmount) {
            return {
                success: false,
                error: `Insufficient token balance. You have ${currentTokenBalance} ${getReadableCurrency(tokenInfo.currency)} but trying to sell ${tokenAmount}`
            };
        }

        // Get AMM pool info
        const ammInfo = await client.request({
            command: 'amm_info',
            asset: { currency: 'XRP' },
            asset2: { currency: tokenInfo.currency, issuer: tokenInfo.issuer }
        });

        if (!ammInfo.result || !(ammInfo.result as any).amm) {
            return {
                success: false,
                error: `No AMM pool found for ${getReadableCurrency(tokenInfo.currency)}. Cannot sell via AMM.`
            };
        }

        const amm = (ammInfo.result as any).amm;
        const xrpAmountDrops = parseFloat(amm.amount);
        const tokenAmountInPool = parseFloat(amm.amount2.value);
        const currentRate = (xrpAmountDrops / 1000000) / tokenAmountInPool;
        const estimatedXrp = tokenAmount * currentRate;
        const slippageMultiplier = (100 - slippage) / 100;
        const minXrpExpected = estimatedXrp * slippageMultiplier;
        const formattedMinXrp = parseFloat((minXrpExpected).toFixed(6));
        const formattedTokenAmount = formatTokenAmountSimple(tokenAmount);

        // Execute sell transaction
        const paymentTx = {
            TransactionType: 'Payment' as const,
            Account: wallet.address,
            Destination: wallet.address,
            Amount: xrpToDrops(formattedMinXrp.toString()),
            SendMax: {
                currency: tokenInfo.currency,
                issuer: tokenInfo.issuer,
                value: formattedTokenAmount
            },
            DeliverMin: xrpToDrops(formattedMinXrp.toString()),
            Flags: 0x00020000
        };

        const paymentPrepared = await client.autofill(paymentTx);
        const paymentSigned = wallet.sign(paymentPrepared);
        const paymentResult = await client.submitAndWait(paymentSigned.tx_blob);

        if ((paymentResult.result.meta as any).TransactionResult === 'tesSUCCESS') {
            // OPTIMIZATION: Reduced delay from 2000ms to 500ms for faster balance check
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get final balance
            const finalTokenBalance = await client.request({
                command: 'account_lines',
                account: wallet.address,
                ledger_index: 'validated'
            });

            const tokenLine = (finalTokenBalance.result as any).lines.find((line: any) =>
                line.currency === tokenInfo.currency && line.account === tokenInfo.issuer
            );

            const remainingTokenBalance = tokenLine ? parseFloat(tokenLine.balance) : 0;
            const tokensSold = currentTokenBalance - remainingTokenBalance;
            const estimatedXrpReceived = tokensSold * currentRate;
            const actualRate = estimatedXrpReceived / tokensSold;
            const actualSlippage = ((1 - (actualRate / currentRate)) * 100).toFixed(2);

            return {
                success: true,
                txHash: paymentResult.result.hash,
                tokensSold: tokensSold.toString(),
                xrpReceived: estimatedXrpReceived.toFixed(6),
                expectedXrp: estimatedXrp.toFixed(6),
                actualRate: actualRate.toFixed(8),
                marketRate: currentRate.toFixed(8),
                actualSlippage: actualSlippage,
                slippageUsed: slippage,
                newTokenBalance: remainingTokenBalance.toString()
            };
        } else {
            return {
                success: false,
                error: `AMM transaction failed: ${(paymentResult.result.meta as any).TransactionResult}`
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to execute AMM sell transaction'
        };
    }
}

/** Asset for AMM (XRP or issued token) */
export type AMMAsset = { currency: string; issuer?: string };

/**
 * Get AMM pool information for XRP/token pair (convenience)
 */
export async function getAMMInfo(client: Client, tokenInfo: TokenInfo): Promise<any | null> {
    return getAMMInfoForPair(client, { currency: 'XRP' }, { currency: tokenInfo.currency, issuer: tokenInfo.issuer });
}

/**
 * Get AMM pool information for any asset pair (XRP/token or token/token)
 */
export async function getAMMInfoForPair(
    client: Client,
    asset1: AMMAsset,
    asset2: AMMAsset
): Promise<any | null> {
    try {
        const a1: { currency: string; issuer?: string } = asset1.currency === 'XRP' ? { currency: 'XRP' } : { currency: asset1.currency, issuer: asset1.issuer! };
        const a2: { currency: string; issuer?: string } = asset2.currency === 'XRP' ? { currency: 'XRP' } : { currency: asset2.currency, issuer: asset2.issuer! };
        const ammInfo = await client.request({
            command: 'amm_info',
            asset: a1 as any,
            asset2: a2 as any
        });

        if (!ammInfo.result || !(ammInfo.result as any).amm) {
            return null;
        }

        return (ammInfo.result as any).amm;
    } catch (error) {
        return null;
    }
}

/**
 * Check LP burn status
 */
export async function checkLPBurnStatus(client: Client, tokenInfo: TokenInfo): Promise<LPBurnStatus> {
    try {
        const ammInfo = await getAMMInfo(client, tokenInfo);
        if (!ammInfo) {
            return {
                lpBurned: false,
                lpBalance: 'Unknown',
                error: 'AMM pool not found'
            };
        }

        const ammAccount = ammInfo.amm_account;
        
        const accountLines = await client.request({
            command: 'account_lines',
            account: ammAccount,
            ledger_index: 'validated'
        });

        if (!(accountLines.result as any) || !(accountLines.result as any).lines) {
            return {
                lpBurned: true,
                lpBalance: '0',
                ammAccount: ammAccount
            };
        }

        const lpTokenLine = (accountLines.result as any).lines.find((line: any) => 
            line.account === ammAccount && 
            line.currency && 
            line.currency.length === 40
        );

        if (!lpTokenLine) {
            return {
                lpBurned: true,
                lpBalance: '0',
                ammAccount: ammAccount
            };
        }

        const lpBalance = parseFloat(lpTokenLine.balance);
        const lpBurned = lpBalance < 1;
        
        return {
            lpBurned: lpBurned,
            lpBalance: lpBalance.toString(),
            ammAccount: ammAccount,
            lpTokenCurrency: lpTokenLine.currency
        };
    } catch (error) {
        return {
            lpBurned: false,
            lpBalance: 'Error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

