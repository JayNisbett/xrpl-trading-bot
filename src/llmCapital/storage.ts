import * as fs from 'fs';
import * as path from 'path';
import { LLMCapitalState } from './types';

const FILE_PATH = path.join(process.cwd(), 'data', 'llm-agents.json');

function defaultState(): LLMCapitalState {
    return {
        agents: [],
        updatedAt: new Date().toISOString()
    };
}

export function loadLLMCapitalState(): LLMCapitalState {
    try {
        if (!fs.existsSync(FILE_PATH)) {
            saveLLMCapitalState(defaultState());
            return defaultState();
        }

        const data = fs.readFileSync(FILE_PATH, 'utf-8');
        const parsed = JSON.parse(data) as LLMCapitalState;
        return {
            agents: Array.isArray(parsed.agents) ? parsed.agents : [],
            updatedAt: parsed.updatedAt || new Date().toISOString()
        };
    } catch {
        return defaultState();
    }
}

export function saveLLMCapitalState(state: LLMCapitalState): void {
    const dir = path.dirname(FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const payload: LLMCapitalState = {
        ...state,
        updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}
