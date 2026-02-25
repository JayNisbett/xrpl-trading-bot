import { Client } from 'xrpl';
import { getBalance, getTokenBalances } from '../xrpl/wallet';

export interface SafetyCheckResult {
    canTrade: boolean;
    reason?: string;
    availableXRP: number;
    lockedXRP: number;
    tradableXRP: number;
    activePositions: number;
}

const BASE_RESERVE = 1; // XRP base account reserve
const PER_TRUSTLINE_RESERVE = .2; // XRP per trust line
const SAFETY_BUFFER = 3; // Keep 1 XRP buffer for fees

/**
 * Check if account has sufficient balance for a trade
 * Takes into account XRPL reserves and safety buffers
 */
export async function checkSufficientBalance(
    client: Client,
    walletAddress: string,
    amountToSpend: number
): Promise<SafetyCheckResult> {
    try {
        // Get current balance
        const xrpBalance = await getBalance(client, walletAddress);
        
        // Get active trust lines (tokens held)
        const tokenBalances = await getTokenBalances(client, walletAddress);
        const trustLineCount = tokenBalances.length;
        const activePositions = tokenBalances.filter((line) => parseFloat(line.balance) > 0).length;

        // Calculate locked reserves (reserve is per trust line, not per position with balance)
        const trustLineReserves = trustLineCount * PER_TRUSTLINE_RESERVE;
        const totalLockedReserves = BASE_RESERVE + trustLineReserves;
        
        // Calculate available XRP for trading
        const tradableXRP = xrpBalance - totalLockedReserves - SAFETY_BUFFER;
        
        // Check if we can make this trade
        if (tradableXRP < amountToSpend) {
            const availableDisplay = Math.max(0, tradableXRP);
            return {
                canTrade: false,
                reason: `Insufficient tradable balance. Have ${availableDisplay.toFixed(2)} XRP available, need ${amountToSpend} XRP. (Total: ${xrpBalance} XRP, Locked: ${totalLockedReserves} XRP, Buffer: ${SAFETY_BUFFER} XRP)`,
                availableXRP: xrpBalance,
                lockedXRP: totalLockedReserves,
                tradableXRP: Math.max(0, tradableXRP),
                activePositions
            };
        }
        
        // Check if we're getting dangerously low
        if (tradableXRP - amountToSpend < 1) {
            const afterTrade = Math.max(0, tradableXRP - amountToSpend);
            return {
                canTrade: false,
                reason: `Trade would leave less than 1 XRP available. Current tradable: ${Math.max(0, tradableXRP).toFixed(2)} XRP, after trade: ${afterTrade.toFixed(2)} XRP`,
                availableXRP: xrpBalance,
                lockedXRP: totalLockedReserves,
                tradableXRP: Math.max(0, tradableXRP),
                activePositions
            };
        }
        
        return {
            canTrade: true,
            availableXRP: xrpBalance,
            lockedXRP: totalLockedReserves,
            tradableXRP: Math.max(0, tradableXRP),
            activePositions
        };
    } catch (error) {
        return {
            canTrade: false,
            reason: `Error checking balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            availableXRP: 0,
            lockedXRP: 0,
            tradableXRP: 0,
            activePositions: 0
        };
    }
}

/**
 * Check if account has hit maximum position limit
 * Prevents over-diversification with small capital
 */
export function checkPositionLimit(
    currentPositions: number,
    xrpBalance: number,
    maxPositions?: number
): { canAddPosition: boolean; reason?: string } {
    // Dynamic position limit based on balance
    const dynamicLimit = maxPositions || calculateMaxPositions(xrpBalance);
    
    if (currentPositions >= dynamicLimit) {
        return {
            canAddPosition: false,
            reason: `Maximum position limit reached (${currentPositions}/${dynamicLimit}). Close existing positions before opening new ones.`
        };
    }
    
    return {
        canAddPosition: true
    };
}

/**
 * Calculate maximum safe positions based on XRP balance
 * OPTIMIZED for high-frequency trading with 2 XRP positions
 */
function calculateMaxPositions(xrpBalance: number): number {
    // With 2 XRP per position, calculate based on tradable balance
    if (xrpBalance < 15) return 2;   // Very limited capital
    if (xrpBalance < 25) return 5;   // Allow more positions
    if (xrpBalance < 50) return 12;  // 47 XRP = 12 positions (24 XRP invested max)
    if (xrpBalance < 100) return 20; // Medium capital
    return 30; // Larger capital - allow many small positions
}

/**
 * Get a detailed account status report
 */
export async function getAccountStatus(
    client: Client,
    walletAddress: string
): Promise<{
    xrpBalance: number;
    lockedReserves: number;
    tradableXRP: number;
    activePositions: number;
    maxPositions: number;
    positionsAvailable: number;
    healthStatus: 'healthy' | 'warning' | 'critical';
}> {
    const xrpBalance = await getBalance(client, walletAddress);
    const tokenBalances = await getTokenBalances(client, walletAddress);
    const trustLineCount = tokenBalances.length;
    // Count only trust lines with positive balance (matches Positions page)
    const activePositions = tokenBalances.filter((line) => parseFloat(line.balance) > 0).length;

    const trustLineReserves = trustLineCount * PER_TRUSTLINE_RESERVE;
    const lockedReserves = BASE_RESERVE + trustLineReserves;
    const tradableXRP = Math.max(0, xrpBalance - lockedReserves - SAFETY_BUFFER);
    
    const maxPositions = calculateMaxPositions(xrpBalance);
    const positionsAvailable = Math.max(0, maxPositions - activePositions);
    
    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical';
    if (tradableXRP < 1) {
        healthStatus = 'critical';
    } else if (tradableXRP < 3 || activePositions >= maxPositions) {
        healthStatus = 'warning';
    } else {
        healthStatus = 'healthy';
    }
    
    return {
        xrpBalance,
        lockedReserves,
        tradableXRP,
        activePositions,
        maxPositions,
        positionsAvailable,
        healthStatus
    };
}

/**
 * Log a formatted account status
 */
export function logAccountStatus(status: Awaited<ReturnType<typeof getAccountStatus>>): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ACCOUNT STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Total XRP Balance: ${status.xrpBalance.toFixed(6)} XRP`);
    console.log(`🔒 Locked Reserves: ${status.lockedReserves.toFixed(2)} XRP`);
    console.log(`✅ Tradable XRP: ${status.tradableXRP.toFixed(2)} XRP`);
    console.log(`📈 Active Positions: ${status.activePositions}/${status.maxPositions}`);
    console.log(`➕ Positions Available: ${status.positionsAvailable}`);
    
    const healthEmoji = {
        'healthy': '🟢',
        'warning': '🟡',
        'critical': '🔴'
    }[status.healthStatus];
    
    console.log(`${healthEmoji} Health Status: ${status.healthStatus.toUpperCase()}`);
    
    if (status.healthStatus === 'critical') {
        console.log('\n⚠️  CRITICAL: Insufficient tradable XRP. Add funds or close positions!');
    } else if (status.healthStatus === 'warning') {
        console.log('\n⚠️  WARNING: Low tradable XRP or position limit reached.');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
