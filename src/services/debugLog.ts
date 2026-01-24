// SCORCHED EARTH DEBUG LOG SERVICE
// Stripped to bare minimum to prevent Lynx runtime crash

export function logCapture(level: any, ...args: any[]) {
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
}

export const DebugLogService = {
  log(category: string, message: string, ...args: any[]): void {
    console.log(`[${category}] ${message}`, ...args);
  },
  warn(category: string, message: string, ...args: any[]): void {
    console.warn(`[${category}] ${message}`, ...args);
  },
  error(category: string, message: string, error?: Error, ...args: any[]): void {
    console.error(`[${category}] ${message}`, error?.message || '', ...args);
  },
  reportError(category: string, context: string, error: Error): void {
    console.error(`[${category}] ERROR in ${context}:`, error.message);
  },
  getLogs(): any[] { return []; },
  getLogsAsText(): string { return 'Logs disabled'; },
  getStructuredReport(): any { return {}; },
  getDebugReport(): string { return 'Report disabled'; },
  clear(): void {},
  count(): number { return 0; },
};
