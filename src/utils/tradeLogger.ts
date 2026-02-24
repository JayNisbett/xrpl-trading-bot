/**
 * TRADE FREQUENCY LOGGER
 * Tracks and displays trading activity metrics
 */

class TradeLogger {
    private static instance: TradeLogger;
    private sniperAttempts: number = 0;
    private successfulSnipes: number = 0;
    private profitTakes: number = 0;
    private stopLosses: number = 0;
    private startTime: Date = new Date();
    private lastTradeTime: Date | null = null;

    private constructor() {}

    static getInstance(): TradeLogger {
        if (!TradeLogger.instance) {
            TradeLogger.instance = new TradeLogger();
        }
        return TradeLogger.instance;
    }

    recordSnipeAttempt(): void {
        this.sniperAttempts++;
    }

    recordSuccessfulSnipe(tokenSymbol: string, amount: number): void {
        this.successfulSnipes++;
        this.lastTradeTime = new Date();
        console.log(`✅ SNIPE #${this.successfulSnipes}: ${tokenSymbol} for ${amount} XRP`);
    }

    recordProfitTake(tokenSymbol: string, profit: number, profitPercent: number): void {
        this.profitTakes++;
        this.lastTradeTime = new Date();
        console.log(`💰 PROFIT TAKE #${this.profitTakes}: ${tokenSymbol} +${profit.toFixed(2)} XRP (+${profitPercent.toFixed(2)}%)`);
    }

    recordStopLoss(tokenSymbol: string, loss: number, lossPercent: number): void {
        this.stopLosses++;
        this.lastTradeTime = new Date();
        console.log(`🛑 STOP LOSS #${this.stopLosses}: ${tokenSymbol} ${loss.toFixed(2)} XRP (${lossPercent.toFixed(2)}%)`);
    }

    getStats(): {
        sniperAttempts: number;
        successfulSnipes: number;
        profitTakes: number;
        stopLosses: number;
        successRate: number;
        tradesPerHour: number;
        uptime: number;
        lastTradeTime: Date | null;
    } {
        const now = new Date();
        const uptimeMs = now.getTime() - this.startTime.getTime();
        const uptimeHours = uptimeMs / (1000 * 60 * 60);
        
        const totalTrades = this.profitTakes + this.stopLosses;
        const successRate = totalTrades > 0 
            ? (this.profitTakes / totalTrades) * 100 
            : 0;
        
        const tradesPerHour = uptimeHours > 0 
            ? totalTrades / uptimeHours 
            : 0;

        return {
            sniperAttempts: this.sniperAttempts,
            successfulSnipes: this.successfulSnipes,
            profitTakes: this.profitTakes,
            stopLosses: this.stopLosses,
            successRate,
            tradesPerHour,
            uptime: uptimeMs,
            lastTradeTime: this.lastTradeTime
        };
    }

    displayStats(): void {
        const stats = this.getStats();
        const uptimeMinutes = Math.floor(stats.uptime / (1000 * 60));
        const uptimeHours = Math.floor(uptimeMinutes / 60);
        const displayMinutes = uptimeMinutes % 60;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TRADING FREQUENCY STATS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Uptime: ${uptimeHours}h ${displayMinutes}m`);
        console.log(`🎯 Snipe Attempts: ${stats.sniperAttempts}`);
        console.log(`✅ Successful Snipes: ${stats.successfulSnipes}`);
        console.log(`💰 Profit Takes: ${stats.profitTakes}`);
        console.log(`🛑 Stop Losses: ${stats.stopLosses}`);
        console.log(`📈 Win Rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`⚡ Trades/Hour: ${stats.tradesPerHour.toFixed(1)}`);
        
        if (stats.lastTradeTime) {
            const timeSinceLastTrade = Math.floor((new Date().getTime() - stats.lastTradeTime.getTime()) / 1000);
            console.log(`🕐 Last Trade: ${timeSinceLastTrade}s ago`);
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    reset(): void {
        this.sniperAttempts = 0;
        this.successfulSnipes = 0;
        this.profitTakes = 0;
        this.stopLosses = 0;
        this.startTime = new Date();
        this.lastTradeTime = null;
    }
}

export default TradeLogger;
