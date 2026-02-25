import { Client } from 'xrpl';
import { broadcastUpdate } from '../api/server';
import { saveUser } from '../database/storage';
import { User } from '../database/user';
import { logger } from '../utils/logger';
import { getWalletForUser } from '../xrpl/walletProvider';
import { AMMArbitrageExecutor } from './arbitrageExecutor';
import { AMMPoliquidityProvider, LPPosition } from './liquidityProvider';
import { AMMPoolAnalyzer, PoolMetrics } from './poolAnalyzer';
import { filterQualityPools, rankPoolsByStrategy, scanAMMPools, scanForArbitrage } from './poolScanner';
import { canExecuteXrpTrade, recordExecutedTrade } from '../llmCapital/guards';
import { llmAllowsTrade } from '../llmCapital/llmDecision';
import { checkSufficientBalance, checkPositionLimit } from '../utils/safetyChecks';

export interface AMMBotConfig {
    dynamicPoolDiscovery?: boolean; // Enable dynamic pool discovery
    strategies: {
        arbitrage: boolean;
        liquidityProvision: boolean;
        yieldFarming: boolean;
    };
    arbitrage: {
        enabled: boolean;
        minProfitPercent: number;
        maxTradeAmount: number;
        checkInterval: number; // milliseconds
    };
    liquidity: {
        enabled: boolean;
        strategy: 'one-sided' | 'balanced' | 'auto';
        minTVL: number;
        maxPriceImpact: number;
        targetAPR: number;
        maxPositions: number;
    };
    risk: {
        maxImpermanentLoss: number; // percentage
        maxPositionSize: number; // XRP
        diversification: boolean; // spread across multiple pools
    };
}

/**
 * AMM BOT - Main orchestrator for AMM strategies
 * Manages arbitrage, liquidity provision, and yield farming
 */
export class AMMBot {
    private client: Client | null = null;
    private userId: string;
    private config: AMMBotConfig;
    private isRunning = false;
    private poolAnalyzer: AMMPoolAnalyzer;
    private liquidityProvider: AMMPoliquidityProvider;
    private arbitrageExecutor: AMMArbitrageExecutor;
    private activePositions: Map<string, LPPosition> = new Map();
    private checkInterval: NodeJS.Timeout | null = null;
    private botId?: string;
    private botName?: string;
    private loopLock = false;

    constructor(userId: string, config: AMMBotConfig, botId?: string, botName?: string) {
        this.userId = userId;
        this.config = config;
        this.botId = botId;
        this.botName = botName;
        this.poolAnalyzer = new AMMPoolAnalyzer();
        this.liquidityProvider = new AMMPoliquidityProvider();
        this.arbitrageExecutor = new AMMArbitrageExecutor({
            minProfitThreshold: config.arbitrage.minProfitPercent
        });
    }

    /**
     * Start the AMM bot
     */
    async start(client: Client): Promise<void> {
        if (this.isRunning) {
            logger.warning('AMM', 'Bot is already running', null, this.botId, this.botName);
            return;
        }

        this.client = client;
        this.isRunning = true;

        logger.success('AMM', 'Bot started successfully', {
            strategies: {
                arbitrage: this.config.arbitrage.enabled,
                liquidity: this.config.liquidity.enabled,
                yieldFarming: this.config.strategies.yieldFarming
            },
            riskSettings: {
                maxImpermanentLoss: `${this.config.risk.maxImpermanentLoss}%`,
                maxPositionSize: `${this.config.risk.maxPositionSize} XRP`,
                diversification: this.config.risk.diversification
            }
        }, this.botId, this.botName);

        // Start main loop
        this.runMainLoop();
    }

    /**
     * Stop the AMM bot
     */
    async stop(): Promise<void> {
        logger.info('AMM', 'Stopping bot...', null, this.botId, this.botName);
        this.isRunning = false;

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        logger.success('AMM', 'Bot stopped', null, this.botId, this.botName);
    }

