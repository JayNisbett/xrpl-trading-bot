import { Client } from 'xrpl';
import { poolAnalyzer, PoolMetrics } from './poolAnalyzer';

/** Normalized asset (XRP or issued token) for a pool pair */
export type PoolAsset = { currency: string; issuer?: string };

/** A pool identified by its two assets */
export type PoolPair = { asset1: PoolAsset; asset2: PoolAsset };

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
 * Normalize ledger Asset to PoolAsset (XRP has no issuer)
 */
function normalizeAsset(asset: { currency: string; issuer?: string }): PoolAsset {
    const currency = (asset.currency || '').trim();
    if (currency === 'XRP' || !currency) {
        return { currency: 'XRP' };
    }
    return { currency, issuer: asset.issuer || '' };
}

/** Delay between ledger_data pages to avoid node rate limit (slowDown). */
const LEDGER_PAGE_DELAY_MS = 600;
/** On slowDown, wait this long before retry; then double for next retry. */
const SLOWDOWN_BACKOFF_MS = 2000;
const MAX_SLOWDOWN_RETRIES = 4;

/**
 * Request one page of ledger_data with retries on slowDown (rate limit).
 */
async function ledgerDataRequest(client: Client, marker?: string): Promise<{ state: any[]; marker?: string }> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_SLOWDOWN_RETRIES; attempt++) {
        try {
            const req: any = {
                command: 'ledger_data',
                ledger_index: 'validated',
                type: 'AMM',
                limit: 128
            };
            if (marker) req.marker = marker;

            const resp: any = await client.request(req);
            const err = resp.result?.error || resp.error;
            const errCode = resp.result?.error_code ?? resp.error_code;

            if (err === 'slowDown' || errCode === 10) {
                const waitMs = SLOWDOWN_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`   ⏳ Node rate limit (slowDown); waiting ${waitMs / 1000}s before retry...`);
                await delay(waitMs);
                lastError = new Error('slowDown');
                continue;
            }

            if (err) {
                throw new Error(err || resp.result?.error_message || 'ledger_data error');
            }

            return {
                state: Array.isArray(resp.result?.state) ? resp.result.state : [],
                marker: resp.result?.marker
            };
        } catch (e: any) {
            const isSlowDown = e?.data?.error === 'slowDown' || e?.data?.error_code === 10 || e?.message === 'slowDown';
            if (isSlowDown && attempt < MAX_SLOWDOWN_RETRIES) {
                const waitMs = SLOWDOWN_BACKOFF_MS * Math.pow(2, attempt);
                console.log(`   ⏳ Node rate limit; waiting ${waitMs / 1000}s before retry...`);
                await delay(waitMs);
                lastError = e;
                continue;
            }
            throw e;
        }
    }
    throw lastError;
}

/**
 * Discover all AMM pools from the ledger via ledger_data (type=AMM).
 * Uses pacing and retries on slowDown to avoid overloading the node.
 */
export async function discoverAMMPoolsFromLedger(client: Client): Promise<PoolPair[]> {
    const pairs: PoolPair[] = [];
    const seen = new Set<string>();
    let marker: string | undefined;

    try {
        console.log('🔍 Discovering AMM pools from ledger (ledger_data type=AMM)...');
        do {
            const { state, marker: nextMarker } = await ledgerDataRequest(client, marker);
            marker = nextMarker;

            for (const entry of state) {
                if (entry.LedgerEntryType !== 'AMM') continue;
                const a = entry.Asset && typeof entry.Asset === 'object' ? entry.Asset : {};
                const a2 = entry.Asset2 && typeof entry.Asset2 === 'object' ? entry.Asset2 : {};
                const asset1 = normalizeAsset(a);
                const asset2 = normalizeAsset(a2);
                if (!asset1.currency || !asset2.currency) continue;
                const key = [asset1.currency, asset1.issuer || '', asset2.currency, asset2.issuer || ''].sort().join('|');
                if (seen.has(key)) continue;
                seen.add(key);
                pairs.push({ asset1, asset2 });
            }

            if (state.length > 0) {
                console.log(`   📄 Fetched ${state.length} AMM entries (total so far: ${pairs.length})`);
            }
            await delay(LEDGER_PAGE_DELAY_MS);
        } while (marker);

        console.log(`✅ Ledger discovery complete: ${pairs.length} AMM pools`);
        return pairs;
    } catch (error) {
        console.error('Error during ledger AMM discovery:', error);
        return pairs;
    }
}

/**
 * Dynamically discover AMM pools by probing known tokens (legacy).
 * Prefer discoverAMMPoolsFromLedger for many more pools.
 */
export async function discoverAMMPools(client: Client): Promise<Array<{ currency: string; issuer: string; name: string }>> {
    const discoveredTokens: Array<{ currency: string; issuer: string; name: string }> = [];
    const seenTokens = new Set<string>();

    try {
        for (const token of KNOWN_TOKENS) {
            const tokenKey = `${token.currency}:${token.issuer}`;
            if (seenTokens.has(tokenKey)) continue;

            try {
                const ammInfoResponse: any = await client.request({
                    command: 'amm_info',
                    asset: { currency: 'XRP' },
                    asset2: { currency: token.currency, issuer: token.issuer }
                });

                if (ammInfoResponse?.result?.amm) {
                    discoveredTokens.push(token);
                    seenTokens.add(tokenKey);
                }
            } catch {
                // Pool doesn't exist, skip
            }
            await delay(80);
        }
        return discoveredTokens;
    } catch (error) {
        console.error('Error during AMM pool discovery:', error);
        return [];
    }
}

/**
 * Scan for active AMM pools (uses ledger discovery when useDynamicDiscovery is true)
 */
export async function scanAMMPools(client: Client, useDynamicDiscovery: boolean = false): Promise<PoolMetrics[]> {
    console.log('🔍 Scanning for active AMM pools...');
    const pools: PoolMetrics[] = [];
    let pairs: PoolPair[];

    try {
        if (useDynamicDiscovery) {
            pairs = await discoverAMMPoolsFromLedger(client);
            console.log(`   📊 Analyzing ${pairs.length} pools from ledger`);
        } else {
            pairs = KNOWN_TOKENS.map(t => ({
                asset1: { currency: 'XRP' as const },
                asset2: { currency: t.currency, issuer: t.issuer }
            }));
        }

        for (const pair of pairs) {
            try {
                const metrics = await poolAnalyzer.analyzePoolByAssets(client, pair.asset1, pair.asset2);
                if (metrics && (metrics.tvl > 0 || (metrics.asset1.currency !== 'XRP' && metrics.asset2.currency !== 'XRP'))) {
                    pools.push(metrics);
                    const label = pair.asset1.currency === 'XRP'
                        ? `XRP/${pair.asset2.currency}`
                        : `${pair.asset1.currency}/${pair.asset2.currency}`;
                    if (metrics.tvl > 0) {
                        console.log(`   ✅ ${label} TVL: ${metrics.tvl.toFixed(2)} XRP`);
                    }
                }
            } catch {
                // skip
            }
            await delay(useDynamicDiscovery ? 80 : 200);
        }
    } catch (error) {
        console.error('Error scanning pools:', error);
    }

    console.log(`   ✅ Found ${pools.length} active pools`);
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
