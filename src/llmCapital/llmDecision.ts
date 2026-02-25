/**
 * Optional LLM decision layer: when an agent has a prompt and MCP is configured,
 * call the MCP server's evaluate_trade tool so an external LLM can allow or block trades.
 * If MCP is unavailable or the tool is not implemented, we fall back to policy-only (caller still uses canExecuteXrpTrade).
 */
import { llmCapitalManager } from './manager';

const MCP_URL = process.env.XRPL_MCP_URL || '';

export interface LLMTradeDecision {
    allowed: boolean;
    reason?: string;
}

/**
 * Ask the LLM service (via MCP evaluate_trade) whether to allow this trade.
 * Returns { allowed: true } when: agent is not LLM-managed, agent has no prompt, MCP URL not set, or MCP returns allowed.
 * Returns { allowed: false, reason } when MCP explicitly denies the trade.
 */
export async function llmAllowsTrade(
    userId: string,
    strategy: 'amm' | 'sniper' | 'copyTrading',
    xrpAmount: number,
    context?: { token?: string; description?: string }
): Promise<LLMTradeDecision> {
    const agent = llmCapitalManager.getAgentByUserId(userId);
    if (!agent || !agent.prompt || !MCP_URL.trim()) {
        return { allowed: true };
    }

    try {
        const { XRPLMCPClient } = await import('../mcp/xrplMcpClient');
        const client = new XRPLMCPClient(MCP_URL);
        const res = await client.call('evaluate_trade', {
            userId,
            strategy,
            amountXrp: xrpAmount,
            prompt: agent.prompt,
            ...context
        });

        if (!res.ok) {
            return { allowed: true };
        }

        const data = res.data as { allowed?: boolean; reason?: string } | undefined;
        if (data && data.allowed === false) {
            return { allowed: false, reason: data.reason || 'LLM declined trade' };
        }

        return { allowed: true };
    } catch {
        return { allowed: true };
    }
}
