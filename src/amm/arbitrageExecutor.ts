import { Client, Wallet } from 'xrpl';
import { ArbitrageOpportunity, PoolMetrics } from './poolAnalyzer';
import { executeBuy, executeSell } from '../xrpl/amm';

export interface ArbitrageExecution {
    opportunity: ArbitrageOpportunity;
    executed: boolean;
    actualProfit?: number;
    txHashes?: string[];
    executionTime?: number;
    error?: string;
}

/**
 * AMM ARBITRAGE EXECUTOR
 * Executes arbitrage trades across AMM pools
 */
export class AMMArbitrageExecutor {
    private minProfitThreshold = 0.5; // Minimum 0.5% profit after fees
    private maxSlippage = 0.02; // Maximum 2% slippage
    private executionHistory: ArbitrageExecution[] = [];

    /**
     * Execute an arbitrage opportunity
     */
    async executeArbitrage(
        client: Client,
        wallet: Wallet,
        opportunity: ArbitrageOpportunity
    ): Promise<ArbitrageExecution> {
        const startTime = Date.now();
        
        try {
            console.log(`\n🔄 ARBITRAGE OPPORTUNITY DETECTED`);
            console.log(`Token: ${opportunity.token.currency}`);
            console.log(`Price Difference: ${opportunity.priceDifference.toFixed(2)}%`);
            console.log(`Profit Potential: ${opportunity.profitPotential.toFixed(2)} XRP`);
            console.log(`Trade Amount: ${opportunity.tradeAmount.toFixed(2)} XRP`);

            // Validate opportunity is still profitable
            if (opportunity.priceDifference < this.minProfitThreshold) {
                return {
                    opportunity,
                    executed: false,
                    error: 'Profit below threshold'
                };
            }

            const txHashes: string[] = [];

            if (opportunity.route === 'pool1ThenPool2') {
                // Step 1: Buy from pool1 (cheaper)
                console.log(`📥 Step 1: Buy from Pool 1`);
                const buyResult = await this.executeTrade(
                    client,
                    wallet,
                    opportunity.pool1,
                    opportunity.token,
                    opportunity.tradeAmount,
                    'buy'
                );

                if (!buyResult.success) {
                    return {
                        opportunity,
                        executed: false,
                        error: `Buy failed: ${buyResult.error}`
                    };
                }

                txHashes.push(buyResult.txHash!);
                const tokensReceived = buyResult.tokensReceived || 0;

                // Small delay to ensure transaction is confirmed
                await this.delay(1000);

                // Step 2: Sell to pool2 (more expensive)
                console.log(`📤 Step 2: Sell to Pool 2`);
                const sellResult = await this.executeTrade(
                    client,
                    wallet,
                    opportunity.pool2,
                    opportunity.token,
                    tokensReceived,
                    'sell'
                );

                if (!sellResult.success) {
                    // We bought but couldn't sell - log this as a partial execution
                    console.warn(`⚠️ Bought tokens but sell failed: ${sellResult.error}`);
                    return {
                        opportunity,
                        executed: false,
                        error: `Sell failed: ${sellResult.error}`,
                        txHashes
                    };
                }

                txHashes.push(sellResult.txHash!);

                // Calculate actual profit
                const xrpReceived = sellResult.xrpReceived || 0;
                const actualProfit = xrpReceived - opportunity.tradeAmount;
                const actualProfitPercent = (actualProfit / opportunity.tradeAmount) * 100;

                console.log(`✅ ARBITRAGE COMPLETE!`);
                console.log(`Profit: ${actualProfit.toFixed(2)} XRP (${actualProfitPercent.toFixed(2)}%)`);

                const execution: ArbitrageExecution = {
                    opportunity,
                    executed: true,
                    actualProfit,
                    txHashes,
                    executionTime: Date.now() - startTime
                };

                this.executionHistory.push(execution);
                return execution;

            } else {
                // Reverse route: pool2 then pool1
                console.log(`📥 Step 1: Buy from Pool 2`);
                const buyResult = await this.executeTrade(
                    client,
                    wallet,
                    opportunity.pool2,
                    opportunity.token,
                    opportunity.tradeAmount,
                    'buy'
                );

                if (!buyResult.success) {
                    return {
                        opportunity,
                        executed: false,
                        error: `Buy failed: ${buyResult.error}`
                    };
                }

                txHashes.push(buyResult.txHash!);
                const tokensReceived = buyResult.tokensReceived || 0;

                await this.delay(1000);

                console.log(`📤 Step 2: Sell to Pool 1`);
                const sellResult = await this.executeTrade(
                    client,
                    wallet,
                    opportunity.pool1,
                    opportunity.token,
                    tokensReceived,
                    'sell'
                );

                if (!sellResult.success) {
                    console.warn(`⚠️ Bought tokens but sell failed: ${sellResult.error}`);
                    return {
                        opportunity,
                        executed: false,
                        error: `Sell failed: ${sellResult.error}`,
                        txHashes
                    };
                }

                txHashes.push(sellResult.txHash!);

                const xrpReceived = sellResult.xrpReceived || 0;
                const actualProfit = xrpReceived - opportunity.tradeAmount;
                const actualProfitPercent = (actualProfit / opportunity.tradeAmount) * 100;

                console.log(`✅ ARBITRAGE COMPLETE!`);
                console.log(`Profit: ${actualProfit.toFixed(2)} XRP (${actualProfitPercent.toFixed(2)}%)`);

                const execution: ArbitrageExecution = {
                    opportunity,
                    executed: true,
                    actualProfit,
                    txHashes,
                    executionTime: Date.now() - startTime
                };

                this.executionHistory.push(execution);
                return execution;
            }

        } catch (error: any) {
            console.error('Arbitrage execution error:', error);
            return {
                opportunity,
                executed: false,
                error: error.message || 'Unknown error',
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Execute a single trade (buy or sell)
     */
    private async executeTrade(
        client: Client,
        wallet: Wallet,
        _pool: PoolMetrics,
        token: { currency: string; issuer?: string },
        amount: number,
        type: 'buy' | 'sell'
    ): Promise<{
        success: boolean;
        tokensReceived?: number;
        xrpReceived?: number;
        txHash?: string;
        error?: string;
    }> {
        try {
            const tokenInfo = {
                currency: token.currency,
                issuer: token.issuer || '',
                readableCurrency: token.currency
            };

            if (type === 'buy') {
                const result = await executeBuy(
                    client,
                    wallet,
                    tokenInfo,
                    amount,
                    this.maxSlippage
                );

                const tokensAmount = typeof result.tokensReceived === 'string' 
                    ? parseFloat(result.tokensReceived) 
                    : result.tokensReceived;

                return {
                    success: result.success,
                    tokensReceived: tokensAmount,
                    txHash: result.txHash,
                    error: result.error
                };
            } else {
                const result = await executeSell(
                    client,
                    wallet,
                    tokenInfo,
                    amount,
                    this.maxSlippage
                );

                const xrpAmount = typeof result.xrpReceived === 'string' 
                    ? parseFloat(result.xrpReceived) 
                    : result.xrpReceived;

                return {
                    success: result.success,
                    xrpReceived: xrpAmount,
                    txHash: result.txHash,
                    error: result.error
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Trade execution failed'
            };
        }
    }

    /**
     * Get arbitrage execution statistics
     */
    getStatistics(): {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        totalProfit: number;
        averageProfit: number;
        successRate: number;
        averageExecutionTime: number;
    } {
        const successful = this.executionHistory.filter(e => e.executed);
        const failed = this.executionHistory.filter(e => !e.executed);

        const totalProfit = successful.reduce((sum, e) => sum + (e.actualProfit || 0), 0);
        const avgProfit = successful.length > 0 ? totalProfit / successful.length : 0;
        const successRate = this.executionHistory.length > 0 
            ? (successful.length / this.executionHistory.length) * 100 
            : 0;

        const avgExecutionTime = this.executionHistory.length > 0
            ? this.executionHistory.reduce((sum, e) => sum + (e.executionTime || 0), 0) / this.executionHistory.length
            : 0;

        return {
            totalExecutions: this.executionHistory.length,
            successfulExecutions: successful.length,
            failedExecutions: failed.length,
            totalProfit,
            averageProfit: avgProfit,
            successRate,
            averageExecutionTime: avgExecutionTime
        };
    }

    /**
     * Clear execution history
     */
    clearHistory(): void {
        this.executionHistory = [];
    }

    /**
     * Simple delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const arbitrageExecutor = new AMMArbitrageExecutor();
