export interface MCPToolResponse {
    ok: boolean;
    data?: unknown;
    error?: string;
}

interface MCPEnvelope {
    type: string;
    params: Record<string, unknown>;
}

export class XRPLMCPClient {
    private readonly baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.XRPL_MCP_URL || 'http://127.0.0.1:8000';
    }

    private async postEnvelope(envelope: MCPEnvelope): Promise<MCPToolResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/mcp/v1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(envelope)
            });

            if (!response.ok) {
                return { ok: false, error: `HTTP ${response.status}` };
            }

            const data = await response.json() as { result?: unknown; error?: string };
            if (data.error) {
                return { ok: false, error: data.error };
            }

            return { ok: true, data: data.result ?? data };
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'Unknown MCP error' };
        }
    }

    async call(type: string, params: Record<string, unknown>): Promise<MCPToolResponse> {
        return this.postEnvelope({ type, params });
    }

    async serverInfo(): Promise<MCPToolResponse> {
        return this.call('server_info', {});
    }

    async accountInfo(account: string): Promise<MCPToolResponse> {
        return this.call('account_info', { account });
    }

    async accountBalances(account: string): Promise<MCPToolResponse> {
        return this.call('account_lines', { account });
    }

    async accountTransactions(account: string, limit = 20): Promise<MCPToolResponse> {
        return this.call('account_transactions', { account, limit });
    }
}
