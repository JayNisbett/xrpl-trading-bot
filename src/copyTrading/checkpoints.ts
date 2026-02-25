import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINTS_FILE = path.join(process.cwd(), 'data', 'copy-checkpoints.json');

export interface CopyCheckpointsState {
    checkpoints: Record<string, number>;
    updatedAt: string;
}

function ensureDataDir(): void {
    const dir = path.dirname(CHECKPOINTS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadFromDisk(): CopyCheckpointsState {
    try {
        if (!fs.existsSync(CHECKPOINTS_FILE)) {
            return { checkpoints: {}, updatedAt: new Date().toISOString() };
        }
        const data = fs.readFileSync(CHECKPOINTS_FILE, 'utf-8');
        const parsed = JSON.parse(data) as CopyCheckpointsState;
        return {
            checkpoints: typeof parsed.checkpoints === 'object' && parsed.checkpoints !== null ? parsed.checkpoints : {},
            updatedAt: parsed.updatedAt || new Date().toISOString()
        };
    } catch {
        return { checkpoints: {}, updatedAt: new Date().toISOString() };
    }
}

function saveToDisk(state: CopyCheckpointsState): void {
    try {
        ensureDataDir();
        const payload: CopyCheckpointsState = {
            ...state,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving copy-trading checkpoints:', error);
    }
}

let cache: CopyCheckpointsState | null = null;

function getState(): CopyCheckpointsState {
    if (cache === null) {
        cache = loadFromDisk();
    }
    return cache;
}

/**
 * Get the last checkpoint ledger index for a userId:trader key.
 */
export function getCheckpoint(key: string): number {
    const state = getState();
    const value = state.checkpoints[key];
    return typeof value === 'number' ? value : -1;
}

/**
 * Set the checkpoint for a key and persist to disk.
 */
export function setCheckpoint(key: string, ledgerIndex: number): void {
    const state = getState();
    if (ledgerIndex <= (state.checkpoints[key] ?? -1)) {
        return;
    }
    state.checkpoints[key] = ledgerIndex;
    saveToDisk(state);
}

/**
 * Load checkpoints from disk (e.g. on startup). Clears in-memory cache and reloads.
 */
export function loadCheckpoints(): void {
    cache = loadFromDisk();
}