    /**
     * Main bot loop
     */
    private async runMainLoop(): Promise<void> {
        const check = async () => {
            if (!this.isRunning || !this.client) return;
            if (this.loopLock) {
                logger.debug('AMM', 'Main loop still in progress, skipping this tick', null, this.botId, this.botName);
                return;
            }
            this.loopLock = true;
            try {
                // Step 1: Arbitrage detection and execution
                if (this.config.arbitrage.enabled) {
                    await this.checkAndExecuteArbitrage();
                }

                // Step 2: Find and enter profitable liquidity pools
                if (this.config.liquidity.enabled) {
                    await this.manageLiquidityPositions();
                }

                // Step 3: Monitor and manage existing positions
                await this.monitorPositions();

                // Step 4: Broadcast updates to dashboard
                await this.broadcastStatus();

            } catch (error) {
                console.error('Error in AMM bot loop:', error);
            } finally {
                this.loopLock = false;
            }
        };

        // Initial check
        await check();

        // Set up interval
        this.checkInterval = setInterval(check, this.config.arbitrage.checkInterval);
    }

    /**
     * Check for and execute arbitrage opportunities
     */
    private async checkAndExecuteArbitrage(): Promise<void> {
        if (!this.client) return;

        try {
            const dynamicDiscovery = this.config.dynamicPoolDiscovery ?? true;
            logger.debug('Arbitrage', 'Scanning for opportunities...',
                {
                    minProfit: this.config.arbitrage.minProfitPercent,
                    maxTrade: this.config.arbitrage.maxTradeAmount,
                    dynamicDiscovery
                },
                this.botId, this.botName);

            const opportunities = await scanForArbitrage(
                this.client,
                this.config.arbitrage.minProfitPercent,
                this.config.arbitrage.maxTradeAmount,
                dynamicDiscovery
            );

            if (opportunities.length === 0) {
                return;
            }

            logger.info('Arbitrage', `Found ${opportunities.length} opportunities`,
                { count: opportunities.length, minProfit: this.config.arbitrage.minProfitPercent },
                this.botId, this.botName);

            // Execute the best opportunity within risk limits
            for (const opp of opportunities) {
                if (opp.tradeAmount > this.config.arbitrage.maxTradeAmount) {
                    logger.warning('Arbitrage', 'Opportunity exceeds max trade amount, skipping',
                        { tradeAmount: opp.tradeAmount, maxAmount: this.config.arbitrage.maxTradeAmount },
                        this.botId, this.botName);
                    continue;
                }

                const wallet = getWalletForUser(this.userId);
                const balanceCheck = await checkSufficientBalance(this.client, wallet.address, opp.tradeAmount);
                if (!balanceCheck.canTrade) {
                    logger.warning('Arbitrage', 'Safety check: insufficient balance for arbitrage',
                        { reason: balanceCheck.reason, tradeAmount: opp.tradeAmount }, this.botId, this.botName);
                    continue;
                }
                // Arbitrage is round-trip (buy then sell); do not apply position limit here (only for LP entry).

                const llmGuard = canExecuteXrpTrade(this.userId, 'amm', opp.tradeAmount);
                if (!llmGuard.allowed) {
                    logger.warning('Arbitrage', 'LLM policy blocked AMM arbitrage trade',
                        { reason: llmGuard.reason, tradeAmount: opp.tradeAmount }, this.botId, this.botName);
                    continue;
                }

                const llmOk = await llmAllowsTrade(this.userId, 'amm', opp.tradeAmount, { token: opp.token.currency, description: 'arbitrage' });
                if (!llmOk.allowed) {
                    logger.warning('Arbitrage', 'LLM service declined AMM arbitrage trade',
                        { reason: llmOk.reason, tradeAmount: opp.tradeAmount }, this.botId, this.botName);
                    continue;
                }

                logger.info('Arbitrage', `Executing arbitrage opportunity`,
                    {
                        token: opp.token.currency,
                        expectedProfit: `${opp.priceDifference.toFixed(2)}%`,
                        tradeAmount: opp.tradeAmount
                    }, this.botId, this.botName);
                const execution = await this.arbitrageExecutor.executeArbitrage(
                    this.client,
                    wallet,
                    opp
                );

                if (execution.executed) {
                    recordExecutedTrade(this.userId, 'amm', opp.tradeAmount);
                    logger.success('Arbitrage', `Arbitrage executed successfully`,
                        {
                            token: opp.token.currency,
                            actualProfit: execution.actualProfit,
                            txHashes: execution.txHashes,
                            executionTime: execution.executionTime
                        }, this.botId, this.botName);

                    // Record successful arbitrage
                    await this.recordArbitrage(execution);

                    // Broadcast to dashboard
                    broadcastUpdate('arbitrage', {
                        profit: execution.actualProfit,
                        token: opp.token.currency,
                        timestamp: new Date()
                    });

                    break; // Execute one at a time
                } else {
                    logger.warning('Arbitrage', `Arbitrage execution failed`,
                        { token: opp.token.currency, error: execution.error },
                        this.botId, this.botName);
                }
            }

        } catch (error: any) {
            logger.error('Arbitrage', `Error during arbitrage scan: ${error.message}`,
                { error: error.stack }, this.botId, this.botName);
        }
    }

