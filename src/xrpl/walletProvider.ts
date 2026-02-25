import * as fs from 'fs';
import * as path from 'path';
import { Wallet } from 'xrpl';
import config from '../config';

const SEEDS_FILE = path.join(process.cwd(), 'data', 'llm-wallet-seeds.json');

export interface WalletOption {
    userId: string;
    walletAddress: string;
    label: string;
}

interface SeedStore {
    seedsByUserId: Record<string, string>;
}

function loadSeedStore(): SeedStore {
    try {
        if (!fs.existsSync(SEEDS_FILE)) {
            return { seedsByUserId: {} };
        }
        const parsed = JSON.parse(fs.readFileSync(SEEDS_FILE, 'utf-8')) as SeedStore;
        return {
            seedsByUserId: parsed?.seedsByUserId || {}
        };
    } catch {
        return { seedsByUserId: {} };
    }
}

function saveSeedStore(store: SeedStore): void {
    const dir = path.dirname(SEEDS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SEEDS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function setWalletSeedForUser(userId: string, seed: string): { userId: string; walletAddress: string } {
    const wallet = Wallet.fromSeed(seed);
    const store = loadSeedStore();
    store.seedsByUserId[userId] = seed;
    saveSeedStore(store);
    return { userId, walletAddress: wallet.address };
}

export function getWalletForUser(userId: string): Wallet {
    const fileMap = loadSeedStore().seedsByUserId;
    const seed = fileMap[userId] || config.wallet.seed;

    if (!seed) {
        throw new Error(`No wallet seed configured for user ${userId}`);
    }

    return Wallet.fromSeed(seed);
}

export function getWalletAddressForUser(userId: string): string {
    return getWalletForUser(userId).address;
}

/**
 * Generate a new XRPL wallet. Caller must store the seed securely and bind it to a user/agent.
 * The seed is returned only once; do not log or persist it beyond the intended binding.
 */
export function generateNewWallet(): { address: string; publicKey: string; seed: string } {
    const wallet = Wallet.generate();
    return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        seed: wallet.seed!
    };
}

/**
 * List wallet options for dropdowns: known wallets from seed store plus default wallet.
 * Does not expose seeds.
 */
export function listWalletOptions(): WalletOption[] {
    const store = loadSeedStore();
    const options: WalletOption[] = [];
    const seen = new Set<string>();

    for (const [uid, seed] of Object.entries(store.seedsByUserId)) {
        if (!seed) continue;
        try {
            const w = Wallet.fromSeed(seed);
            if (seen.has(w.address)) continue;
            seen.add(w.address);
            options.push({
                userId: uid,
                walletAddress: w.address,
                label: uid === 'default' ? 'Default wallet' : uid
            });
        } catch {
            // skip invalid entries
        }
    }

    if (config.wallet.seed) {
        try {
            const defaultWallet = Wallet.fromSeed(config.wallet.seed);
            if (!seen.has(defaultWallet.address)) {
                options.push({
                    userId: 'default',
                    walletAddress: defaultWallet.address,
                    label: 'Default wallet'
                });
            }
        } catch {
            // ignore
        }
    }

    return options;
}

/**
 * Find seed for a wallet address from the seed store (or default config).
 * Used when assigning an existing wallet to an agent; does not expose seed to caller.
 */
export function getSeedForAddress(walletAddress: string): string | null {
    const store = loadSeedStore();
    const normalized = walletAddress.trim();

    for (const seed of Object.values(store.seedsByUserId)) {
        if (!seed) continue;
        try {
            if (Wallet.fromSeed(seed).address === normalized) return seed;
        } catch {
            // skip
        }
    }

    if (config.wallet.seed) {
        try {
            if (Wallet.fromSeed(config.wallet.seed).address === normalized) return config.wallet.seed;
        } catch {
            // ignore
        }
    }

    return null;
}
