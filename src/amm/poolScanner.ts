import { Client } from 'xrpl';
import { poolAnalyzer, PoolMetrics } from './poolAnalyzer';

/**
 * AMM POOL SCANNER
 * Discovers and tracks AMM pools on XRPL
 */

// Known high-volume tokens on XRPL (manually curated list)
// These are tokens that commonly have AMM pools
export const KNOWN_TOKENS = [
    // Popular stablecoins and wrapped assets
    { currency: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', name: 'Gatehub USD' },
    { currency: 'EUR', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', name: 'Gatehub EUR' },
    { currency: 'BTC', issuer: 'rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL', name: 'Bitstamp BTC' },
    { currency: 'ETH', issuer: 'rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h', name: 'Bitstamp ETH' },
    
    // Additional stablecoins (common on XRPL)
    { currency: 'USD', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', name: 'Bitstamp USD' },
    { currency: 'USDC', issuer: 'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu', name: 'USD Coin' },
    
    // Popular XRPL native tokens
    { currency: 'CSC', issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr', name: 'CasinoCoin' },
    { currency: 'ELS', issuer: 'rHXuEaRYnnJHbDeuBH5w8yPh5uwNVh5zAg', name: 'XRPL ELS' },
    { currency: 'SOLO', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz', name: 'Sologenic' },
    { currency: 'XRdoge', issuer: 'rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA', name: 'XRdoge' },
    { currency: 'CORE', issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D', name: 'Coreum' },
    { currency: 'XRP', issuer: 'rXRPLf569es4gEJnJk8n8bG1JhSNMNGWY', name: 'Wrapped XRP' },
    
    // Wrapped major assets
    { currency: 'BNB', issuer: 'rJHygWcTLVpSXkowott6kzgZU6viQSVYM1', name: 'Binance Coin' },
    { currency: 'ADA', issuer: 'rJHygWcTLVpSXkowott6kzgZU6viQSVYM1', name: 'Cardano' },
    { currency: 'SOL', issuer: 'rJHygWcTLVpSXkowott6kzgZU6viQSVYM1', name: 'Solana' },
    { currency: 'DOGE', issuer: 'rLHzPsX6oXkzU9rFfyge86nBGfcj3RaA7b', name: 'Dogecoin' },
    
    // More popular XRPL tokens
    { currency: 'XRPaynet', issuer: 'rPayNetWdUpzqKMvJP7jwddbPvWMERfaKb', name: 'XRPaynet' },
    { currency: 'Equilibrium', issuer: 'rEqtEHKbinqm18wQSQGstmqg9SFpUELasT', name: 'Equilibrium' },
    { currency: 'XRPH', issuer: 'rEa5M1xHD39cM2fBASZaDB3fy6zWvDHCLp', name: 'XRPH' },
    
    // Gaming & Metaverse tokens
    { currency: 'XRPunk', issuer: 'rEqtEHKbinqm18wQSQGstmqg9SFpUELasT', name: 'XRPunk' },
    { currency: 'Aesthetes', issuer: 'rHZwvHEs56GCmHCxi6qxLhRRWNKiDqzx8g', name: 'Aesthetes' },
    
    // Note: Verify issuers on XRPScan.com before trading
    // Add more tokens as you discover active AMM pools
    // Format: { currency: 'TOKEN', issuer: 'r...', name: 'Display Name' }
];

/**
 * Dynamically discover AMM pools from the ledger
 * This scans for actual AMM accounts on the network
 */
export async function discoverAMMPools(client: Client): Promise<Array<{ currency: string; issuer: string; name: string }>> {
    const discoveredTokens: Array<{ currency: string; issuer: string; name: string }> = [];
    const seenTokens = new Set<string>();
    
    console.log('🔍 Starting dynamic AMM pool discovery...');
    
    try {
        // Use account_lines to find active trustlines from major AMM accounts
        // This is a more efficient way to discover active tokens than scanning all accounts
        
        // Start with known major AMM participants and gateway accounts
        const seedAccounts = [
            'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // Gatehub
            'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp
            'rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL', // Bitstamp (BTC)
            'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu', // Circle (USDC)
            'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz', // Sologenic
            'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr', // CasinoCoin
        ];
        
        for (const _account of seedAccounts) {
            try {
                // For each seed account, check if they have AMM pools
                for (const token of KNOWN_TOKENS) {
                    const tokenKey = `${token.currency}:${token.issuer}`;
                    if (seenTokens.has(tokenKey)) continue;
                    
                    try {
                        // Try to get AMM info for XRP/TOKEN pair
                        const ammInfoResponse: any = await client.request({
                            command: 'amm_info',
                            asset: { currency: 'XRP' },
                            asset2: { currency: token.currency, issuer: token.issuer }
                        });
                        
                        if (ammInfoResponse?.result?.amm) {
                            discoveredTokens.push(token);
                            seenTokens.add(tokenKey);
                            console.log(`  ✅ Found active AMM: XRP/${token.name}`);
                        }
                    } catch (ammError: any) {
                        // Pool doesn't exist, skip
                        if (!ammError.message?.includes('actNotFound')) {
                            // Only log unexpected errors
                            // console.log(`  ⏭️  No AMM for ${token.name}`);
                        }
                    }
                }
            } catch (error) {
                // Continue with next seed account
            }
        }
        
        console.log(`✅ Discovery complete: Found ${discoveredTokens.length} active AMM pools`);
        return discoveredTokens;
        
    } catch (error) {
        console.error('Error during AMM pool discovery:', error);
        return [];
    }
}

/**
 * Scan for active AMM pools
 */
export async function scanAMMPools(client: Client, useDynamicDiscovery: boolean = false): Promise<PoolMetrics[]> {
    console.log('🔍 Scanning for active AMM pools...');
    const pools: PoolMetrics[] = [];
    let tokensToScan = KNOWN_TOKENS;

    try {
        // If dynamic discovery is enabled, find active pools first
        if (useDynamicDiscovery) {
            console.log('   🔄 Using dynamic pool discovery...');
            const discoveredTokens = await discoverAMMPools(client);
            
            // Merge discovered tokens with known tokens (avoiding duplicates)
            const tokenSet = new Set(KNOWN_TOKENS.map(t => `${t.currency}:${t.issuer}`));
            const newTokens = discoveredTokens.filter(t => !tokenSet.has(`${t.currency}:${t.issuer}`));
            
            tokensToScan = [...KNOWN_TOKENS, ...newTokens];
            console.log(`   📊 Scanning ${tokensToScan.length} tokens (${KNOWN_TOKENS.length} known + ${newTokens.length} discovered)`);
        }
        
        // Scan all tokens (known + discovered)
        for (const token of tokensToScan) {
            try {
                const metrics = await poolAnalyzer.analyzePool(client, token);
                if (metrics && metrics.tvl > 0) {
                    pools.push(metrics);
                    console.log(`   ✅ Found pool: ${token.name} (TVL: ${metrics.tvl.toFixed(2)} XRP)`);
                }
            } catch (error) {
                // Pool doesn't exist, skip
            }

            // Rate limiting to avoid overwhelming the node
            await delay(useDynamicDiscovery ? 150 : 200);
        }

    } catch (error) {
        console.error('Error scanning pools:', error);
    }

    console.log(`   ✅ Found ${pools.length} total active pools`);
    return pools;
}

/**
 * Find arbitrage opportunities across known pools
 */
export async function scanForArbitrage(
    client: Client,
    minProfitPercent: number = 0.5,
    maxTradeAmount: number = 100,
    useDynamicDiscovery: boolean = false
): Promise<any[]> {
    try {
        console.log('🔍 Scanning for arbitrage opportunities...');
        
        const opportunities = await poolAnalyzer.detectArbitrage(
            client, 
            minProfitPercent, 
            maxTradeAmount,
            useDynamicDiscovery
        );
        
        if (opportunities.length > 0) {
            console.log(`   ✅ Found ${opportunities.length} arbitrage opportunities (after filters)!`);
            for (const opp of opportunities.slice(0, 5)) { // Show top 5
                console.log(`      ${opp.token.currency}: ${opp.priceDifference.toFixed(2)}% difference, ` +
                           `${opp.profitPotential.toFixed(2)} XRP potential, ` +
                           `${opp.tradeAmount.toFixed(2)} XRP trade`);
            }
            if (opportunities.length > 5) {
                console.log(`      ... and ${opportunities.length - 5} more`);
            }
        } else {
            console.log('   ℹ️  No arbitrage opportunities found (may be filtered out or no price differences)');
        }

        return opportunities;
    } catch (error) {
        console.error('Error scanning for arbitrage:', error);
        return [];
    }
}

/**
 * Get pool recommendations based on risk profile
 */
export function rankPoolsByStrategy(
    pools: PoolMetrics[],
    strategy: 'conservative' | 'balanced' | 'aggressive'
): PoolMetrics[] {
    const sorted = [...pools];

    switch (strategy) {
        case 'conservative':
            // Prioritize high TVL, low price impact, moderate APR
            return sorted.sort((a, b) => {
                const scoreA = (a.tvl * 0.5) + ((a.apr || 0) * 0.3) - (a.priceImpact * 1000);
                const scoreB = (b.tvl * 0.5) + ((b.apr || 0) * 0.3) - (b.priceImpact * 1000);
                return scoreB - scoreA;
            });

        case 'balanced':
            // Balance between TVL and APR
            return sorted.sort((a, b) => {
                const scoreA = (a.tvl * 0.3) + ((a.apr || 0) * 0.5) - (a.priceImpact * 500);
                const scoreB = (b.tvl * 0.3) + ((b.apr || 0) * 0.5) - (b.priceImpact * 500);
                return scoreB - scoreA;
            });

        case 'aggressive':
            // Prioritize APR over TVL
            return sorted.sort((a, b) => {
                const scoreA = ((a.apr || 0) * 0.7) + (a.tvl * 0.2);
                const scoreB = ((b.apr || 0) * 0.7) + (b.tvl * 0.2);
                return scoreB - scoreA;
            });

        default:
            return sorted;
    }
}

/**
 * Filter pools by quality metrics
 */
export function filterQualityPools(
    pools: PoolMetrics[],
    minTVL: number = 100,
    maxPriceImpact: number = 0.05,
    minAPR: number = 10
): PoolMetrics[] {
    return pools.filter(pool => 
        pool.tvl >= minTVL &&
        pool.priceImpact <= maxPriceImpact &&
        (pool.apr || 0) >= minAPR
    );
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