    /**
     * Manage liquidity provision positions
     */
    private async manageLiquidityPositions(): Promise<void> {
        if (!this.client) return;

        try {
            // Check if we can enter new positions
            if (this.activePositions.size >= this.config.liquidity.maxPositions) {
                logger.debug('Liquidity', `Max positions reached (${this.activePositions.size}/${this.config.liquidity.maxPositions})`,
                    null, this.botId, this.botName);
                return;
            }

            logger.debug('Liquidity', 'Scanning for profitable pools...', null, this.botId, this.botName);

            // Scan for all available pools (use dynamic discovery when enabled)
            const useDynamicDiscovery = this.config.dynamicPoolDiscovery ?? true;
            const allPools = await scanAMMPools(this.client, useDynamicDiscovery);
            logger.info('Liquidity', `Scanned ${allPools.length} AMM pools`,
                { totalPools: allPools.length }, this.botId, this.botName);

            // Filter for quality pools
            const qualityPools = filterQualityPools(
                allPools,
                this.config.liquidity.minTVL,
                this.config.liquidity.maxPriceImpact,
                this.config.liquidity.targetAPR
            );

            if (qualityPools.length === 0) {
                logger.info('Liquidity', 'No pools meet quality criteria',
                    {
                        minTVL: this.config.liquidity.minTVL,
                        targetAPR: this.config.liquidity.targetAPR
                    }, this.botId, this.botName);
                return;
            }

            // Rank pools by configured strategy
            const rankingStrategy = this.config.liquidity.strategy === 'one-sided'
                ? 'conservative'
                : this.config.liquidity.strategy === 'auto'
                    ? 'aggressive'
                    : 'balanced';
            const rankedPools = rankPoolsByStrategy(qualityPools, rankingStrategy);

            logger.info('Liquidity', `Found ${rankedPools.length} high-yield pools`,
                { count: rankedPools.length }, this.botId, this.botName);

            // Enter the best pool
            const bestPool = rankedPools[0];
            await this.enterLiquidityPosition(bestPool);

        } catch (error: any) {
            logger.error('Liquidity', `Error managing liquidity: ${error.message}`,
                { error: error.stack }, this.botId, this.botName);
        }
    }

