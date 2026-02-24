import * as db from './database/db';
import { getClient, disconnect as disconnectXRPL } from './xrpl/client';
import { getWallet } from './xrpl/wallet';
import { User } from './database/user';
import { BotOptions, BotStatus } from './types';
import config from './config';
import { startAPIServer, stopAPIServer } from './api/server';
import * as BotConfigs from './database/botConfigs';
import { botManager } from './botManager';
import * as sniper from './sniper';
import * as copyTrading from './copyTrading';
import open from 'open';

class XRPLTradingBot {
    private userId: string;
    private mode: 'sniper' | 'copyTrading' | 'both';
    private isRunning: boolean = false;

    constructor(options: BotOptions = {}) {
        this.userId = options.userId || 'default';
        this.mode = options.mode || 'both';
    }

    async initializeUser(): Promise<void> {
        let user = await User.findOne({ userId: this.userId });

        if (!user) {
            const wallet = getWallet();

            if (config.wallet.address && config.wallet.address !== wallet.address) {
                throw new Error('WALLET_ADDRESS in .env does not match the wallet derived from WALLET_SEED');
            }

            user = await User.create({
                userId: this.userId,
                walletAddress: wallet.address,
                seed: config.wallet.seed,
                publicKey: wallet.publicKey,
                privateKey: wallet.privateKey
            });

            console.log(`User initialized: ${this.userId} (${wallet.address})`);
        }
    }

    async start(): Promise<void> {
        try {
            console.log('Initializing bot...');

            await db.connect();
            await this.initializeUser();

            console.log('Connecting to XRPL network...');
            await getClient();

            console.log('Connected to XRPL network successfully');

            BotConfigs.loadConfigs();
            console.log('Bot configuration system initialized');

            const defaultConfig = BotConfigs.getOrCreateDefaultConfig(config, this.mode);
            const result = await botManager.startBot(defaultConfig, this.userId);

            if (!result.success) {
                throw new Error(result.error || 'Failed to start bot');
            }

            this.isRunning = true;
            console.log('Bot started successfully (single source of truth: botManager)');

            startAPIServer(3000, this.userId);

            setTimeout(async () => {
                try {
                    await open('http://localhost:3001');
                    console.log('📊 Dashboard opened in browser');
                } catch {
                    console.log('📊 Dashboard available at http://localhost:3001');
                }
            }, 2000);

            process.on('SIGINT', () => this.stop());
            process.on('SIGTERM', () => this.stop());
        } catch (error) {
            console.error('Error starting bot:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            console.log('\n🛑 Stopping XRPL Trading Bot...');

            await botManager.stopAllBots();

            stopAPIServer();
            await disconnectXRPL();
            await db.disconnect();

            this.isRunning = false;
            console.log('✅ Bot stopped successfully\n');
        } catch (error) {
            console.error('Error stopping bot:', error);
            throw error;
        }
    }

    getStatus(): BotStatus {
        return {
            isRunning: this.isRunning,
            mode: this.mode,
            userId: this.userId,
            sniper: sniper.isRunningSniper(),
            copyTrading: copyTrading.isRunningCopyTrading()
        };
    }
}

export default XRPLTradingBot;
