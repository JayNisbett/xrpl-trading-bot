import { Client } from 'xrpl';
import { getAMMInfo } from '../xrpl/amm';

export interface PoolMetrics {
    ammId: string;
    asset1: { currency: string; issuer?: string };
    asset2: { currency: string; issuer?: string };
    asset1Reserve: number;
    asset2Reserve: number;
    lpTokens: number;
    tradingFee: number; // in basis points (0.1% = 10bp)
    volume24h?: number;
    apr?: number; // Annual Percentage Rate
    tvl: number; // Total Value Locked in XRP
    priceImpact: number; // Price impact for 1 XRP trade
    liquidityDepth: number; // How much XRP before 1% slippage
    lastUpdate: Date;
}

export interface ArbitrageOpportunity {
    pool1: PoolMetrics;
    pool2: PoolMetrics;
    token: { currency: string; issuer?: string };
    priceDifference: number; // Percentage difference
    profitPotential: number; // Estimated profit in XRP
    tradeAmount: number; // Optimal trade amount
    route: 'pool1ThenPool2' | 'pool2ThenPool1';
}

/**
 * AMM POOL ANALYZER
 * Analyzes liquidity pools for profitability, arbitrage, and yield opportunities
 */
export class AMMPoolAnalyzer {
    private poolCache: Map<string, PoolMetrics> = new Map();

    /**
     * Analyze a specific AMM pool
     */
    async analyzePool(
        client: Client,
        tokenInfo: { currency: string; issuer: string; readableCurrency?: string }
    ): Promise<PoolMetrics | null> {
        try {
            const ammInfo = await getAMMInfo(client, tokenInfo);
            if (!ammInfo) return null;

            // Parse pool reserves - handle both XRP (number) and tokens (object)
            const isAsset1XRP = typeof ammInfo.amount === 'string' || typeof ammInfo.amount === 'number';
            const isAsset2XRP = typeof ammInfo.amount2 === 'string' || typeof ammInfo.amount2 === 'number';

            const asset1Reserve = isAsset1XRP 
                ? parseFloat(ammInfo.amount.toString()) / 1000000 
                : parseFloat((ammInfo.amount as any).value);

            const asset2Reserve = isAsset2XRP 
                ? parseFloat(ammInfo.amount2.toString()) / 1000000 
                : parseFloat((ammInfo.amount2 as any).value);

            // Calculate trading fee (from AMM or default 0.1%)
            const tradingFee = ammInfo.trading_fee ? parseFloat(ammInfo.trading_fee) : 10; // 10bp = 0.1%

            // Calculate TVL (in XRP equivalent)
            let tvl: number;
            if (isAsset1XRP) {
                tvl = asset1Reserve * 2; // Assuming balanced pool
            } else if (isAsset2XRP) {
                tvl = asset2Reserve * 2;
            } else {
                // For token-token pools, estimate based on typical XRP price
                tvl = 0; // Would need price oracle
            }

            // Calculate price impact for 1 XRP trade
            const xrpReserve = isAsset1XRP ? asset1Reserve : asset2Reserve;
            const tokenReserve = isAsset1XRP ? asset2Reserve : asset1Reserve;
            const priceImpact = this.calculatePriceImpact(1, xrpReserve, tokenReserve);

            // Calculate liquidity depth (XRP amount for 1% slippage)
            const liquidityDepth = this.calculateLiquidityDepth(xrpReserve, tokenReserve, 0.01);

            const metrics: PoolMetrics = {
                ammId: ammInfo.amm_id || '',
                asset1: isAsset1XRP 
                    ? { currency: 'XRP' }
                    : { 
                        currency: (ammInfo.amount as any).currency, 
                        issuer: (ammInfo.amount as any).issuer 
                    },
                asset2: isAsset2XRP 
                    ? { currency: 'XRP' }
                    : { 
                        currency: (ammInfo.amount2 as any).currency, 
                        issuer: (ammInfo.amount2 as any).issuer 
                    },
                asset1Reserve,
                asset2Reserve,
                lpTokens: ammInfo.lp_token ? parseFloat((ammInfo.lp_token as any).value) : 0,
                tradingFee,
                tvl,
                priceImpact,
                liquidityDepth,
                lastUpdate: new Date()
            };

            // Cache the metrics
            this.poolCache.set(ammInfo.amm_id || '', metrics);

            return metrics;
        } catch (error) {
            console.error('Error analyzing pool:', error);
            return null;
        }
    }

