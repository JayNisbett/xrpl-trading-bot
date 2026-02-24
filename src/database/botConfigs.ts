import * as fs from 'fs';
import * as path from 'path';

export interface BotConfiguration {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Bot Mode
    mode: 'sniper' | 'copyTrading' | 'amm' | 'hybrid';

    // Sniper Settings
    sniper: {
        enabled: boolean;
        checkInterval: number;
        maxTokensPerScan: number;
        buyMode: boolean;
        snipeAmount: string;
        customSnipeAmount: string;
        minimumPoolLiquidity: number;
        riskScore: 'low' | 'medium' | 'high';
        transactionDivides: number;
    };

    // Copy Trading Settings
    copyTrading: {
        enabled: boolean;
        checkInterval: number;
        maxTransactionsToCheck: number;
        traderAddresses: string[];
        tradingAmountMode: 'fixed' | 'percentage';
        matchTraderPercentage: number;
        maxSpendPerTrade: number;
        fixedAmount: number;
    };

    // Trading Settings
    trading: {
        minLiquidity: number;
        minHolders: number;
        minTradingActivity: number;
        maxSnipeAmount: number;
        emergencyStopLoss: number;
        defaultSlippage: number;
    };

    // AMM Settings
    amm: {
        enabled: boolean;
        arbitrage: {
            enabled: boolean;
            minProfitPercent: number;
            maxTradeAmount: number;
            checkInterval: number;
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
            maxImpermanentLoss: number;
            maxPositionSize: number;
            diversification: boolean;
        };
    };
}

const CONFIGS_DIR = path.join(process.cwd(), 'data', 'bot-configs');
const LEGACY_CONFIGS_FILE = path.join(process.cwd(), 'data', 'bot-configs.json');

let configs: Map<string, BotConfiguration> = new Map();

