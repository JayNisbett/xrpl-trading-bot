import { BotConfiguration } from './database/botConfigs';
import { getClient } from './xrpl/client';
import { getWalletForUser } from './xrpl/walletProvider';
import * as sniper from './sniper';
import * as copyTrading from './copyTrading';
import { User } from './database/user';
import { AMMBot } from './amm/ammBot';
import config from './config';
import { logger } from './utils/logger';
import { setAMMBotInstance } from './api/server';
import { addRunningConfig, removeRunningConfig } from './database/instanceRestore';

export interface BotInstance {
    id: string;
    configId: string;
    config: BotConfiguration;
    userId: string;
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
    startedAt?: Date;
    error?: string;
    ammBot?: AMMBot;
}

class BotInstanceManager {
    private instances: Map<string, BotInstance> = new Map();
    private sniperRunning: Set<string> = new Set();
    private copyTradingRunning: Set<string> = new Set();

    async startBot(botConfig: BotConfiguration, userId: string): Promise<{ success: boolean; instanceId?: string; error?: string }> {
        const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            logger.info('BotManager', `Attempting to start bot: ${botConfig.name}`, 
                { configId: botConfig.id, mode: botConfig.mode }, instanceId, botConfig.name);
            
            // Check if bot with this config is already running
            const existing = Array.from(this.instances.values()).find(
                inst => inst.configId === botConfig.id && inst.status === 'running'
            );
            
            if (existing) {
                logger.warning('BotManager', `Config "${botConfig.name}" already has a running instance`,
                    { existingInstanceId: existing.id }, instanceId, botConfig.name);
                return { success: false, error: 'Bot with this configuration is already running' };
            }
            
            const instance: BotInstance = {
                id: instanceId,
                configId: botConfig.id,
                config: botConfig,
                userId,
                status: 'starting',
                startedAt: new Date()
            };
            
            this.instances.set(instanceId, instance);
            logger.info('BotManager', `Created instance ${instanceId}`, 
                { totalInstances: this.instances.size }, instanceId, botConfig.name);

            const startupFailures: string[] = [];

            // Initialize user if not exists
            let user = await User.findOne({ userId });
            if (!user) {
                logger.info('User', `Creating new user: ${userId}`, null, instanceId, botConfig.name);
                const wallet = getWalletForUser(userId);
                user = await User.create({
                    userId,
                    walletAddress: wallet.address,
                    seed: config.wallet.seed,
                    publicKey: wallet.publicKey,
                    privateKey: wallet.privateKey
                });
            } else {
                logger.debug('User', `Using existing user: ${userId}`, 
                    { walletAddress: user.walletAddress }, instanceId, botConfig.name);
            }

            // Start sniper if enabled (with per-bot config overlay)
            if (botConfig.sniper.enabled && (botConfig.mode === 'sniper' || botConfig.mode === 'hybrid')) {
                if (!this.sniperRunning.has(userId)) {
                    logger.info('Sniper', `Starting sniper module...`, 
                        { interval: botConfig.sniper.checkInterval, riskScore: botConfig.sniper.riskScore }, 
                        instanceId, botConfig.name);
                    
                    const sniperResult = await sniper.startSniper(userId, {
                        overlay: { sniper: botConfig.sniper, trading: botConfig.trading }
                    });
                    if (sniperResult.success) {
                        this.sniperRunning.add(userId);
                        logger.success('Sniper', `Sniper module started successfully`, null, instanceId, botConfig.name);
                    } else {
                        logger.error('Sniper', `Failed to start sniper module`, 
                            { error: sniperResult.error }, instanceId, botConfig.name);
                        startupFailures.push(`sniper: ${sniperResult.error || 'start failed'}`);
                    }
                } else {
                    logger.info('Sniper', `Sniper already running for user, sharing instance`, null, instanceId, botConfig.name);
                }
            }

            // Start copy trading if enabled (with per-bot config overlay)
            if (botConfig.copyTrading.enabled && (botConfig.mode === 'copyTrading' || botConfig.mode === 'hybrid')) {
                if (!this.copyTradingRunning.has(userId) && botConfig.copyTrading.traderAddresses.length > 0) {
                    logger.info('CopyTrading', `Starting copy trading module...`, 
                        { traders: botConfig.copyTrading.traderAddresses.length }, 
                        instanceId, botConfig.name);
                    
                    const copyResult = await copyTrading.startCopyTrading(userId, {
                        overlay: { copyTrading: botConfig.copyTrading, trading: botConfig.trading }
                    });
                    if (copyResult.success) {
                        this.copyTradingRunning.add(userId);
                        logger.success('CopyTrading', `Copy trading module started successfully`, 
                            { traders: botConfig.copyTrading.traderAddresses }, instanceId, botConfig.name);
                    } else {
                        logger.error('CopyTrading', `Failed to start copy trading`, 
                            { error: copyResult.error }, instanceId, botConfig.name);
                        startupFailures.push(`copyTrading: ${copyResult.error || 'start failed'}`);
                    }
                } else if (botConfig.copyTrading.traderAddresses.length === 0) {
                    logger.warning('CopyTrading', `No trader addresses configured`, null, instanceId, botConfig.name);
                    startupFailures.push('copyTrading: no trader addresses configured');
                } else {
                    logger.info('CopyTrading', `Copy trading already running for user, sharing instance`, 
                        null, instanceId, botConfig.name);
                }
            }

            // Start AMM bot if enabled
            if (botConfig.amm.enabled && (botConfig.mode === 'amm' || botConfig.mode === 'hybrid')) {
                logger.info('AMM', `Starting AMM bot module...`, 
                    { 
                        arbitrage: botConfig.amm.arbitrage.enabled,
                        liquidity: botConfig.amm.liquidity.enabled,
                        strategy: botConfig.amm.liquidity.strategy
                    }, instanceId, botConfig.name);
                
                const ammConfig = {
                    strategies: {
                        arbitrage: botConfig.amm.arbitrage.enabled,
                        liquidityProvision: botConfig.amm.liquidity.enabled,
                        yieldFarming: botConfig.amm.liquidity.enabled
                    },
                    arbitrage: botConfig.amm.arbitrage,
                    liquidity: botConfig.amm.liquidity,
                    risk: botConfig.amm.risk
                };

                try {
                    const ammBot = new AMMBot(userId, ammConfig, instanceId, botConfig.name);
                    const client = await getClient();
                    await ammBot.start(client);
                    
                    instance.ammBot = ammBot;
                    setAMMBotInstance(ammBot);
                    logger.success('AMM', `AMM bot module started successfully`, null, instanceId, botConfig.name);
                } catch (ammError: any) {
                    logger.error('AMM', `Failed to start AMM module`,
                        { error: ammError?.message || 'unknown' }, instanceId, botConfig.name);
                    startupFailures.push(`amm: ${ammError?.message || 'start failed'}`);
                }
            }

            const startedAnyModule =
                !!instance.ammBot ||
                this.sniperRunning.has(userId) ||
                this.copyTradingRunning.has(userId);

            if (!startedAnyModule) {
                instance.status = 'error';
                instance.error = startupFailures.join('; ') || 'No modules started';
                this.instances.set(instanceId, instance);
                logger.error('BotManager', 'Bot instance failed to start any modules',
                    { failures: startupFailures }, instanceId, botConfig.name);
                return { success: false, error: instance.error };
            }

            instance.status = 'running';
            if (startupFailures.length > 0) {
                instance.error = `degraded: ${startupFailures.join('; ')}`;
                logger.warning('BotManager', 'Bot instance started in degraded mode',
                    { failures: startupFailures }, instanceId, botConfig.name);
            }
            this.instances.set(instanceId, instance);
            addRunningConfig(userId, botConfig.id);

            const runningCount = Array.from(this.instances.values()).filter(i => i.status === 'running').length;
            logger.success('BotManager', `Bot instance started successfully`, 
                { instanceId, totalInstances: this.instances.size, runningInstances: runningCount }, 
                instanceId, botConfig.name);
            
            return { success: true, instanceId, error: startupFailures.length > 0 ? instance.error : undefined };
        } catch (error: any) {
            logger.error('BotManager', `Failed to start bot: ${error.message}`, 
                { error: error.stack, configId: botConfig.id }, instanceId, botConfig.name);
            
            const instance = this.instances.get(instanceId);
            if (instance) {
                instance.status = 'error';
                instance.error = error.message;
                this.instances.set(instanceId, instance);
            }
            
            return { success: false, error: error.message };
        }
    }

    async stopBot(instanceId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const instance = this.instances.get(instanceId);
            if (!instance) {
                logger.warning('BotManager', `Attempted to stop non-existent instance: ${instanceId}`, null);
                return { success: false, error: 'Bot instance not found' };
            }

            logger.info('BotManager', `Stopping bot instance...`, null, instanceId, instance.config.name);
            instance.status = 'stopping';
            this.instances.set(instanceId, instance);

            // Stop AMM bot and update API's primary AMM reference
            if (instance.ammBot) {
                logger.info('AMM', `Stopping AMM module...`, null, instanceId, instance.config.name);
                await instance.ammBot.stop();
                instance.ammBot = undefined;
                const otherWithAmm = Array.from(this.instances.values()).find(
                    i => i.id !== instanceId && i.status === 'running' && i.ammBot
                );
                setAMMBotInstance(otherWithAmm?.ammBot ?? null);
                logger.success('AMM', `AMM module stopped`, null, instanceId, instance.config.name);
            }

            // Only stop sniper/copy trading if no other instances need them
            const otherRunningInstances = Array.from(this.instances.values()).filter(
                inst => inst.id !== instanceId && inst.status === 'running'
            );

            const needsSniper = otherRunningInstances.some(
                inst => inst.config.sniper.enabled && (inst.config.mode === 'sniper' || inst.config.mode === 'hybrid')
            );
            
            if (!needsSniper && this.sniperRunning.has(instance.userId)) {
                logger.info('Sniper', `No other instances need sniper, stopping module...`, 
                    null, instanceId, instance.config.name);
                await sniper.stopSniper(instance.userId);
                this.sniperRunning.delete(instance.userId);
                logger.success('Sniper', `Sniper module stopped`, null, instanceId, instance.config.name);
            } else if (needsSniper) {
                logger.info('Sniper', `Keeping sniper running (other instances need it)`, 
                    null, instanceId, instance.config.name);
            }

            const needsCopyTrading = otherRunningInstances.some(
                inst => inst.config.copyTrading.enabled && (inst.config.mode === 'copyTrading' || inst.config.mode === 'hybrid')
            );
            
            if (!needsCopyTrading && this.copyTradingRunning.has(instance.userId)) {
                logger.info('CopyTrading', `No other instances need copy trading, stopping module...`, 
                    null, instanceId, instance.config.name);
                await copyTrading.stopCopyTrading(instance.userId);
                this.copyTradingRunning.delete(instance.userId);
                logger.success('CopyTrading', `Copy trading module stopped`, null, instanceId, instance.config.name);
            } else if (needsCopyTrading) {
                logger.info('CopyTrading', `Keeping copy trading running (other instances need it)`, 
                    null, instanceId, instance.config.name);
            }

            instance.status = 'stopped';
            this.instances.set(instanceId, instance);
            removeRunningConfig(instance.userId, instance.configId);

            const runningCount = Array.from(this.instances.values()).filter(i => i.status === 'running').length;
            logger.success('BotManager', `Bot instance stopped successfully`, 
                { totalInstances: this.instances.size, runningInstances: runningCount }, 
                instanceId, instance.config.name);
            
            return { success: true };
        } catch (error: any) {
            logger.error('BotManager', `Failed to stop bot instance: ${error.message}`, 
                { error: error.stack, instanceId }, instanceId);
            return { success: false, error: error.message };
        }
    }

    async stopAllBots(): Promise<void> {
        console.log('\n🛑 Stopping all bot instances...');
        
        const stopPromises = Array.from(this.instances.keys()).map(id => this.stopBot(id));
        await Promise.all(stopPromises);
        
        console.log('✅ All bots stopped\n');
    }

    getRunningInstances(): any[] {
        // Return instances without circular references (ammBot)
        const instances = Array.from(this.instances.values()).map(inst => ({
            id: inst.id,
            configId: inst.configId,
            name: inst.config.name,
            mode: inst.config.mode,
            config: {
                id: inst.config.id,
                name: inst.config.name,
                description: inst.config.description,
                mode: inst.config.mode,
                enabled: inst.config.enabled
            },
            userId: inst.userId,
            status: inst.status,
            startedAt: inst.startedAt,
            error: inst.error
        }));
        return instances;
    }

    getInstance(instanceId: string): BotInstance | null {
        return this.instances.get(instanceId) || null;
    }

    getInstancesByConfigId(configId: string): BotInstance[] {
        return Array.from(this.instances.values()).filter(inst => inst.configId === configId);
    }

    getInstancesByUserId(userId: string): BotInstance[] {
        return Array.from(this.instances.values()).filter(inst => inst.userId === userId);
    }

    async restartBot(instanceId: string): Promise<{ success: boolean; error?: string }> {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return { success: false, error: 'Bot instance not found' };
        }

        const stopResult = await this.stopBot(instanceId);
        if (!stopResult.success) {
            return stopResult;
        }

        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));

        return await this.startBot(instance.config, instance.userId);
    }

    getStats() {
        const instances = Array.from(this.instances.values());
        return {
            total: instances.length,
            running: instances.filter(i => i.status === 'running').length,
            stopped: instances.filter(i => i.status === 'stopped').length,
            error: instances.filter(i => i.status === 'error').length,
            instances: instances.map(i => ({
                id: i.id,
                configId: i.configId,
                name: i.config.name,
                status: i.status,
                mode: i.config.mode,
                startedAt: i.startedAt,
                error: i.error
            }))
        };
    }
}

export const botManager = new BotInstanceManager();
