import { llmCapitalManager } from './manager';

interface TradeLogEntry {
    userId: string;
    strategy: 'amm' | 'sniper' | 'copyTrading';
    xrpAmount: number;
    timestamp: number;
}

const tradeLog: TradeLogEntry[] = [];

/** Per-user daily realized loss (dateKey -> loss in XRP) for maxDailyLossXrp enforcement. */
const dailyLossByUser = new Map<string, { dateKey: string; lossXrp: number }>();

function oneHourAgoMs(): number {
    return Date.now() - 60 * 60 * 1000;
}

function oneDayAgoMs(): number {
    return Date.now() - 24 * 60 * 60 * 1000;
}

function todayDateKey(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyRealizedLossXrp(userId: string): number {
    const entry = dailyLossByUser.get(userId);
    if (!entry) return 0;
    if (entry.dateKey !== todayDateKey()) return 0;
    return entry.lossXrp;
}

function pruneLogs(): void {
    const cutoff = oneDayAgoMs();
    while (tradeLog.length > 0 && tradeLog[0].timestamp < cutoff) {
        tradeLog.shift();
    }
}

export function canExecuteXrpTrade(
    userId: string,
    strategy: 'amm' | 'sniper' | 'copyTrading',
    xrpAmount: number
): { allowed: boolean; reason?: string } {
    const agent = llmCapitalManager.getAgentByUserId(userId);
    if (!agent) {
        // non-LLM managed users keep existing behavior
        return { allowed: true };
    }

    if (agent.status !== 'active') {
        return { allowed: false, reason: `Agent status is ${agent.status}` };
    }

    if (!agent.policy.allowedStrategies.includes(strategy)) {
        return { allowed: false, reason: `Strategy ${strategy} is not allowed for this agent` };
    }

    if (xrpAmount > agent.policy.maxPositionSizeXrp) {
        return { allowed: false, reason: `Trade amount exceeds max position size (${agent.policy.maxPositionSizeXrp} XRP)` };
    }

    if (xrpAmount > agent.allocatedXrp - agent.reservedXrp) {
        return { allowed: false, reason: 'Trade amount exceeds allocatable XRP budget' };
    }

    if (agent.policy.maxDailyLossXrp > 0) {
        const dailyLoss = getDailyRealizedLossXrp(userId);
        if (dailyLoss >= agent.policy.maxDailyLossXrp) {
            return {
                allowed: false,
                reason: `Max daily loss reached (${dailyLoss.toFixed(2)} XRP >= ${agent.policy.maxDailyLossXrp} XRP)`
            };
        }
    }

    pruneLogs();
    const recentTrades = tradeLog.filter(
        t => t.userId === userId && t.strategy === strategy && t.timestamp >= oneHourAgoMs()
    );
    if (recentTrades.length >= agent.policy.maxTradesPerHour) {
        return { allowed: false, reason: `Max trades per hour reached (${agent.policy.maxTradesPerHour})` };
    }

    return { allowed: true };
}

export function recordExecutedTrade(
    userId: string,
    strategy: 'amm' | 'sniper' | 'copyTrading',
    xrpAmount: number
): void {
    tradeLog.push({ userId, strategy, xrpAmount, timestamp: Date.now() });
}

/**
 * Record a realized loss for an LLM-managed user (e.g. stop-loss or losing sell).
 * Used to enforce maxDailyLossXrp: once daily loss >= policy max, canExecuteXrpTrade blocks further trades.
 */
export function recordRealizedLoss(userId: string, lossXrp: number): void {
    if (lossXrp <= 0) return;
    const key = todayDateKey();
    const entry = dailyLossByUser.get(userId);
    if (entry && entry.dateKey === key) {
        entry.lossXrp += lossXrp;
    } else {
        dailyLossByUser.set(userId, { dateKey: key, lossXrp });
    }
}