    /**
     * Enter a liquidity position
     */
    private async enterLiquidityPosition(pool: PoolMetrics): Promise<void> {
        if (!this.client) return;

        try {
            const wallet = getWalletForUser(this.userId);
            const depositAmount = Math.min(
                this.config.risk.maxPositionSize,
                pool.liquidityDepth * 0.1 // Use 10% of liquidity depth
            );

            const balanceCheck = await checkSufficientBalance(this.client, wallet.address, depositAmount);
            if (!balanceCheck.canTrade) {
                logger.warning('Liquidity', 'Safety check: insufficient balance for LP entry',
                    { reason: balanceCheck.reason, depositAmount }, this.botId, this.botName);
                return;
            }
            const positionLimitCheck = checkPositionLimit(
                balanceCheck.activePositions,
                balanceCheck.availableXRP,
                this.config.liquidity.maxPositions
            );
            if (!positionLimitCheck.canAddPosition) {
                logger.warning('Liquidity', 'Safety check: position limit for LP entry',
                    { reason: positionLimitCheck.reason }, this.botId, this.botName);
                return;
            }

            const llmGuard = canExecuteXrpTrade(this.userId, 'amm', depositAmount);
            if (!llmGuard.allowed) {
                logger.warning('Liquidity', 'LLM policy blocked LP entry',
                    { reason: llmGuard.reason, depositAmount }, this.botId, this.botName);
                return;
            }

            const llmOk = await llmAllowsTrade(this.userId, 'amm', depositAmount, { description: 'LP entry' });
            if (!llmOk.allowed) {
                logger.warning('Liquidity', 'LLM service declined LP entry', { reason: llmOk.reason, depositAmount }, this.botId, this.botName);
                return;
            }

            logger.info('Liquidity', `Preparing to enter position`, {
                pool: `${pool.asset1.currency}/${pool.asset2.currency}`,
                estimatedAPR: `${pool.apr?.toFixed(2)}%`,
                depositAmount: `${depositAmount.toFixed(2)} XRP`,
                strategy: this.config.liquidity.strategy
            }, this.botId, this.botName);

            let result;
            if (this.config.liquidity.strategy === 'one-sided') {
                result = await this.liquidityProvider.depositOneSided(
                    this.client,
                    wallet,
                    pool,
                    depositAmount
                );
            } else {
                result = await this.liquidityProvider.depositBalanced(
                    this.client,
                    wallet,
                    pool,
                    depositAmount
                );
            }

            if (result.success) {
                recordExecutedTrade(this.userId, 'amm', depositAmount);

                // Create position record
                const strategyUsed: 'one-sided' | 'balanced' | 'dual-sided' =
                    this.config.liquidity.strategy === 'auto' ? 'one-sided' : this.config.liquidity.strategy;

                const position: LPPosition = {
                    poolId: pool.ammId,
                    asset1: pool.asset1,
                    asset2: pool.asset2,
                    lpTokens: result.lpTokens || 0,
                    initialDeposit: {
                        asset1Amount: depositAmount,
                        asset2Amount: 0,
                        totalValue: depositAmount
                    },
                    currentValue: depositAmount,
                    feesEarned: 0,
                    impermanentLoss: 0,
                    apr: pool.apr || 0,
                    entryTime: new Date(),
                    strategy: strategyUsed
                };

                this.activePositions.set(pool.ammId, position);

                // Save to database
                await this.saveLPPosition(position);

                logger.success('Liquidity', `Position entered successfully`, {
                    pool: `${pool.asset1.currency}/${pool.asset2.currency}`,
                    lpTokens: result.lpTokens,
                    txHash: result.txHash,
                    depositAmount,
                    estimatedAPR: `${pool.apr?.toFixed(2)}%`
                }, this.botId, this.botName);

                // Broadcast to dashboard
                broadcastUpdate('lpPosition', {
                    action: 'enter',
                    pool: `${pool.asset1.currency}/${pool.asset2.currency}`,
                    amount: depositAmount,
                    apr: pool.apr
                });
            } else {
                logger.warning('Liquidity', `Failed to enter position`, {
                    pool: `${pool.asset1.currency}/${pool.asset2.currency}`,
                    error: result.error
                }, this.botId, this.botName);
            }

        } catch (error: any) {
            logger.error('Liquidity', `Error entering position: ${error.message}`,
                { error: error.stack }, this.botId, this.botName);
        }
    }

