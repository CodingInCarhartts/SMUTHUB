// Debug Log Capture Service
// Captures console output for viewing in production app

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string;
}

const MAX_LOGS = 1000;

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

export interface DebugReportContext {
  settings?: any;
  storageValues?: Record<string, string | null>;
  supabaseStatus?: any;
  version?: string;
  deviceId?: string;
}

export interface StructuredDebugReport {
  app_version: string;
  device_id: string;
  environment_info: any;
  settings: any;
  supabase_status: any;
  storage_state: Record<string, string | null>;
  console_logs: LogEntry[];
  generated_at: string;
}

export type LogCategory =
  | 'INIT'
  | 'NETWORK'
  | 'SYNC'
  | 'UI'
  | 'STORAGE'
  | 'UPDATE'
  | 'PERF'
  | 'GENERAL';

export const DebugLogService = {
  /**
   * Log a message with a category prefix for better filtering
   */
  log(category: LogCategory, message: string, ...args: any[]): void {
    console.log(`[${category}] ${message}`, ...args);
  },

  /**
   * Log a warning with a category prefix
   */
  warn(category: LogCategory, message: string, ...args: any[]): void {
    console.warn(`[${category}] ${message}`, ...args);
  },

  /**
   * Log an error with a category prefix and optional error object
   */
  error(
    category: LogCategory,
    message: string,
    error?: Error,
    ...args: any[]
  ): void {
    console.error(`[${category}] ${message}`, error?.message || '', ...args);
    if (error?.stack) {
      console.error(`[${category}] Stack:`, error.stack);
    }
  },

  /**
   * Report an error with full context for debugging
   */
  reportError(category: LogCategory, context: string, error: Error): void {
    console.error(`[${category}] ERROR in ${context}:`, error.message);
    console.error(`[${category}] Stack:`, error.stack || 'N/A');
  },

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

  getStructuredReport(context?: DebugReportContext): StructuredDebugReport {
    return {
      app_version: context?.version || 'Unknown',
      device_id: context?.deviceId || 'Unknown',
      environment_info: {
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        localStorageAvailable: typeof localStorage !== 'undefined',
        cryptoAvailable: typeof crypto !== 'undefined',
        systemInfo:
          typeof SystemInfo !== 'undefined'
            ? SystemInfo
            : (globalThis as any).SystemInfo,
        nativeModules:
          typeof NativeModules !== 'undefined'
            ? Object.keys(NativeModules)
            : [],
      },
      settings: context?.settings || {},
      supabase_status: context?.supabaseStatus || {},
      storage_state: context?.storageValues || {},
      console_logs: logs,
      generated_at: new Date().toISOString(),
    };
  },

  getDebugReport(context?: DebugReportContext): string {
    const report: string[] = [];

    report.push('='.repeat(60));
    report.push('SMUTHUB DEBUG REPORT');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push(`Send to: yumlabs.team@gmail.com`);
    report.push('='.repeat(60));
    report.push('');

    // App Info
    report.push('--- APP INFO ---');
    report.push(`Version: ${context?.version || 'Unknown'}`);
    report.push(`Device ID: ${context?.deviceId || 'Unknown'}`);
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
        report.push(
          `NativeModules keys: ${Object.keys(NativeModules).join(', ')}`,
        );
        const hasStorage = NativeModules.NativeLocalStorageModule !== undefined;
        report.push(`NativeLocalStorageModule available: ${hasStorage}`);
      }
    } catch (e) {
      report.push(`NativeModules error: ${e}`);
    }
    report.push('');

    // Supabase Status
    report.push('--- SUPABASE STATUS ---');
    if (context?.supabaseStatus) {
      report.push(JSON.stringify(context.supabaseStatus, null, 2));
    } else {
      report.push('No specific status provided');
    }
    report.push('');

    // Settings
    report.push('--- SETTINGS ---');
    if (context?.settings) {
      report.push(JSON.stringify(context.settings, null, 2));
    } else {
      report.push('Settings not provided');
    }
    report.push('');

    // LocalStorage dump
    report.push('--- LOCALSTORAGE ---');
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const val = localStorage.getItem(key);
            const preview =
              val && val.length > 200 ? val.substring(0, 200) + '...' : val;
            report.push(`${key}: ${preview}`);
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

    // Native Storage Values
    report.push('--- NATIVE STORAGE ---');
    if (context?.storageValues) {
      for (const [key, val] of Object.entries(context.storageValues)) {
        const preview =
          val && val.length > 200 ? val.substring(0, 200) + '...' : val;
        report.push(`${key}: ${preview || '(null/empty)'}`);
      }
    } else {
      report.push('Native storage values not provided');
    }
    report.push('');

    // Console logs
    report.push('--- CONSOLE LOGS ---');
    report.push(`Total captured: ${logs.length}`);
    report.push('');

    // Show last 500 logs
    const recentLogs = logs.slice(-500);
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
