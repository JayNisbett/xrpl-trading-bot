export type RiskTier = 'low' | 'medium' | 'high';

export interface AgentPolicy {
    riskTier: RiskTier;
    maxDailyLossXrp: number;
    maxPositionSizeXrp: number;
    maxTradesPerHour: number;
    allowedStrategies: Array<'amm' | 'sniper' | 'copyTrading'>;
    autoSpawnEnabled: boolean;
    maxChildren: number;
    minSpawnCapitalXrp: number;
}

export interface LLMCapitalAgent {
    id: string;
    name: string;
    userId: string;
    parentId?: string;
    walletAddress: string;
    allocatedXrp: number;
    reservedXrp: number;
    target: 'maximize_xrp';
    status: 'active' | 'paused' | 'error';
    createdAt: string;
    updatedAt: string;
    policy: AgentPolicy;
    /** Strategy config this agent inherits; used when starting config if none specified. */
    defaultConfigId?: string;
    /** Optional system/instruction prompt for the LLM when making decisions. */
    prompt?: string;
}

export interface LLMCapitalState {
    agents: LLMCapitalAgent[];
    updatedAt: string;
}