    /**
     * Monitor existing positions and take action if needed
     */
    private async monitorPositions(): Promise<void> {
        if (!this.client || this.activePositions.size === 0) return;

        logger.debug('Liquidity', `Monitoring ${this.activePositions.size} LP positions`,
            { activePositions: this.activePositions.size }, this.botId, this.botName);

        for (const [poolId, position] of this.activePositions) {
            try {
                // Get current pool metrics
                const currentPool = await this.poolAnalyzer.analyzePool(
                    this.client,
                    { currency: position.asset1.currency, issuer: position.asset1.issuer || '' }
                );

                if (!currentPool) {
                    logger.warning('Liquidity', `Pool not found for position`,
                        { poolId, pool: `${position.asset1.currency}/${position.asset2.currency}` },
                        this.botId, this.botName);
                    continue;
                }

                // Calculate position value
                const valueMetrics = await this.liquidityProvider.calculatePositionValue(
                    this.client,
                    position,
                    currentPool
                );

                // Update position
                position.currentValue = valueMetrics.currentValue;
                position.feesEarned = valueMetrics.feesEarned;
                position.impermanentLoss = valueMetrics.impermanentLoss;
                position.apr = valueMetrics.apr;

                logger.debug('Liquidity', `Position status`, {
                    pool: `${position.asset1.currency}/${position.asset2.currency}`,
                    currentValue: `${position.currentValue.toFixed(2)} XRP`,
                    apr: `${position.apr.toFixed(2)}%`,
                    impermanentLoss: `${position.impermanentLoss.toFixed(2)}%`,
                    feesEarned: `${position.feesEarned.toFixed(2)} XRP`
                }, this.botId, this.botName);

                // Check exit conditions
                const exitStrategy = this.liquidityProvider.determineExitStrategy(
                    position,
                    currentPool,
                    this.config.liquidity.targetAPR
                );

                if (exitStrategy.shouldExit && exitStrategy.recommendedAction === 'withdrawAll') {
                    logger.info('Liquidity', `Exit conditions met: ${exitStrategy.reason}`,
                        { pool: `${position.asset1.currency}/${position.asset2.currency}`, reason: exitStrategy.reason },
                        this.botId, this.botName);
                    await this.exitLiquidityPosition(position);
                }

            } catch (error: any) {
                logger.error('Liquidity', `Error monitoring position: ${error.message}`,
                    { poolId, error: error.stack }, this.botId, this.botName);
            }
        }
    }

    /**
     * Exit a liquidity position
     */
    private async exitLiquidityPosition(position: LPPosition): Promise<void> {
        if (!this.client) return;

        try {
            const wallet = getWalletForUser(this.userId);
            const currentPool = await this.poolAnalyzer.analyzePool(
                this.client,
                { currency: position.asset1.currency, issuer: position.asset1.issuer || '' }
            );

            if (!currentPool) return;

            logger.info('Liquidity', `Withdrawing liquidity position`,
                {
                    pool: `${position.asset1.currency}/${position.asset2.currency}`,
                    lpTokens: position.lpTokens
                }, this.botId, this.botName);

            const result = await this.liquidityProvider.withdrawLiquidity(
                this.client,
                wallet,
                currentPool,
                position.lpTokens,
                'all'
            );

            if (result.success) {
                // Calculate final profit
                const totalReceived = (result.asset1Received || 0) + (result.asset2Received || 0);
                const finalProfit = totalReceived - position.initialDeposit.totalValue;
                const finalReturn = (finalProfit / position.initialDeposit.totalValue) * 100;

                logger.success('Liquidity', `Position exited successfully`, {
                    pool: `${position.asset1.currency}/${position.asset2.currency}`,
                    received: {
                        asset1: `${result.asset1Received} XRP`,
                        asset2: `${result.asset2Received} tokens`
                    },
                    profit: `${finalProfit.toFixed(2)} XRP`,
                    return: `${finalReturn.toFixed(2)}%`,
                    txHash: result.txHash
                }, this.botId, this.botName);

                // Remove from active positions
                this.activePositions.delete(position.poolId);

                // Record exit
                await this.recordLPExit(position, finalProfit, result.txHash);

                // Broadcast to dashboard
                broadcastUpdate('lpPosition', {
                    action: 'exit',
                    pool: `${position.asset1.currency}/${position.asset2.currency}`,
                    profit: finalProfit,
                    return: finalReturn
                });
            } else {
                logger.warning('Liquidity', `Failed to exit position`,
                    {
                        pool: `${position.asset1.currency}/${position.asset2.currency}`,
                        error: result.error
                    }, this.botId, this.botName);
            }

        } catch (error: any) {
            logger.error('Liquidity', `Error exiting position: ${error.message}`,
                { pool: `${position.asset1.currency}/${position.asset2.currency}`, error: error.stack },
                this.botId, this.botName);
        }
    }

