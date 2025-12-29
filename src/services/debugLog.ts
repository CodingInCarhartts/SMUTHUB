// Debug Log Capture Service
// Captures console output for viewing in production app

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

function captureLog(level: LogEntry['level'], args: any[]) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    args: formatArgs(args),
  };
  
  logs.push(entry);
  
  // Trim old logs
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
}

// Override console methods
console.log = (...args) => {
  captureLog('log', args);
  originalConsole.log(...args);
};

console.warn = (...args) => {
  captureLog('warn', args);
  originalConsole.warn(...args);
};

console.error = (...args) => {
  captureLog('error', args);
  originalConsole.error(...args);
};

console.info = (...args) => {
  captureLog('info', args);
  originalConsole.info(...args);
};

console.debug = (...args) => {
  captureLog('debug', args);
  originalConsole.debug(...args);
};

export const DebugLogService = {
  getLogs(): LogEntry[] {
    return [...logs];
  },

  getLogsAsText(): string {
    return logs.map(entry => 
      `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.args}`
    ).join('\n');
  },

  getDebugReport(): string {
    const report: string[] = [];
    
    report.push('='.repeat(60));
    report.push('SMUTHUB DEBUG REPORT');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('='.repeat(60));
    report.push('');
    
    // Environment info
    report.push('--- ENVIRONMENT ---');
    report.push(`Platform: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`);
    report.push(`localStorage available: ${typeof localStorage !== 'undefined'}`);
    report.push(`crypto available: ${typeof crypto !== 'undefined'}`);
    report.push(`crypto.randomUUID available: ${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'}`);
    
    // SystemInfo check
    try {
      // @ts-ignore
      const si = typeof SystemInfo !== 'undefined' ? SystemInfo : (globalThis as any).SystemInfo;
      report.push(`SystemInfo available: ${!!si}`);
      if (si) {
        report.push(`SystemInfo.deviceId: ${si.deviceId || 'undefined'}`);
        report.push(`SystemInfo keys: ${Object.keys(si).join(', ')}`);
      }
    } catch (e) {
      report.push(`SystemInfo error: ${e}`);
    }
    report.push('');
    
    // LocalStorage dump
    report.push('--- LOCALSTORAGE ---');
    if (typeof localStorage !== 'undefined') {
      try {
        const keys = ['batoto:device_id', 'batoto:settings', 'batoto:favorites', 'batoto:history', 'batoto:filters'];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val) {
            const preview = val.length > 200 ? val.substring(0, 200) + '...' : val;
            report.push(`${key}: ${preview}`);
          } else {
            report.push(`${key}: (not set)`);
          }
        }
        report.push(`Total localStorage keys: ${localStorage.length}`);
      } catch (e) {
        report.push(`localStorage error: ${e}`);
      }
    } else {
      report.push('localStorage not available');
    }
    report.push('');
    
    // Console logs
    report.push('--- CONSOLE LOGS ---');
    report.push(`Total captured: ${logs.length}`);
    report.push('');
    
    // Show last 100 logs
    const recentLogs = logs.slice(-100);
    for (const entry of recentLogs) {
      const time = entry.timestamp.split('T')[1].split('.')[0];
      report.push(`[${time}] [${entry.level.toUpperCase().padEnd(5)}] ${entry.args}`);
    }
    
    report.push('');
    report.push('='.repeat(60));
    report.push('END OF DEBUG REPORT');
    report.push('='.repeat(60));
    
    return report.join('\n');
  },

  clear(): void {
    logs.length = 0;
  },

  count(): number {
    return logs.length;
  }
};

// Log startup
console.log('[DebugLog] Console capture initialized');