function configFileName(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${safe}.json`;
}

function configFilePath(id: string): string {
    return path.join(CONFIGS_DIR, configFileName(id));
}

function ensureConfigsDir(): void {
    if (!fs.existsSync(CONFIGS_DIR)) {
        fs.mkdirSync(CONFIGS_DIR, { recursive: true });
    }
}

function parseConfig(c: any): BotConfiguration {
    return {
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
    };
}

function serializeConfig(c: BotConfiguration): string {
    return JSON.stringify({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString()
    }, null, 2);
}

/** Migrate from legacy single-file format into folder (one JSON per config). */
function migrateFromLegacy(): void {
    if (!fs.existsSync(LEGACY_CONFIGS_FILE)) return;
    try {
        const data = fs.readFileSync(LEGACY_CONFIGS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed.configs)) return;
        ensureConfigsDir();
        for (const c of parsed.configs) {
            const config = parseConfig(c);
            if (config.id) {
                configs.set(config.id, config);
                fs.writeFileSync(configFilePath(config.id), serializeConfig(config), 'utf-8');
            }
        }
        console.log(`Migrated ${parsed.configs.length} bot config(s) to ${CONFIGS_DIR}`);
    } catch (e) {
        console.error('Migration from legacy bot-configs.json failed:', e);
    }
}

export function loadConfigs(): void {
    try {
        ensureConfigsDir();
        configs = new Map();

        migrateFromLegacy();

        const files = fs.readdirSync(CONFIGS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const fullPath = path.join(CONFIGS_DIR, file);
                const data = fs.readFileSync(fullPath, 'utf-8');
                const c = parseConfig(JSON.parse(data));
                if (c.id) configs.set(c.id, c);
            } catch (e) {
                console.error(`Error loading config file ${file}:`, e);
            }
        }
    } catch (error) {
        console.error('Error loading bot configs:', error);
        configs = new Map();
    }
}

function saveConfig(config: BotConfiguration): void {
    try {
        ensureConfigsDir();
        fs.writeFileSync(configFilePath(config.id), serializeConfig(config), 'utf-8');
    } catch (error) {
        console.error('Error saving bot config:', error);
    }
}

/** @deprecated Use saveConfig for single config; kept for compatibility. */
export function saveConfigs(): void {
    for (const c of configs.values()) {
        saveConfig(c);
    }
}

export function getAllConfigs(): BotConfiguration[] {
    return Array.from(configs.values());
}

export function getConfig(id: string): BotConfiguration | null {
    return configs.get(id) || null;
}

export function createConfig(config: Omit<BotConfiguration, 'id' | 'createdAt' | 'updatedAt'>): BotConfiguration {
    const id = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const newConfig: BotConfiguration = {
        ...config,
        id,
        createdAt: now,
        updatedAt: now
    };

    configs.set(id, newConfig);
    saveConfig(newConfig);

    return newConfig;
}

export function updateConfig(id: string, updates: Partial<Omit<BotConfiguration, 'id' | 'createdAt'>>): BotConfiguration | null {
    const config = configs.get(id);
    if (!config) return null;

    const updatedConfig: BotConfiguration = {
        ...config,
        ...updates,
        id: config.id,
        createdAt: config.createdAt,
        updatedAt: new Date()
    };

    configs.set(id, updatedConfig);
    saveConfig(updatedConfig);

    return updatedConfig;
}

export function deleteConfig(id: string): boolean {
    const config = configs.get(id);
    if (!config) return false;
    configs.delete(id);
    try {
        const fp = configFilePath(id);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
        console.error('Error deleting config file:', e);
    }
    return true;
}

export function createDefaultConfig(name: string): BotConfiguration {
    return {
        id: '',
        name,
        description: '',
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        mode: 'hybrid',
        sniper: {
            enabled: false,
            checkInterval: 8000,
            maxTokensPerScan: 15,
            buyMode: false,
            snipeAmount: '1',
            customSnipeAmount: '',
            minimumPoolLiquidity: 100,
            riskScore: 'medium',
            transactionDivides: 1
        },
        copyTrading: {
            enabled: false,
            checkInterval: 3000,
            maxTransactionsToCheck: 20,
            traderAddresses: [],
            tradingAmountMode: 'percentage',
            matchTraderPercentage: 50,
            maxSpendPerTrade: 100,
            fixedAmount: 10
        },
        trading: {
            minLiquidity: 100,
            minHolders: 5,
            minTradingActivity: 3,
            maxSnipeAmount: 5000,
            emergencyStopLoss: 0.3,
            defaultSlippage: 4.0
        },
        amm: {
            enabled: false,
            arbitrage: {
                enabled: false,
                minProfitPercent: 0.5,
                maxTradeAmount: 5,
                checkInterval: 5000
            },
            liquidity: {
                enabled: false,
                strategy: 'one-sided',
                minTVL: 100,
                maxPriceImpact: 0.05,
                targetAPR: 20,
                maxPositions: 5
            },
            risk: {
                maxImpermanentLoss: 10,
                maxPositionSize: 3,
                diversification: true
            }
        }
    };
}

export function createConfigFromEnv(envConfig: any): BotConfiguration {
    return {
        id: '',
        name: 'Default Configuration (from .env)',
        description: 'Auto-generated from your .env settings',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        mode: 'hybrid',
        sniper: {
            enabled: envConfig.sniperUser?.buyMode ?? false,
            checkInterval: envConfig.sniper?.checkInterval ?? 8000,
            maxTokensPerScan: envConfig.sniper?.maxTokensPerScan ?? 15,
            buyMode: envConfig.sniperUser?.buyMode ?? false,
            snipeAmount: envConfig.sniperUser?.snipeAmount ?? '1',
            customSnipeAmount: envConfig.sniperUser?.customSnipeAmount ?? '',
            minimumPoolLiquidity: envConfig.sniperUser?.minimumPoolLiquidity ?? 100,
            riskScore: (envConfig.sniperUser?.riskScore as 'low' | 'medium' | 'high') ?? 'medium',
            transactionDivides: envConfig.sniperUser?.transactionDivides ?? 1
        },
        copyTrading: {
            enabled: (envConfig.copyTrading?.traderAddresses?.length ?? 0) > 0,
            checkInterval: envConfig.copyTrading?.checkInterval ?? 3000,
            maxTransactionsToCheck: envConfig.copyTrading?.maxTransactionsToCheck ?? 20,
            traderAddresses: envConfig.copyTrading?.traderAddresses ?? [],
            tradingAmountMode: (envConfig.copyTrading?.tradingAmountMode as 'fixed' | 'percentage') ?? 'percentage',
            matchTraderPercentage: envConfig.copyTrading?.matchTraderPercentage ?? 50,
            maxSpendPerTrade: envConfig.copyTrading?.maxSpendPerTrade ?? 100,
            fixedAmount: envConfig.copyTrading?.fixedAmount ?? 10
        },
        trading: envConfig.trading ?? {
            minLiquidity: 100,
            minHolders: 5,
            minTradingActivity: 3,
            maxSnipeAmount: 5000,
            emergencyStopLoss: 0.3,
            defaultSlippage: 4.0
        },
        amm: envConfig.amm ?? {
            enabled: false,
            arbitrage: { enabled: false, minProfitPercent: 0.5, maxTradeAmount: 5, checkInterval: 5000 },
            liquidity: { enabled: false, strategy: 'one-sided', minTVL: 100, maxPriceImpact: 0.05, targetAPR: 20, maxPositions: 5 },
            risk: { maxImpermanentLoss: 10, maxPositionSize: 3, diversification: true }
        }
    };
}

/** CLI mode: which modules to enable for the default config. */
export type CliMode = 'sniper' | 'copyTrading' | 'both';

/** Get or create the default CLI config (id 'default'), persisted in bot-configs folder. */
export function getOrCreateDefaultConfig(envConfig: any, mode?: CliMode): BotConfiguration {
    let existing = getConfig('default');
    if (existing) {
        if (mode !== undefined) {
            existing = applyModeToConfig(existing, mode);
            configs.set('default', existing);
            saveConfig(existing);
        }
        return existing;
    }

    const fromEnv = createConfigFromEnv(envConfig);
    const withId: BotConfiguration = { ...fromEnv, id: 'default', createdAt: fromEnv.createdAt, updatedAt: fromEnv.updatedAt };
    const withMode = mode !== undefined ? applyModeToConfig(withId, mode) : withId;
    configs.set('default', withMode);
    saveConfig(withMode);
    return withMode;
}

function applyModeToConfig(c: BotConfiguration, mode: CliMode): BotConfiguration {
    const configMode: BotConfiguration['mode'] = mode === 'both' ? 'hybrid' : mode;
    return {
        ...c,
        mode: configMode,
        sniper: { ...c.sniper, enabled: mode === 'sniper' || mode === 'both' },
        copyTrading: { ...c.copyTrading, enabled: mode === 'copyTrading' || mode === 'both' },
        amm: { ...c.amm, enabled: c.amm.enabled }
    };
}

// Initialize on import
loadConfigs();