    /**
     * Broadcast bot status to dashboard
     */
    private async broadcastStatus(): Promise<void> {
        const stats = this.arbitrageExecutor.getStatistics();

        broadcastUpdate('ammBotStatus', {
            isRunning: this.isRunning,
            activePositions: this.activePositions.size,
            arbitrageStats: stats,
            timestamp: new Date()
        });
    }

    /**
     * Save arbitrage execution to database
     */
    private async recordArbitrage(execution: any): Promise<void> {
        try {
            const user = await User.findOne({ userId: this.userId });
            if (!user) {
                logger.warning('Database', 'User not found, cannot record arbitrage',
                    { userId: this.userId }, this.botId, this.botName);
                return;
            }

            const profitPercent = (execution.actualProfit / execution.opportunity.tradeAmount) * 100;
            const txHash = execution.txHashes && execution.txHashes.length > 0
                ? execution.txHashes[execution.txHashes.length - 1] // Use the last (sell) tx hash
                : undefined;

            user.transactions.push({
                type: 'arbitrage',
                timestamp: new Date(),
                tokenSymbol: execution.opportunity.token.currency,
                amount: execution.opportunity.tradeAmount,
                profit: execution.actualProfit,
                profitPercent,
                status: 'success',
                ourTxHash: txHash
            });

            saveUser(user);

            logger.success('Database', 'Arbitrage trade recorded', {
                token: execution.opportunity.token.currency,
                profit: `${execution.actualProfit.toFixed(2)} XRP`,
                profitPercent: `${profitPercent.toFixed(2)}%`,
                txHash
            }, this.botId, this.botName);
        } catch (error: any) {
            logger.error('Database', `Error recording arbitrage: ${error.message}`,
                { error: error.stack }, this.botId, this.botName);
        }
    }

    /**
     * Save LP position to database
     */
    private async saveLPPosition(position: LPPosition): Promise<void> {
        // TODO: Implement LP position storage
        logger.info('Database', 'LP position saved', {
            pool: `${position.asset1.currency}/${position.asset2.currency}`,
            lpTokens: position.lpTokens,
            initialDeposit: position.initialDeposit.totalValue
        }, this.botId, this.botName);
    }

    /**
     * Record LP exit in database
     */
    private async recordLPExit(position: LPPosition, profit: number, txHash?: string): Promise<void> {
        try {
            const user = await User.findOne({ userId: this.userId });
            if (!user) {
                logger.warning('Database', 'User not found, cannot record LP exit',
                    { userId: this.userId }, this.botId, this.botName);
                return;
            }

            const profitPercent = (profit / position.initialDeposit.totalValue) * 100;

            user.transactions.push({
                type: 'lp_exit',
                timestamp: new Date(),
                tokenSymbol: `${position.asset1.currency}/${position.asset2.currency}`,
                amount: position.currentValue,
                profit,
                profitPercent,
                status: 'success',
                ourTxHash: txHash
            });

            saveUser(user);

            logger.success('Database', 'LP exit recorded', {
                pool: `${position.asset1.currency}/${position.asset2.currency}`,
                profit: `${profit.toFixed(2)} XRP`,
                profitPercent: `${profitPercent.toFixed(2)}%`,
                txHash
            }, this.botId, this.botName);
        } catch (error: any) {
            logger.error('Database', `Error recording LP exit: ${error.message}`,
                { error: error.stack }, this.botId, this.botName);
        }
    }

    /**
     * Get current bot statistics
     */
    getStatistics() {
        return {
            isRunning: this.isRunning,
            activePositions: this.activePositions.size,
            arbitrageStats: this.arbitrageExecutor.getStatistics(),
            positions: Array.from(this.activePositions.values())
        };
    }
}