    /**
     * Find all profitable AMM pools
     */
    async findProfitablePools(
        client: Client,
        minTVL: number = 100, // Minimum 100 XRP TVL
        maxPriceImpact: number = 0.05, // Max 5% price impact for 1 XRP
        useDynamicDiscovery: boolean = false // Use dynamic pool discovery
    ): Promise<PoolMetrics[]> {
        try {
            // Get all AMMs from ledger
            const amms = await this.getAllAMMs(client, useDynamicDiscovery);
            const profitablePools: PoolMetrics[] = [];

            for (const amm of amms) {
                const metrics = await this.analyzePool(client, amm);
                if (metrics && metrics.tvl >= minTVL && metrics.priceImpact <= maxPriceImpact) {
                    // Calculate estimated APR based on trading fee and volume
                    metrics.apr = this.estimateAPR(metrics);
                    profitablePools.push(metrics);
                }
            }

            // Sort by APR descending
            return profitablePools.sort((a, b) => (b.apr || 0) - (a.apr || 0));
        } catch (error) {
            console.error('Error finding profitable pools:', error);
            return [];
        }
    }

    /**
     * Detect arbitrage opportunities between pools
     */
    async detectArbitrage(
        client: Client,
        minProfitPercent: number = 0.5, // Minimum 0.5% profit
        maxTradeAmount: number = 100, // Maximum trade amount in XRP
        useDynamicDiscovery: boolean = false // Use dynamic pool discovery
    ): Promise<ArbitrageOpportunity[]> {
        try {
            const pools = await this.findProfitablePools(client, 50, 0.05, useDynamicDiscovery); // Lower TVL for more options
            const opportunities: ArbitrageOpportunity[] = [];
            
            let totalComparisons = 0;
            let sharedTokenFound = 0;
            let priceCalculated = 0;
            let priceValid = 0;
            let profitableFound = 0;

            // Compare pools with common tokens
            for (let i = 0; i < pools.length; i++) {
                for (let j = i + 1; j < pools.length; j++) {
                    totalComparisons++;
                    const pool1 = pools[i];
                    const pool2 = pools[j];

                    // Check if pools share a token
                    const sharedToken = this.findSharedToken(pool1, pool2);
                    if (!sharedToken) continue;
                    sharedTokenFound++;

                    // Calculate price difference
                    const price1 = this.getTokenPrice(pool1, sharedToken);
                    const price2 = this.getTokenPrice(pool2, sharedToken);
                    
                    if (!price1 || !price2) continue;
                    priceCalculated++;
                    
                    // Filter out extreme or invalid prices
                    // Prices should be positive and not too extreme
                    if (price1 <= 0 || price2 <= 0) continue;
                    if (price1 > 1000000 || price2 > 1000000) continue; // Unrealistic prices
                    if (price1 < 0.0000001 || price2 < 0.0000001) continue; // Too small to be meaningful

                    const priceDiff = Math.abs(price1 - price2) / Math.min(price1, price2);
                    
                    // Cap maximum price difference at 1000% (10x)
                    // Opportunities beyond this are likely data errors
                    if (priceDiff > 10) continue;
                    priceValid++;
                    
                    if (priceDiff >= minProfitPercent / 100) {
                        profitableFound++;
                        
                        // Calculate optimal trade amount
                        const optimalAmount = this.calculateOptimalArbitrageAmount(
                            pool1, pool2, sharedToken, price1, price2, maxTradeAmount
                        );
                        
                        // Skip if optimal amount is too small or too large
                        if (optimalAmount < 1 || optimalAmount > 100000) {
                            console.log(`   ⚠️ Filtered: ${sharedToken.currency} - trade amount ${optimalAmount.toFixed(2)} XRP out of range`);
                            continue;
                        }

                        const opportunity: ArbitrageOpportunity = {
                            pool1,
                            pool2,
                            token: sharedToken,
                            priceDifference: priceDiff * 100,
                            profitPotential: optimalAmount * priceDiff,
                            tradeAmount: optimalAmount,
                            route: price1 < price2 ? 'pool1ThenPool2' : 'pool2ThenPool1'
                        };

                        opportunities.push(opportunity);
                    }
                }
            }

            console.log(`   📊 Arbitrage scan stats:`);
            console.log(`      Total comparisons: ${totalComparisons}`);
            console.log(`      Shared tokens found: ${sharedTokenFound}`);
            console.log(`      Prices calculated: ${priceCalculated}`);
            console.log(`      Valid prices: ${priceValid}`);
            console.log(`      Profitable (>${minProfitPercent}%): ${profitableFound}`);
            console.log(`      Final opportunities: ${opportunities.length}`);

            // Sort by profit potential
            return opportunities.sort((a, b) => b.profitPotential - a.profitPotential);
        } catch (error) {
            console.error('Error detecting arbitrage:', error);
            return [];
        }
    }

