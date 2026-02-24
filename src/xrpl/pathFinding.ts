import { Client } from 'xrpl';
import { xrpToDrops } from 'xrpl';

export interface PathAlternative {
    /** Path steps (currencies/issuers) to attach to Payment.Paths */
    paths_computed: Array<Array<{ currency: string; issuer?: string; type?: number }>>;
    /** Estimated source amount (what we spend) */
    source_amount: string | { currency: string; issuer?: string; value: string };
}

export interface RipplePathFindResult {
    alternatives: PathAlternative[];
    destination_account: string;
    destination_amount: { currency: string; issuer?: string; value: string };
    source_account: string;
}

/**
 * Find payment paths using ripple_path_find (best execution across AMM + order book).
 * Use the result to build a Payment with Paths for better execution.
 */
export async function findPaymentPaths(
    client: Client,
    sourceAccount: string,
    destinationAccount: string,
    destinationAmount: { currency: string; issuer?: string; value: string },
    sendMax?: { currency: string; issuer?: string; value: string } | string
): Promise<RipplePathFindResult | null> {
    try {
        const req: any = {
            command: 'ripple_path_find',
            source_account: sourceAccount,
            destination_account: destinationAccount,
            destination_amount: destinationAmount,
            ledger_index: 'validated'
        };
        if (sendMax) {
            req.send_max = typeof sendMax === 'string' ? sendMax : sendMax;
        }
        const response = await client.request(req);
        const result = (response as any).result;
        if (!result || !result.alternatives || result.alternatives.length === 0) {
            return null;
        }
        return result as RipplePathFindResult;
    } catch (error) {
        if (error && typeof error === 'object' && (error as any).data?.error === 'noPath') {
            return null;
        }
        console.error('Path find error:', error);
        return null;
    }
}

/**
 * Find path for XRP -> Token (buy). Destination receives token.
 */
export async function findPathXRPToToken(
    client: Client,
    account: string,
    tokenCurrency: string,
    tokenIssuer: string,
    tokenAmount: string,
    sendMaxXRP: number
): Promise<RipplePathFindResult | null> {
    return findPaymentPaths(
        client,
        account,
        account,
        {
            currency: tokenCurrency,
            issuer: tokenIssuer,
            value: tokenAmount
        },
        xrpToDrops(sendMaxXRP.toString())
    );
}

/**
 * Find path for Token -> XRP (sell). Destination receives XRP.
 */
export async function findPathTokenToXRP(
    client: Client,
    account: string,
    tokenCurrency: string,
    tokenIssuer: string,
    xrpAmount: string,
    sendMaxTokenValue: string
): Promise<RipplePathFindResult | null> {
    return findPaymentPaths(
        client,
        account,
        account,
        { currency: 'XRP', value: xrpAmount },
        {
            currency: tokenCurrency,
            issuer: tokenIssuer,
            value: sendMaxTokenValue
        }
    );
}

/**
 * Pick the best alternative (e.g. least source amount for a given destination amount).
 * Returns the first path's paths_computed for use in Payment.Paths.
 */
export function getBestPathForPayment(result: RipplePathFindResult): PathAlternative | null {
    if (!result.alternatives || result.alternatives.length === 0) return null;
    const sorted = [...result.alternatives].sort((a, b) => {
        const aVal = typeof a.source_amount === 'string'
            ? parseFloat(a.source_amount) / 1e6
            : parseFloat((a.source_amount as any).value || '0');
        const bVal = typeof b.source_amount === 'string'
            ? parseFloat(b.source_amount) / 1e6
            : parseFloat((b.source_amount as any).value || '0');
        return aVal - bVal; // prefer spending less
    });
    return sorted[0];
}
