import { Client } from 'xrpl';
import { TokenInfo } from '../types';
import { hexToString } from '../xrpl/utils';

// Rate limiting with exponential backoff
let lastRequestTime = 0;
let consecutiveErrors = 0;
const BASE_REQUEST_INTERVAL = 200; // Base 200ms between batches
const MAX_BACKOFF = 5000; // Max 5 second backoff

async function rateLimitedDelay(): Promise<void> {
    // Calculate delay with exponential backoff if we're getting rate limited
    const backoffMultiplier = Math.min(Math.pow(2, consecutiveErrors), 25); // Max 25x
    const delayMs = BASE_REQUEST_INTERVAL * backoffMultiplier;
    const actualDelay = Math.min(delayMs, MAX_BACKOFF);
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < actualDelay) {
        await new Promise(resolve => setTimeout(resolve, actualDelay - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();
}

function recordRateLimitError(): void {
    consecutiveErrors = Math.min(consecutiveErrors + 1, 5); // Cap at 5
}

function recordSuccess(): void {
    // Slowly reduce backoff on success
    if (consecutiveErrors > 0) {
        consecutiveErrors = Math.max(0, consecutiveErrors - 0.5);
    }
}

export async function detectNewTokensFromAMM(client: Client): Promise<TokenInfo[]> {
    try {
        // Rate limit with exponential backoff
        await rateLimitedDelay();
        
        const response = await client.request({
            command: 'ledger',
            ledger_index: 'validated',
            transactions: true,
            expand: true
        });

        const newTokens: TokenInfo[] = [];
        const currentLedgerIndex = (response.result as any).ledger.ledger_index;
        
        // OPTIMIZED: Scan 5 ledgers for better coverage
        // Still sequential to avoid rate limits but covers more ground
        const ledgerIndices = [
            currentLedgerIndex,
            currentLedgerIndex - 1,
            currentLedgerIndex - 2,
            currentLedgerIndex - 3,
            currentLedgerIndex - 4
        ];

        let hadRateLimitInLoop = false;

        // Process ONE ledger at a time with delays
        for (let i = 0; i < ledgerIndices.length; i++) {
            try {
                const ledgerResponse = await client.request({
                    command: 'ledger',
                    ledger_index: ledgerIndices[i],
                    transactions: true,
                    expand: true
                });

                const txWrappers = (ledgerResponse.result as any)?.ledger?.transactions || [];
                const transactions = txWrappers
                    .filter((wrapper: any) => wrapper.tx_json && wrapper.meta)
                    .map((wrapper: any) => ({
                        ...wrapper.tx_json,
                        meta: wrapper.meta
                    }));

                // Process AMM creates
                for (const tx of transactions) {
                    if (tx.TransactionType === 'AMMCreate' && tx.meta?.TransactionResult === 'tesSUCCESS') {
                        const tokenInfo = extractTokenFromAMMCreate(tx);
                        if (tokenInfo) {
                            newTokens.push(tokenInfo);
                        }
                    }
                }

                // Delay between each ledger request
                if (i < ledgerIndices.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }

                recordSuccess(); // Reduce backoff on success for this ledger
            } catch (error) {
                if (error instanceof Error && error.message.includes('too much load')) {
                    recordRateLimitError(); // Increase backoff
                    hadRateLimitInLoop = true;
                }
                // Continue with remaining ledgers
            }
        }

        // Only reduce backoff at end of scan if we didn't hit rate limit in the loop
        if (!hadRateLimitInLoop) {
            recordSuccess();
        }
        return newTokens;
    } catch (error) {
        // Handle rate limiting errors
        if (error instanceof Error) {
            if (error.message.includes('too much load')) {
                recordRateLimitError();
                // Don't log rate limit errors, they're expected
            } else if (!error.message.includes('Timeout')) {
                console.error('Error detecting AMM tokens:', error.message);
            }
        }
        return [];
    }
}

export function extractTokenFromAMMCreate(tx: any): TokenInfo | null {
    try {
        const { Amount, Amount2 } = tx;
        let xrpAmount: number;
        let tokenInfo: any;

        if (typeof Amount === 'string') {
            xrpAmount = parseInt(Amount) / 1000000;
            tokenInfo = Amount2;
        } else {
            xrpAmount = parseInt(Amount2) / 1000000;
            tokenInfo = Amount;
        }

        if (!tokenInfo || typeof tokenInfo === 'string') {
            return null;
        }

        return {
            currency: tokenInfo.currency,
            issuer: tokenInfo.issuer,
            readableCurrency: hexToString(tokenInfo.currency),
            initialLiquidity: xrpAmount,
            tokenAmount: tokenInfo.value,
            transactionHash: tx.hash || '',
            account: tx.Account
        };
    } catch (error) {
        return null;
    }
}

