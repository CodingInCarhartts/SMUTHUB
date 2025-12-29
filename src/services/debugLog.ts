// Debug Log Capture Service
// Captures console output for viewing in production app

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string;
}

const MAX_LOGS = 500;

// Store logs on globalThis so they persist across module instances (Lynx can isolate modules)
const globalLogs = ((globalThis as any).__DEBUG_LOGS__ =
  (globalThis as any).__DEBUG_LOGS__ || []);
const logs: LogEntry[] = globalLogs;

// Get the actual console object (may differ in Lynx)
const targetConsole = globalThis.console || console;

// Store original console methods
const originalConsole = {
  log: targetConsole.log?.bind(targetConsole),
  warn: targetConsole.warn?.bind(targetConsole),
  error: targetConsole.error?.bind(targetConsole),
  info: targetConsole.info?.bind(targetConsole),
  debug: targetConsole.debug?.bind(targetConsole),
};

function formatArgs(args: any[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
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

// Direct capture function that doesn't rely on console override
export function logCapture(level: LogEntry['level'], ...args: any[]) {
  captureLog(level, args);
  if (originalConsole[level]) {
    originalConsole[level](...args);
  }
}

// Override console methods on both local and global
const overrideConsole = (target: any) => {
  target.log = (...args: any[]) => {
    captureLog('log', args);
    originalConsole.log?.(...args);
  };

  target.warn = (...args: any[]) => {
    captureLog('warn', args);
    originalConsole.warn?.(...args);
  };

  target.error = (...args: any[]) => {
    captureLog('error', args);
    originalConsole.error?.(...args);
  };

  target.info = (...args: any[]) => {
    captureLog('info', args);
    originalConsole.info?.(...args);
  };

  target.debug = (...args: any[]) => {
    captureLog('debug', args);
    originalConsole.debug?.(...args);
  };
};

// Override on both console and globalThis.console
overrideConsole(console);
if (globalThis.console && globalThis.console !== console) {
  overrideConsole(globalThis.console);
}

// Add an immediate test log to verify capture is working
captureLog('info', [
  '[DebugLog] Console capture initialized at',
  new Date().toISOString(),
]);

export const DebugLogService = {
  getLogs(): LogEntry[] {
    return [...logs];
  },

  getLogsAsText(): string {
    return logs
      .map(
        (entry) =>
          `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.args}`,
      )
      .join('\n');
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
    report.push(
      `Platform: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
    );
    report.push(
      `localStorage available: ${typeof localStorage !== 'undefined'}`,
    );
    report.push(`crypto available: ${typeof crypto !== 'undefined'}`);
    report.push(
      `crypto.randomUUID available: ${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'}`,
    );

    // SystemInfo check
    try {
      const si =
        typeof SystemInfo !== 'undefined'
          ? SystemInfo
          : (globalThis as any).SystemInfo;
      report.push(`SystemInfo available: ${!!si}`);
      if (si) {
        report.push(`SystemInfo.deviceId: ${si.deviceId || 'undefined'}`);
        report.push(`SystemInfo keys: ${Object.keys(si).join(', ')}`);
      }
    } catch (e) {
      report.push(`SystemInfo error: ${e}`);
    }

    // NativeModules check
    try {
      const hasNative = typeof NativeModules !== 'undefined';
      report.push(`NativeModules available: ${hasNative}`);
      if (hasNative) {
        const hasStorage = NativeModules.NativeLocalStorageModule !== undefined;
        report.push(`NativeLocalStorageModule available: ${hasStorage}`);
      }
    } catch (e) {
      report.push(`NativeModules error: ${e}`);
    }
    report.push('');

    // LocalStorage dump
    report.push('--- LOCALSTORAGE ---');
    if (typeof localStorage !== 'undefined') {
      try {
        const keys = [
          'batoto:device_id',
          'batoto:settings',
          'batoto:favorites',
          'batoto:history',
          'batoto:filters',
        ];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val) {
            const preview =
              val.length > 200 ? val.substring(0, 200) + '...' : val;
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
      report.push(
        `[${time}] [${entry.level.toUpperCase().padEnd(5)}] ${entry.args}`,
      );
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
  },
};

// Log startup
console.log('[DebugLog] Console capture initialized');
