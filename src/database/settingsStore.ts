import * as fs from 'fs';
import * as path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

export interface AppSettings {
    primaryWallet?: string;
    autoProfitCollection: boolean;
    profitCollectionThreshold: number;
    notifications: {
        snipes: boolean;
        profitTargets: boolean;
        stopLosses: boolean;
        errors: boolean;
    };
    trading: {
        defaultMinLiquidity: number;
        defaultSnipeAmount: number;
        defaultProfitTarget: number;
        defaultStopLoss: number;
        maxPositionsPerBot: number;
    };
}

const defaultSettings: AppSettings = {
    autoProfitCollection: false,
    profitCollectionThreshold: 10,
    notifications: {
        snipes: true,
        profitTargets: true,
        stopLosses: true,
        errors: true
    },
    trading: {
        defaultMinLiquidity: 10,
        defaultSnipeAmount: 2,
        defaultProfitTarget: 12,
        defaultStopLoss: 8,
        maxPositionsPerBot: 12
    }
};

function ensureDataDir(): void {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function loadSettings(): AppSettings {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return { ...defaultSettings };
        }
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(data) as Partial<AppSettings>;
        return {
            ...defaultSettings,
            ...parsed,
            notifications: { ...defaultSettings.notifications, ...parsed.notifications },
            trading: { ...defaultSettings.trading, ...parsed.trading }
        };
    } catch {
        return { ...defaultSettings };
    }
}

export function saveSettings(settings: AppSettings): void {
    try {
        ensureDataDir();
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}
