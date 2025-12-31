/**
 * Performance Monitoring Service
 * Tracks battery, memory, and operation durations to identify hotspots.
 */

import { logCapture } from './debugLog';

// Helper to log with capture
const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

// ============================================================
// Types
// ============================================================

export interface BatteryStatus {
  level: number;       // 0-100, or -1 if unavailable
  isCharging: boolean;
  temperature: number; // Celsius
}

export interface MemoryInfo {
  usedMb: number;
  maxMb: number;
  pssMb: number;       // Process-specific memory
}

export interface PerfSnapshot {
  timestamp: number;
  battery: BatteryStatus;
  memory: MemoryInfo;
}

interface OperationTimer {
  name: string;
  startTime: number;
}

// ============================================================
// State
// ============================================================

const snapshots: PerfSnapshot[] = [];
const MAX_SNAPSHOTS = 100;
const activeTimers: Map<string, OperationTimer> = new Map();

// ============================================================
// Native Bridge Wrappers
// ============================================================

function getBatteryStatus(): Promise<BatteryStatus> {
  return new Promise((resolve) => {
    try {
      const utilsModule = (NativeModules as any)?.NativeUtilsModule;
      if (utilsModule && typeof utilsModule.getBatteryStatus === 'function') {
        utilsModule.getBatteryStatus((json: string) => {
          try {
            resolve(JSON.parse(json));
          } catch {
            resolve({ level: -1, isCharging: false, temperature: 0 });
          }
        });
      } else {
        resolve({ level: -1, isCharging: false, temperature: 0 });
      }
    } catch {
      resolve({ level: -1, isCharging: false, temperature: 0 });
    }
  });
}

function getMemoryInfo(): Promise<MemoryInfo> {
  return new Promise((resolve) => {
    try {
      const utilsModule = (NativeModules as any)?.NativeUtilsModule;
      if (utilsModule && typeof utilsModule.getMemoryInfo === 'function') {
        utilsModule.getMemoryInfo((json: string) => {
          try {
            resolve(JSON.parse(json));
          } catch {
            resolve({ usedMb: 0, maxMb: 0, pssMb: 0 });
          }
        });
      } else {
        resolve({ usedMb: 0, maxMb: 0, pssMb: 0 });
      }
    } catch {
      resolve({ usedMb: 0, maxMb: 0, pssMb: 0 });
    }
  });
}

// ============================================================
// Performance Service
// ============================================================

export const PerformanceService = {
  /**
   * Take a snapshot of current battery and memory status
   */
  async snapshot(): Promise<PerfSnapshot> {
    const [battery, memory] = await Promise.all([
      getBatteryStatus(),
      getMemoryInfo(),
    ]);

    const snap: PerfSnapshot = {
      timestamp: Date.now(),
      battery,
      memory,
    };

    snapshots.push(snap);
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.shift();
    }

    const drainRate = this.calculateDrainRate();
    const drainMsg = drainRate !== null ? ` | Drain: ${drainRate.toFixed(2)}%/min` : '';

    log('[PERF] Snapshot:', JSON.stringify({
      battery: `${battery.level}%${battery.isCharging ? ' (charging)' : ''}${drainMsg}`,
      memory: `${memory.usedMb.toFixed(1)}MB / ${memory.maxMb.toFixed(1)}MB`,
    }));

    return snap;
  },

  /**
   * Get all recorded snapshots
   */
  getSnapshots(): PerfSnapshot[] {
    return [...snapshots];
  },

  /**
   * Get the latest snapshot without recording a new one
   */
  getLatest(): PerfSnapshot | null {
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  },

  /**
   * Start timing an operation
   */
  startTimer(operationName: string): void {
    activeTimers.set(operationName, {
      name: operationName,
      startTime: Date.now(),
    });
  },

  /**
   * End timing an operation and log the duration
   */
  endTimer(operationName: string): number {
    const timer = activeTimers.get(operationName);
    if (!timer) {
      logWarn(`[PERF] Timer not found: ${operationName}`);
      return 0;
    }

    const duration = Date.now() - timer.startTime;
    activeTimers.delete(operationName);

    // Log if operation took longer than expected
    if (duration > 1000) {
      logWarn(`[PERF] SLOW: ${operationName} took ${duration}ms`);
    } else {
      log(`[PERF] ${operationName}: ${duration}ms`);
    }

    return duration;
  },

  /**
   * Calculate battery drain rate from snapshots
   * Returns percentage per minute
   */
  calculateDrainRate(): number | null {
    const nonChargingSnaps = snapshots.filter(s => !s.battery.isCharging && s.battery.level >= 0);
    if (nonChargingSnaps.length < 2) return null;

    const first = nonChargingSnaps[0];
    const last = nonChargingSnaps[nonChargingSnaps.length - 1];
    const timeDiffMinutes = (last.timestamp - first.timestamp) / 60000;
    const levelDiff = first.battery.level - last.battery.level;

    if (timeDiffMinutes < 1) return null;

    return levelDiff / timeDiffMinutes;
  },

  /**
   * Get a summary report of performance metrics
   */
  getSummary(): string {
    const latest = this.getLatest();
    const drainRate = this.calculateDrainRate();

    const lines: string[] = [
      '--- PERFORMANCE SUMMARY ---',
    ];

    if (latest) {
      lines.push(`Battery: ${latest.battery.level}%${latest.battery.isCharging ? ' (charging)' : ''}`);
      lines.push(`Temperature: ${latest.battery.temperature}°C`);
      lines.push(`Memory: ${latest.memory.usedMb.toFixed(1)}MB / ${latest.memory.maxMb.toFixed(1)}MB`);
      lines.push(`PSS Memory: ${latest.memory.pssMb.toFixed(1)}MB`);
    }

    if (drainRate !== null) {
      lines.push(`Battery Drain: ${drainRate.toFixed(2)}%/min`);
      if (drainRate > 1) {
        lines.push('⚠️ HIGH BATTERY DRAIN DETECTED');
      }
    }

    lines.push(`Snapshots recorded: ${snapshots.length}`);
    lines.push('');

    return lines.join('\n');
  },

  /**
   * Clear all recorded data
   */
  clear(): void {
    snapshots.length = 0;
    activeTimers.clear();
  },
};

// Auto-snapshot every 60 seconds in background
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    PerformanceService.snapshot();
  }, 60000);
  
  // Take initial snapshot after 5 seconds
  setTimeout(() => {
    PerformanceService.snapshot();
  }, 5000);
}
