import { Client, Wallet, xrpToDrops } from 'xrpl';
import { formatTokenAmountSimple } from './utils';

export interface PlaceOfferResult {
    success: boolean;
    txHash?: string;
    offerId?: string;
    error?: string;
}

/**
 * Place a limit order (OfferCreate) on the DEX.
 * For "sell token for XRP": TakerGets = XRP (we receive), TakerPays = token (we give).
 * For "buy token with XRP": TakerGets = token (we receive), TakerPays = XRP (we give).
 */
export async function placeOffer(
    client: Client,
    wallet: Wallet,
    takerGets: string | { currency: string; issuer: string; value: string },
    takerPays: string | { currency: string; issuer: string; value: string },
    options?: { expiration?: number; sellFlag?: boolean }
): Promise<PlaceOfferResult> {
    try {
        const tx: any = {
            TransactionType: 'OfferCreate',
            Account: wallet.address,
            TakerGets: takerGets,
            TakerPays: takerPays
        };
        if (options?.expiration) {
            tx.Expiration = options.expiration;
        }
        if (options?.sellFlag) {
            tx.Flags = 0x00010000; // tfSell: offer is sell (exchange token for XRP)
        }
        const prepared = await client.autofill(tx);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        const meta = (result.result as any).meta;
        const txResult = meta?.TransactionResult;
        if (txResult !== 'tesSUCCESS') {
            return { success: false, error: txResult || 'Unknown' };
        }
        const offerId = meta?.AffectedNodes?.find(
            (n: any) => n.CreatedNode?.LedgerEntryType === 'Offer'
        )?.CreatedNode?.LedgerIndex;
        return {
            success: true,
            txHash: (result.result as any).hash,
            offerId: offerId || undefined
        };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || String(error)
        };
    }
}

/**
 * Place a limit order to BUY token with XRP (we pay XRP, receive token).
 */
export async function placeBuyOrder(
    client: Client,
    wallet: Wallet,
    tokenCurrency: string,
    tokenIssuer: string,
    tokenAmount: number,
    xrpLimitPrice: number,
    expiration?: number
): Promise<PlaceOfferResult> {
    const takerGets = {
        currency: tokenCurrency,
        issuer: tokenIssuer,
        value: formatTokenAmountSimple(tokenAmount)
    };
    const takerPays = xrpToDrops((tokenAmount * xrpLimitPrice).toString());
    return placeOffer(client, wallet, takerGets, takerPays, { expiration });
}

/**
 * Place a limit order to SELL token for XRP (we give token, receive XRP).
 */
export async function placeSellOrder(
    client: Client,
    wallet: Wallet,
    tokenCurrency: string,
    tokenIssuer: string,
    tokenAmount: number,
    minXRPPerToken: number,
    expiration?: number
): Promise<PlaceOfferResult> {
    const takerGets = xrpToDrops((tokenAmount * minXRPPerToken).toString());
    const takerPays = {
        currency: tokenCurrency,
        issuer: tokenIssuer,
        value: formatTokenAmountSimple(tokenAmount)
    };
    return placeOffer(client, wallet, takerGets, takerPays, {
        expiration,
        sellFlag: true
    });
}

/**
 * Cancel an offer by sequence number (from account's sequence at offer creation).
 * Alternatively cancel by Offer ID via OfferCancel transaction.
 */
export async function cancelOfferBySequence(
    client: Client,
    wallet: Wallet,
    offerSequence: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const tx = {
            TransactionType: 'OfferCancel' as const,
            Account: wallet.address,
            OfferSequence: offerSequence
        };
        const prepared = await client.autofill(tx);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        const txResult = (result.result as any).meta?.TransactionResult;
        if (txResult !== 'tesSUCCESS') {
            return { success: false, error: txResult };
        }
        return {
            success: true,
            txHash: (result.result as any).hash
        };
    } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
    }
}

/**
 * Get open offers for an account.
 */
export async function getAccountOffers(
    client: Client,
    account: string
): Promise<Array<{ sequence: number; taker_gets: any; taker_pays: any; flags: number }>> {
    try {
        const response = await client.request({
            command: 'account_offers',
            account,
            ledger_index: 'validated'
        });
        const offers = (response.result as any).offers || [];
        return offers.map((o: any) => ({
            sequence: o.seq,
            taker_gets: o.taker_gets,
            taker_pays: o.taker_pays,
            flags: o.flags || 0
        }));
    } catch (error) {
        console.error('Account offers error:', error);
        return [];
    }
}
