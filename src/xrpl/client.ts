import { Client } from 'xrpl';
import config from '../config';

let persistentClient: Client | null = null;
let connectingPromise: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let lastReconnectAttemptAt = 0;
let shuttingDown = false;

const MIN_RECONNECT_INTERVAL_MS = 5000; // Min time between reconnect attempts to avoid thrashing

function getServerCandidates(): string[] {
    const primary = config.xrpl.server;
    const fallbacks = (process.env.XRPL_SERVER_FALLBACKS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    const defaults = [
        'wss://xrplcluster.com',
        'wss://s1.ripple.com',
        'wss://s2.ripple.com'
    ];

    const merged = [primary, ...fallbacks, ...defaults];
    return Array.from(new Set(merged));
}

function describeConnectionError(server: string, error: unknown): string {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unable to get local issuer certificate')) {
        return `TLS certificate validation failed for ${server}. Try another XRPL endpoint (XRPL_SERVER), update system CA certs, or set NODE_EXTRA_CA_CERTS to your CA bundle.`;
    }
    if (msg.includes('429') || msg.includes('IP limit reached')) {
        return `XRPL endpoint rate-limited (${server}): ${msg}`;
    }
    return `Failed to connect to XRPL server (${server}): ${msg}`;
}

function computeReconnectDelayMs(): number {
    // 2s, 4s, 8s... up to 60s
    const delay = Math.min(60000, 2000 * Math.pow(2, reconnectAttempts));
    return delay;
}

function clearReconnectTimer(): void {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

async function connectWithCandidates(): Promise<void> {
    const candidates = getServerCandidates();
    let lastError: string | null = null;

    for (const server of candidates) {
        const candidate = new Client(server, {
            connectionTimeout: 30000,
            timeout: 20000
        });

        try {
            await candidate.connect();
            persistentClient = candidate;
            reconnectAttempts = 0;

            persistentClient.on('disconnected', () => {
                if (shuttingDown) return;
                scheduleReconnect();
            });

            return;
        } catch (error) {
            lastError = describeConnectionError(server, error);
            try {
                await candidate.disconnect();
            } catch {
                // ignore
            }
        }
    }

    throw new Error(lastError || 'Failed to connect to any XRPL server');
}

function scheduleReconnect(): void {
    if (shuttingDown) return;
    if (connectingPromise) return;
    if (reconnectTimer) return;

    reconnectAttempts += 1;
    const backoffMs = computeReconnectDelayMs();
    const elapsedSinceLastAttempt = Date.now() - lastReconnectAttemptAt;
    const minIntervalMs = Math.max(0, MIN_RECONNECT_INTERVAL_MS - elapsedSinceLastAttempt);
    const delayMs = Math.max(backoffMs, minIntervalMs);

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        lastReconnectAttemptAt = Date.now();
        try {
            await getClient();
            console.log('XRPL client reconnected successfully');
        } catch (error) {
            console.error('XRPL client reconnect failed:', error instanceof Error ? error.message : error);
            scheduleReconnect();
        }
    }, delayMs);
}

export async function getClient(): Promise<Client> {
    if (persistentClient && persistentClient.isConnected()) {
        return persistentClient;
    }

    if (connectingPromise) {
        await connectingPromise;
        return persistentClient!;
    }

    connectingPromise = (async () => {
        try {
            clearReconnectTimer();
            await connectWithCandidates();
        } finally {
            connectingPromise = null;
        }
    })();

    await connectingPromise;
    return persistentClient!;
}

export async function disconnect(): Promise<void> {
    shuttingDown = true;
    clearReconnectTimer();

    if (persistentClient && persistentClient.isConnected()) {
        await persistentClient.disconnect();
    }

    persistentClient = null;
    connectingPromise = null;
}
