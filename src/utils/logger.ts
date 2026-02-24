import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface LogEntry {
    timestamp: Date;
    level: 'info' | 'success' | 'warning' | 'error' | 'debug';
    botId?: string;
    botName?: string;
    category: string;
    message: string;
    data?: any;
}

class BotLogger extends EventEmitter {
    private logs: LogEntry[] = [];
    private maxLogs = 5000;
    private logsByBot: Map<string, LogEntry[]> = new Map();
    private maxLogsPerBot = 1000;
    private logFile: string;

    constructor() {
        super();
        this.logFile = path.join(process.cwd(), 'data', 'bot-logs.json');
        this.ensureLogDir();
        this.loadLogs();
    }

    private ensureLogDir(): void {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private loadLogs(): void {
        try {
            if (fs.existsSync(this.logFile)) {
                const data = fs.readFileSync(this.logFile, 'utf-8');
                const parsed = JSON.parse(data);
                
                if (Array.isArray(parsed.logs)) {
                    this.logs = parsed.logs.map((log: any) => ({
                        ...log,
                        timestamp: new Date(log.timestamp)
                    }));
                    
                    // Rebuild bot logs map
                    this.logs.forEach(log => {
                        if (log.botId) {
                            if (!this.logsByBot.has(log.botId)) {
                                this.logsByBot.set(log.botId, []);
                            }
                            this.logsByBot.get(log.botId)!.push(log);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }

    private saveLogs(): void {
        try {
            const data = {
                logs: this.logs.slice(-this.maxLogs),
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.logFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save logs:', error);
        }
    }

    private addLog(entry: LogEntry): void {
        this.logs.push(entry);
        
        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Add to bot-specific logs
        if (entry.botId) {
            if (!this.logsByBot.has(entry.botId)) {
                this.logsByBot.set(entry.botId, []);
            }
            const botLogs = this.logsByBot.get(entry.botId)!;
            botLogs.push(entry);
            
            // Keep only recent logs per bot
            if (botLogs.length > this.maxLogsPerBot) {
                this.logsByBot.set(entry.botId, botLogs.slice(-this.maxLogsPerBot));
            }
        }

        // Emit event for real-time updates
        this.emit('log', entry);

        // Save periodically (every 100 logs)
        if (this.logs.length % 100 === 0) {
            this.saveLogs();
        }
    }

    private formatConsole(entry: LogEntry): void {
        const timestamp = entry.timestamp.toLocaleTimeString();
        const botPrefix = entry.botName ? `[${entry.botName}]` : '';
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            debug: '🔍'
        };
        
        const icon = icons[entry.level];
        const colorCodes = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            debug: '\x1b[90m',
            reset: '\x1b[0m'
        };
        
        const color = colorCodes[entry.level];
        const reset = colorCodes.reset;
        
        console.log(`${color}${timestamp} ${icon} ${botPrefix} [${entry.category}] ${entry.message}${reset}`);
        
        if (entry.data) {
            console.log(`${color}  └─ Data:${reset}`, entry.data);
        }
    }

    log(level: LogEntry['level'], category: string, message: string, data?: any, botId?: string, botName?: string): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            botId,
            botName,
            category,
            message,
            data
        };

        this.addLog(entry);
        this.formatConsole(entry);
    }

    info(category: string, message: string, data?: any, botId?: string, botName?: string): void {
        this.log('info', category, message, data, botId, botName);
    }

    success(category: string, message: string, data?: any, botId?: string, botName?: string): void {
        this.log('success', category, message, data, botId, botName);
    }

    warning(category: string, message: string, data?: any, botId?: string, botName?: string): void {
        this.log('warning', category, message, data, botId, botName);
    }

    error(category: string, message: string, data?: any, botId?: string, botName?: string): void {
        this.log('error', category, message, data, botId, botName);
    }

    debug(category: string, message: string, data?: any, botId?: string, botName?: string): void {
        this.log('debug', category, message, data, botId, botName);
    }

    // Get all logs
    getAllLogs(limit?: number): LogEntry[] {
        const logs = limit ? this.logs.slice(-limit) : this.logs;
        return logs;
    }

    // Get logs for specific bot
    getBotLogs(botId: string, limit?: number): LogEntry[] {
        const botLogs = this.logsByBot.get(botId) || [];
        return limit ? botLogs.slice(-limit) : botLogs;
    }

    // Get logs by level
    getLogsByLevel(level: LogEntry['level'], limit?: number): LogEntry[] {
        const filtered = this.logs.filter(log => log.level === level);
        return limit ? filtered.slice(-limit) : filtered;
    }

    // Get logs by category
    getLogsByCategory(category: string, limit?: number): LogEntry[] {
        const filtered = this.logs.filter(log => log.category === category);
        return limit ? filtered.slice(-limit) : filtered;
    }

    // Clear all logs
    clearLogs(): void {
        this.logs = [];
        this.logsByBot.clear();
        this.saveLogs();
    }

    // Clear logs for specific bot
    clearBotLogs(botId: string): void {
        this.logs = this.logs.filter(log => log.botId !== botId);
        this.logsByBot.delete(botId);
        this.saveLogs();
    }

    // Get statistics
    getStats() {
        return {
            total: this.logs.length,
            byLevel: {
                info: this.logs.filter(l => l.level === 'info').length,
                success: this.logs.filter(l => l.level === 'success').length,
                warning: this.logs.filter(l => l.level === 'warning').length,
                error: this.logs.filter(l => l.level === 'error').length,
                debug: this.logs.filter(l => l.level === 'debug').length
            },
            byBot: Array.from(this.logsByBot.entries()).map(([botId, logs]) => ({
                botId,
                count: logs.length,
                lastLog: logs[logs.length - 1]
            }))
        };
    }

    // Flush logs to disk
    flush(): void {
        this.saveLogs();
    }
}

export const logger = new BotLogger();

// Save logs on process exit
process.on('exit', () => logger.flush());
process.on('SIGINT', () => {
    logger.flush();
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.flush();
    process.exit(0);
});
