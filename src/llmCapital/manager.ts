import { loadLLMCapitalState, saveLLMCapitalState } from './storage';
import { AgentPolicy, LLMCapitalAgent } from './types';

function nowIso(): string {
    return new Date().toISOString();
}

function randomId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function maxAgents(): number {
    return parseInt(process.env.LLM_MAX_AGENTS || '20', 10);
}

function maxTotalAllocatedXrp(): number {
    return parseFloat(process.env.LLM_MAX_TOTAL_ALLOCATED_XRP || '1000');
}

function validatePolicy(policy: AgentPolicy): void {
    if (policy.maxDailyLossXrp <= 0) throw new Error('maxDailyLossXrp must be > 0');
    if (policy.maxPositionSizeXrp <= 0) throw new Error('maxPositionSizeXrp must be > 0');
    if (policy.maxTradesPerHour <= 0) throw new Error('maxTradesPerHour must be > 0');
    if (policy.maxChildren < 0) throw new Error('maxChildren must be >= 0');
    if (policy.minSpawnCapitalXrp < 0) throw new Error('minSpawnCapitalXrp must be >= 0');
}

export class LLMCapitalManager {
    listAgents(): LLMCapitalAgent[] {
        return loadLLMCapitalState().agents;
    }

    getAgent(agentId: string): LLMCapitalAgent | null {
        const state = loadLLMCapitalState();
        return state.agents.find(a => a.id === agentId) || null;
    }

    getAgentByUserId(userId: string): LLMCapitalAgent | null {
        const state = loadLLMCapitalState();
        return state.agents.find(a => a.userId === userId) || null;
    }

    createAgent(input: {
        name: string;
        userId?: string;
        walletAddress: string;
        allocatedXrp: number;
        policy: AgentPolicy;
        parentId?: string;
        defaultConfigId?: string;
        prompt?: string;
    }): LLMCapitalAgent {
        const state = loadLLMCapitalState();
        validatePolicy(input.policy);

        if (state.agents.length >= maxAgents()) {
            throw new Error(`Global agent cap reached (${maxAgents()})`);
        }

        if (state.agents.some(a => a.walletAddress === input.walletAddress)) {
            throw new Error('walletAddress is already assigned to another agent');
        }

        const totalAllocated = state.agents.reduce((sum, a) => sum + a.allocatedXrp, 0) + input.allocatedXrp;
        if (totalAllocated > maxTotalAllocatedXrp()) {
            throw new Error(`Global allocated XRP cap exceeded (${maxTotalAllocatedXrp()})`);
        }

        const agentId = randomId('llm_agent');
        const agent: LLMCapitalAgent = {
            id: agentId,
            name: input.name,
            userId: input.userId || `llm:${agentId}`,
            parentId: input.parentId,
            walletAddress: input.walletAddress,
            allocatedXrp: input.allocatedXrp,
            reservedXrp: 0,
            target: 'maximize_xrp',
            status: 'active',
            createdAt: nowIso(),
            updatedAt: nowIso(),
            policy: input.policy,
            defaultConfigId: input.defaultConfigId,
            prompt: input.prompt
        };

        state.agents.push(agent);
        saveLLMCapitalState(state);
        return agent;
    }

    updateAgentStatus(agentId: string, status: 'active' | 'paused' | 'error'): LLMCapitalAgent {
        const state = loadLLMCapitalState();
        const idx = state.agents.findIndex(a => a.id === agentId);
        if (idx < 0) {
            throw new Error('Agent not found');
        }

        const updated: LLMCapitalAgent = {
            ...state.agents[idx],
            status,
            updatedAt: nowIso()
        };

        state.agents[idx] = updated;
        saveLLMCapitalState(state);
        return updated;
    }

    updateAgent(agentId: string, updates: { defaultConfigId?: string | null; prompt?: string | null }): LLMCapitalAgent {
        const state = loadLLMCapitalState();
        const idx = state.agents.findIndex(a => a.id === agentId);
        if (idx < 0) {
            throw new Error('Agent not found');
        }

        const current = state.agents[idx];
        const updated: LLMCapitalAgent = {
            ...current,
            defaultConfigId: updates.defaultConfigId === undefined ? current.defaultConfigId : (updates.defaultConfigId || undefined),
            prompt: updates.prompt === undefined ? current.prompt : (updates.prompt || undefined),
            updatedAt: nowIso()
        };

        state.agents[idx] = updated;
        saveLLMCapitalState(state);
        return updated;
    }

    spawnChildAgent(parentId: string, input: { name: string; walletAddress: string; allocatedXrp: number; policy?: Partial<AgentPolicy>; }): LLMCapitalAgent {
        const state = loadLLMCapitalState();
        const parent = state.agents.find(a => a.id === parentId);
        if (!parent) {
            throw new Error('Parent agent not found');
        }

        if (parent.status !== 'active') {
            throw new Error('Parent agent must be active to spawn children');
        }

        if (!parent.policy.autoSpawnEnabled) {
            throw new Error('Parent agent is not allowed to auto-spawn');
        }

        if (state.agents.length >= maxAgents()) {
            throw new Error(`Global agent cap reached (${maxAgents()})`);
        }

        if (state.agents.some(a => a.walletAddress === input.walletAddress)) {
            throw new Error('walletAddress is already assigned to another agent');
        }

        const childCount = state.agents.filter(a => a.parentId === parentId).length;
        if (childCount >= parent.policy.maxChildren) {
            throw new Error('Parent child limit reached');
        }

        if (input.allocatedXrp < parent.policy.minSpawnCapitalXrp) {
            throw new Error('Allocated XRP below minimum spawn capital');
        }

        if (input.allocatedXrp > parent.allocatedXrp - parent.reservedXrp) {
            throw new Error('Parent does not have enough allocatable XRP');
        }

        const totalAllocated = state.agents.reduce((sum, a) => sum + a.allocatedXrp, 0) + input.allocatedXrp;
        if (totalAllocated > maxTotalAllocatedXrp()) {
            throw new Error(`Global allocated XRP cap exceeded (${maxTotalAllocatedXrp()})`);
        }

        parent.reservedXrp += input.allocatedXrp;
        parent.updatedAt = nowIso();

        const childPolicy: AgentPolicy = {
            ...parent.policy,
            ...input.policy
        };
        validatePolicy(childPolicy);

        const childId = randomId('llm_agent');
        const child: LLMCapitalAgent = {
            id: childId,
            name: input.name,
            userId: `llm:${childId}`,
            parentId,
            walletAddress: input.walletAddress,
            allocatedXrp: input.allocatedXrp,
            reservedXrp: 0,
            target: 'maximize_xrp',
            status: 'active',
            createdAt: nowIso(),
            updatedAt: nowIso(),
            policy: childPolicy
        };

        state.agents = state.agents.map(a => (a.id === parent.id ? parent : a));
        state.agents.push(child);
        saveLLMCapitalState(state);

        return child;
    }
}

export const llmCapitalManager = new LLMCapitalManager();
