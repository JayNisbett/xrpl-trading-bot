import { Client } from 'xrpl';

export interface BookOffer {
    TakerGets: string | { currency: string; issuer?: string; value: string };
    TakerPays: string | { currency: string; issuer?: string; value: string };
    owner_funds?: string;
    quality?: string;
}

/**
 * Get order book (offers) between two assets.
 * taker_gets = what the taker receives; taker_pays = what the taker pays.
 * For "buy token with XRP": taker_gets = token, taker_pays = XRP (we pay XRP, get token).
 */
export async function getBookOffers(
    client: Client,
    takerGets: { currency: string; issuer?: string } | 'XRP',
    takerPays: { currency: string; issuer?: string } | 'XRP',
    takerAccount?: string,
    limit: number = 20
): Promise<BookOffer[]> {
    try {
        const gets = takerGets === 'XRP' ? { currency: 'XRP' } : { currency: takerGets.currency, issuer: takerGets.issuer };
        const pays = takerPays === 'XRP' ? { currency: 'XRP' } : { currency: takerPays.currency, issuer: takerPays.issuer };
        const req: any = {
            command: 'book_offers',
            taker_gets: gets,
            taker_pays: pays,
            ledger_index: 'validated',
            limit
        };
        if (takerAccount) req.taker = takerAccount;
        const response = await client.request(req);
        const offers = (response.result as any).offers || [];
        return offers;
    } catch (error) {
        console.error('Book offers error:', error);
        return [];
    }
}

/** Parse amount to number (XRP in drops -> XRP, or token value). */
function amountToNumber(amt: string | { value: string }): number {
    if (typeof amt === 'string') return parseFloat(amt) / 1e6; // drops to XRP
    return parseFloat((amt as any).value || '0');
}

/**
 * Effective price for buying token with XRP from the book.
 * Book side: taker_gets = token, taker_pays = XRP.
 * Returns { tokensReceived, xrpSpent, effectiveRate } for spending up to maxXRP.
 */
export function getBookBuyQuote(
    offers: BookOffer[],
    maxXRP: number
): { tokensReceived: number; xrpSpent: number; effectiveRate: number } {
    let xrpSpent = 0;
    let tokensReceived = 0;
    for (const offer of offers) {
        if (xrpSpent >= maxXRP) break;
        const paysXRP = amountToNumber(offer.TakerPays);
        const getsToken = amountToNumber(offer.TakerGets);
        if (getsToken <= 0) continue;
        const remainingXRP = maxXRP - xrpSpent;
        const canSpend = Math.min(paysXRP, remainingXRP);
        const tokensFromOffer = (canSpend / paysXRP) * getsToken;
        xrpSpent += canSpend;
        tokensReceived += tokensFromOffer;
    }
    const effectiveRate = tokensReceived > 0 ? xrpSpent / tokensReceived : 0;
    return { tokensReceived, xrpSpent, effectiveRate };
}

/**
 * Effective price for selling token for XRP from the book.
 * Book side for sells: we pay token, get XRP. So taker_gets = XRP, taker_pays = token.
 */
export function getBookSellQuote(
    offers: BookOffer[],
    tokenAmount: number
): { xrpReceived: number; tokensSold: number; effectiveRate: number } {
    let tokensSold = 0;
    let xrpReceived = 0;
    for (const offer of offers) {
        if (tokensSold >= tokenAmount) break;
        const paysToken = amountToNumber(offer.TakerPays);
        const getsXRP = amountToNumber(offer.TakerGets);
        if (paysToken <= 0) continue;
        const remaining = tokenAmount - tokensSold;
        const takeFromOffer = Math.min(paysToken, remaining);
        const xrpFromOffer = (takeFromOffer / paysToken) * getsXRP;
        tokensSold += takeFromOffer;
        xrpReceived += xrpFromOffer;
    }
    const effectiveRate = tokensSold > 0 ? xrpReceived / tokensSold : 0;
    return { xrpReceived, tokensSold, effectiveRate };
}

/**
 * Get order book for XRP/Token pair in "buy token" direction (taker gets token, pays XRP).
 */
export async function getBookOffersBuyToken(
    client: Client,
    tokenCurrency: string,
    tokenIssuer: string,
    limit = 20
): Promise<BookOffer[]> {
    return getBookOffers(
        client,
        { currency: tokenCurrency, issuer: tokenIssuer },
        'XRP',
        undefined,
        limit
    );
}

/**
 * Get order book for XRP/Token in "sell token" direction (taker gets XRP, pays token).
 */
export async function getBookOffersSellToken(
    client: Client,
    tokenCurrency: string,
    tokenIssuer: string,
    limit = 20
): Promise<BookOffer[]> {
    return getBookOffers(
        client,
        'XRP',
        { currency: tokenCurrency, issuer: tokenIssuer },
        undefined,
        limit
    );
}
