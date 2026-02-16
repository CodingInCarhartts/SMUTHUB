// SAFE DEBUG LOG SERVICE
// Captures logs in memory for on-device viewing without crashing the Lynx runtime

export type LogCategory =
  | 'INIT'
  | 'NETWORK'
  | 'SYNC'
  | 'UI'
  | 'STORAGE'
  | 'UPDATE'
  | 'PERF'
  | 'GENERAL';

export interface LogEntry {
  timestamp: string;
  category: string;
  level: 'log' | 'warn' | 'error';
  message: string;
  args?: any[];
}

const MAX_LOGS = 1000;
const logs: LogEntry[] = [];

function addLog(
  level: 'log' | 'warn' | 'error',
  category: string,
  message: string,
  ...args: any[]
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
    args: args.length > 0 ? args : undefined,
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Still call native console
  if (level === 'error') console.error(`[${category}] ${message}`, ...args);
  else if (level === 'warn') console.warn(`[${category}] ${message}`, ...args);
  else console.log(`[${category}] ${message}`, ...args);
}

export function logCapture(level: any, ...args: any[]) {
  addLog(
    level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log',
    'GENERAL',
    args[0]?.toString() || '',
    ...args.slice(1),
  );
}

export const DebugLogService = {
  log(category: string, message: string, ...args: any[]): void {
    addLog('log', category, message, ...args);
  },
  warn(category: string, message: string, ...args: any[]): void {
    addLog('warn', category, message, ...args);
  },
  error(
    category: string,
    message: string,
    error?: Error,
    ...args: any[]
  ): void {
    addLog(
      'error',
      category,
      `${message}${error ? `: ${error.message}` : ''}`,
      ...args,
    );
  },
  reportError(category: string, context: string, error: Error): void {
    addLog('error', category, `ERROR in ${context}: ${error.message}`);
  },
  getLogs(): LogEntry[] {
    return [...logs];
  },
  getLogsAsText(): string {
    return logs
      .map(
        (l) =>
          `[${l.timestamp.split('T')[1].split('.')[0]}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}`,
      )
      .join('\n');
  },
  getStructuredReport(context?: any): any {
    return {
      app_version: context?.version || 'Unknown',
      timestamp: new Date().toISOString(),
      environment_info: {
        platform: typeof lynx !== 'undefined' ? 'Lynx' : 'Web/Unknown',
        deviceId: context?.deviceId || 'Unknown',
      },
      settings: context?.settings || {},
      storage_state: context?.storageValues || {},
      console_logs: this.getLogsAsText().split('\n'),
    };
  },
  getDebugReport(context?: any): string {
    const report = this.getStructuredReport(context);
    let text = `=== VERSION: ${report.app_version} ===\n`;
    text += `=== DEVICE ID: ${report.environment_info.deviceId} ===\n\n`;
    text += `--- LOGS (${logs.length}) ---\n`;
    text += this.getLogsAsText();
    return text;
  },
  clear(): void {
    logs.length = 0;
  },
  count(): number {
    return logs.length;
  },
};