    /**
     * Calculate optimal amount for one-sided liquidity provision
     */
    calculateOptimalLiquidityAmount(
        xrpReserve: number,
        tokenReserve: number,
        xrpAmount: number,
        targetSlippage: number = 0.02 // 2% max slippage
    ): { depositAmount: number; expectedTokens: number; slippage: number } {
        // For one-sided entry, calculate how much we can add without excessive slippage
        const k = xrpReserve * tokenReserve; // Constant product
        const newXRPReserve = xrpReserve + xrpAmount;
        const newTokenReserve = k / newXRPReserve;
        const tokensReceived = tokenReserve - newTokenReserve;
        
        const effectivePrice = xrpAmount / tokensReceived;
        const spotPrice = xrpReserve / tokenReserve;
        const slippage = (effectivePrice - spotPrice) / spotPrice;

        if (slippage > targetSlippage) {
            // Reduce amount to hit target slippage
            const adjustedAmount = xrpAmount * (targetSlippage / slippage);
            return this.calculateOptimalLiquidityAmount(
                xrpReserve, tokenReserve, adjustedAmount, targetSlippage
            );
        }

        return {
            depositAmount: xrpAmount,
            expectedTokens: tokensReceived,
            slippage
        };
    }

    /**
     * Calculate price impact for a given trade
     */
    private calculatePriceImpact(
        amountIn: number,
        reserveIn: number,
        reserveOut: number
    ): number {
        const k = reserveIn * reserveOut;
        const newReserveIn = reserveIn + amountIn;
        const newReserveOut = k / newReserveIn;
        const amountOut = reserveOut - newReserveOut;
        
        const effectivePrice = amountIn / amountOut;
        const spotPrice = reserveIn / reserveOut;
        
        return Math.abs((effectivePrice - spotPrice) / spotPrice);
    }

    /**
     * Calculate liquidity depth (amount before X% slippage)
     */
    private calculateLiquidityDepth(
        reserveIn: number,
        reserveOut: number,
        targetSlippage: number
    ): number {
        // Binary search for amount that causes target slippage
        let low = 0;
        let high = reserveIn * 0.1; // Max 10% of reserve
        let result = 0;

        while (high - low > 0.01) {
            const mid = (low + high) / 2;
            const impact = this.calculatePriceImpact(mid, reserveIn, reserveOut);
            
            if (impact < targetSlippage) {
                result = mid;
                low = mid;
            } else {
                high = mid;
            }
        }

        return result;
    }

    /**
     * Estimate APR based on pool metrics
     */
    private estimateAPR(metrics: PoolMetrics): number {
        // Estimate daily volume as 5% of TVL (conservative)
        const estimatedDailyVolume = metrics.tvl * 0.05;
        // Daily fees = volume * trading fee
        const dailyFees = estimatedDailyVolume * (metrics.tradingFee / 10000);
        // Annual fees
        const annualFees = dailyFees * 365;
        // APR = annual fees / TVL
        return (annualFees / metrics.tvl) * 100;
    }

