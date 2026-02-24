/**
 * Shared token utilities used by sniper and copy trading.
 */

export interface BlacklistEntry {
    currency: string;
    issuer: string;
}

/**
 * Check if token is blacklisted
 */
export function isTokenBlacklisted(
    blackListedTokens: BlacklistEntry[] | undefined,
    currency: string,
    issuer: string
): boolean {
    if (!blackListedTokens || blackListedTokens.length === 0) {
        return false;
    }
    return blackListedTokens.some(
        (token) => token.currency === currency && token.issuer === issuer
    );
}
