import { Client } from 'xrpl';
import XRPLAMMChecker from '../../filterAmmCreate';
import { checkLPBurnStatus } from '../xrpl/amm';
import { IUser } from '../database/models';
import { TokenInfo, EvaluationResult } from '../types';
import config from '../config';

export async function isFirstTimeAMMCreator(accountAddress: string): Promise<boolean> {
    try {
        const checker = new XRPLAMMChecker();
        await checker.connect(config.xrpl.server);
        
        const result = await checker.getAccountAMMTransactions(accountAddress);
        const ammCreateCount = result.ammCreateTransactions.length;
        
        checker.close();
        
        return ammCreateCount <= 1;
    } catch (error) {
        console.error('Error checking AMM creator history:', error instanceof Error ? error.message : 'Unknown error');
        return false;
    }
}

/** Optional per-bot sniper config (from getEffectiveSniperConfig). */
export interface SniperConfigOverride {
    buyMode: boolean;
    riskScore: 'low' | 'medium' | 'high';
    minimumPoolLiquidity: number;
}

/**
 * Evaluate token for sniping based on user criteria
 */
export async function evaluateToken(
    client: Client,
    user: IUser,
    tokenInfo: TokenInfo,
    sniperConfig?: SniperConfigOverride
): Promise<EvaluationResult> {
    const evaluation: EvaluationResult = {
        shouldSnipe: false,
        reasons: []
    };

    const buyMode = sniperConfig?.buyMode ?? config.sniperUser.buyMode;
    const riskScore = sniperConfig?.riskScore ?? (config.sniperUser.riskScore as 'low' | 'medium' | 'high');
    const minLiquidity = sniperConfig?.minimumPoolLiquidity ?? config.sniperUser.minimumPoolLiquidity;

    if (riskScore !== 'high') {
        const alreadyOwned = user.sniperPurchases?.some(p =>
            p.tokenAddress === tokenInfo.issuer && 
            p.tokenSymbol === tokenInfo.currency &&
            p.status === 'active'
        );

        if (alreadyOwned) {
            evaluation.reasons.push('Token already in active purchases');
            return evaluation;
        }
    } else {
        // In high-risk mode, allow re-entry even if we have active position (averaging)
        evaluation.reasons.push('High-risk mode: Re-entry allowed');
    }

    if (!buyMode) {
        const isWhitelisted = user.whiteListedTokens?.some(token =>
            token.currency === tokenInfo.currency && token.issuer === tokenInfo.issuer
        );

        if (!isWhitelisted) {
            evaluation.reasons.push('Token not in whitelist');
            return evaluation;
        }
    }

    if (buyMode) {
        if (tokenInfo.initialLiquidity === null) {
            evaluation.reasons.push('Null initial liquidity accepted');
        } else if (tokenInfo.initialLiquidity !== undefined && tokenInfo.initialLiquidity < minLiquidity) {
            evaluation.reasons.push(`Insufficient liquidity: ${tokenInfo.initialLiquidity} XRP < ${minLiquidity} XRP`);
            return evaluation;
        } else if (tokenInfo.initialLiquidity !== undefined && tokenInfo.initialLiquidity !== null) {
            evaluation.reasons.push(`Liquidity check passed: ${tokenInfo.initialLiquidity} XRP`);
        }
    }

    if (riskScore === 'high') {
        // HIGH RISK MODE: Minimal checks for maximum speed and frequency
        evaluation.reasons.push('High-risk mode: Skipping creator history and LP burn checks');
        evaluation.shouldSnipe = true;
        return evaluation;
    }
    
    // MEDIUM/LOW RISK: More thorough checks
    if (riskScore === 'medium') {
        // Skip first-time creator check but require LP burn
        evaluation.reasons.push('Medium-risk mode: Skipping creator check');
        
        const lpBurnCheck = await checkLPBurnStatus(client, tokenInfo);
        if (!lpBurnCheck.lpBurned) {
            evaluation.reasons.push(`LP tokens not burned yet (LP Balance: ${lpBurnCheck.lpBalance})`);
            return evaluation;
        }
        evaluation.reasons.push('LP burn check passed');
        evaluation.shouldSnipe = true;
        return evaluation;
    }
    
    // LOW RISK: All checks (original behavior)
    if (!tokenInfo.account) {
        evaluation.reasons.push('No account information');
        return evaluation;
    }

    const isFirstTime = await isFirstTimeAMMCreator(tokenInfo.account);
    if (!isFirstTime) {
        evaluation.reasons.push('Not a first-time AMM creator');
        return evaluation;
    }
    evaluation.reasons.push('First-time creator check passed');

    const lpBurnCheck = await checkLPBurnStatus(client, tokenInfo);
    if (!lpBurnCheck.lpBurned) {
        evaluation.reasons.push(`LP tokens not burned yet (LP Balance: ${lpBurnCheck.lpBalance})`);
        return evaluation;
    }
    evaluation.reasons.push('LP burn check passed');

    // All checks passed
    evaluation.shouldSnipe = true;
    return evaluation;
}

export { isTokenBlacklisted } from '../utils/tokenUtils';