    /**
     * Get all AMMs from ledger
     */
    private async getAllAMMs(client: Client, useDynamicDiscovery: boolean = false): Promise<Array<{ currency: string; issuer: string }>> {
        const { KNOWN_TOKENS, discoverAMMPools } = await import('./poolScanner');
        
        if (useDynamicDiscovery) {
            // Use dynamic discovery to find active pools
            const discoveredTokens = await discoverAMMPools(client);
            
            // Merge with known tokens (avoiding duplicates)
            const tokenSet = new Set(KNOWN_TOKENS.map(t => `${t.currency}:${t.issuer}`));
            const newTokens = discoveredTokens.filter(t => !tokenSet.has(`${t.currency}:${t.issuer}`));
            
            const allTokens = [...KNOWN_TOKENS, ...newTokens];
            console.log(`   📊 Using ${allTokens.length} tokens (${KNOWN_TOKENS.length} known + ${newTokens.length} discovered)`);
            
            return allTokens.map(t => ({ currency: t.currency, issuer: t.issuer }));
        } else {
            // Use only known tokens
            return KNOWN_TOKENS.map(t => ({ currency: t.currency, issuer: t.issuer }));
        }
    }

    /**
     * Find shared token between two pools
     */
    private findSharedToken(
        pool1: PoolMetrics,
        pool2: PoolMetrics
    ): { currency: string; issuer?: string } | null {
        // CRITICAL: Never return XRP as shared token
        // XRP is the native currency and cannot be arbitraged as an issued currency
        // We only arbitrage the issued tokens in XRP/TOKEN pools
        
        // Check if asset1 of pool1 matches any asset in pool2
        if (this.tokensMatch(pool1.asset1, pool2.asset1) || 
            this.tokensMatch(pool1.asset1, pool2.asset2)) {
            // Only return if it's NOT XRP
            if (pool1.asset1.currency !== 'XRP') {
                return pool1.asset1;
            }
        }
        if (this.tokensMatch(pool1.asset2, pool2.asset1) || 
            this.tokensMatch(pool1.asset2, pool2.asset2)) {
            // Only return if it's NOT XRP
            if (pool1.asset2.currency !== 'XRP') {
                return pool1.asset2;
            }
        }
        return null;
    }

    /**
     * Check if two tokens match
     */
    private tokensMatch(
        token1: { currency: string; issuer?: string },
        token2: { currency: string; issuer?: string }
    ): boolean {
        return token1.currency === token2.currency && 
               token1.issuer === token2.issuer;
    }

    /**
     * Get token price in a pool
     */
    private getTokenPrice(
        pool: PoolMetrics,
        token: { currency: string; issuer?: string }
    ): number | null {
        if (this.tokensMatch(pool.asset1, token)) {
            return pool.asset2Reserve / pool.asset1Reserve;
        }
        if (this.tokensMatch(pool.asset2, token)) {
            return pool.asset1Reserve / pool.asset2Reserve;
        }
        return null;
    }

    /**
     * Calculate optimal arbitrage amount
     */
    private calculateOptimalArbitrageAmount(
        pool1: PoolMetrics,
        pool2: PoolMetrics,
        _token: { currency: string; issuer?: string },
        _price1: number,
        _price2: number,
        maxTradeAmount: number = 100 // Default max
    ): number {
        // Use 5% of the smaller pool's liquidity, capped at maxTradeAmount
        const liquidity1 = Math.min(pool1.asset1Reserve, pool1.asset2Reserve);
        const liquidity2 = Math.min(pool2.asset1Reserve, pool2.asset2Reserve);
        const optimalFromLiquidity = Math.min(liquidity1, liquidity2) * 0.05;
        
        // Cap at configured max trade amount
        return Math.min(optimalFromLiquidity, maxTradeAmount);
    }
}

export const poolAnalyzer = new AMMPoolAnalyzer();
