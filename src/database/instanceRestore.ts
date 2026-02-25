import * as fs from 'fs';
import * as path from 'path';

const RESTORE_FILE = path.join(process.cwd(), 'data', 'instance-restore.json');

export interface InstanceRestoreState {
    /** userId -> list of configIds that were running (for restore on boot) */
    runningByUserId: Record<string, string[]>;
    updatedAt: string;
}

function ensureDataDir(): void {
    const dir = path.dirname(RESTORE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function load(): InstanceRestoreState {
    try {
        if (!fs.existsSync(RESTORE_FILE)) {
            return { runningByUserId: {}, updatedAt: new Date().toISOString() };
        }
        const data = fs.readFileSync(RESTORE_FILE, 'utf-8');
        const parsed = JSON.parse(data) as InstanceRestoreState;
        return {
            runningByUserId: typeof parsed.runningByUserId === 'object' && parsed.runningByUserId !== null ? parsed.runningByUserId : {},
            updatedAt: parsed.updatedAt || new Date().toISOString()
        };
    } catch {
        return { runningByUserId: {}, updatedAt: new Date().toISOString() };
    }
}

function save(state: InstanceRestoreState): void {
    try {
        ensureDataDir();
        state.updatedAt = new Date().toISOString();
        fs.writeFileSync(RESTORE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving instance-restore state:', error);
    }
}

/**
 * Record that a config is now running for this user (call when instance reaches running).
 */
export function addRunningConfig(userId: string, configId: string): void {
    const state = load();
    const list = state.runningByUserId[userId] || [];
    if (!list.includes(configId)) {
        state.runningByUserId[userId] = [...list, configId];
        save(state);
    }
}

/**
 * Remove a config from the running set for this user (call when instance stops).
 */
export function removeRunningConfig(userId: string, configId: string): void {
    const state = load();
    const list = state.runningByUserId[userId];
    if (!list) return;
    const next = list.filter(id => id !== configId);
    if (next.length === 0) {
        delete state.runningByUserId[userId];
    } else {
        state.runningByUserId[userId] = next;
    }
    save(state);
}

/**
 * Get all userId -> configIds that were running (for restore on boot).
 */
export function getRunningConfigsByUserId(): Record<string, string[]> {
    return { ...load().runningByUserId };
}
