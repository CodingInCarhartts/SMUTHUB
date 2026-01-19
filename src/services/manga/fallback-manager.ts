import { logCapture } from '../debugLog';
import { type FallbackStatus, SOURCE_CONFIG, type SourceHealth } from './types';

const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export class FallbackManager {
  private static instance: FallbackManager;
  private activeSource: string = 'batoto';
  private sourceHealth: Map<string, SourceHealth> = new Map();
  private cooldownPeriod: number = 60000; // 1 minute cooldown after failure
  private maxRetries: number = 3;
  private backoffBase: number = 1000; // Start with 1s backoff

  private constructor() {
    this.initializeSourceHealth();
  }

  public static getInstance(): FallbackManager {
    if (!FallbackManager.instance) {
      FallbackManager.instance = new FallbackManager();
    }
    return FallbackManager.instance;
  }

  private initializeSourceHealth(): void {
    Object.keys(SOURCE_CONFIG).forEach((source) => {
      if (!this.sourceHealth.has(source)) {
        this.sourceHealth.set(source, {
          source,
          healthy: true,
          successRate: 100,
          requestCount: 0,
          errorCount: 0,
        });
      }
    });
  }

  public getActiveSource(): string {
    return this.activeSource;
  }

  public setActiveSource(source: string): void {
    if (SOURCE_CONFIG[source]) {
      log(`[Fallback] Setting active source to: ${source}`);
      this.activeSource = source;
    } else {
      logError(`[Fallback] Invalid source: ${source}`);
    }
  }

  public markRequestStart(source: string): void {
    const health = this.sourceHealth.get(source);
    if (health) {
      health.requestCount++;
      this.sourceHealth.set(source, health);
    }
  }

  public markRequestSuccess(source: string): void {
    const health = this.sourceHealth.get(source);
    if (health) {
      const successCount = health.requestCount - health.errorCount;
      health.successRate =
        health.requestCount > 0
          ? (successCount / health.requestCount) * 100
          : 100;
      health.healthy = true;
      health.lastSuccessTime = new Date();

      if (health.errorCount > 0) {
        health.errorCount--;
      }

      this.sourceHealth.set(source, health);
      log(
        `[Fallback] ${source} request succeeded. Success rate: ${health.successRate.toFixed(1)}%`,
      );
    }
  }

  public markRequestFailure(source: string, error?: Error): void {
    const health = this.sourceHealth.get(source);
    if (health) {
      health.errorCount++;
      health.healthy = false;
      health.successRate =
        ((health.requestCount - health.errorCount) / health.requestCount) * 100;
      this.sourceHealth.set(source, health);

      logError(
        `[Fallback] ${source} request failed. Error count: ${health.errorCount}, Success rate: ${health.successRate.toFixed(1)}%`,
        error,
      );

      // If this is the active source, try to find a better one
      if (this.activeSource === source) {
        this.rotateSource();
      }
    }
  }

  public rotateSource(): void {
    const availableSources = this.getAvailableSources();

    if (availableSources.length === 0) {
      logError('[Fallback] No healthy sources available!');
      return;
    }

    if (
      availableSources.length === 1 &&
      availableSources[0] === this.activeSource
    ) {
      logWarn('[Fallback] Only one source available, keeping current');
      return;
    }

    // Find the best source (not the current one if possible)
    const bestSource =
      availableSources
        .filter((s) => s !== this.activeSource)
        .sort((a, b) => {
          const healthA = this.sourceHealth.get(a)!;
          const healthB = this.sourceHealth.get(b)!;
          return healthB.successRate - healthA.successRate;
        })[0] || availableSources[0];

    log(`[Fallback] Rotating from ${this.activeSource} to ${bestSource}`);
    this.activeSource = bestSource;
  }

  public getAvailableSources(): string[] {
    return Array.from(this.sourceHealth.entries())
      .filter(([_, health]) => {
        // Consider source available if success rate > 50% or hasn't failed too many times
        return (
          health.healthy || (health.successRate > 50 && health.errorCount < 10)
        );
      })
      .map(([source, _]) => source)
      .sort((a, b) => {
        // Sort by priority, then by success rate
        const priorityA = SOURCE_CONFIG[a]?.priority || 999;
        const priorityB = SOURCE_CONFIG[b]?.priority || 999;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        const healthA = this.sourceHealth.get(a)!;
        const healthB = this.sourceHealth.get(b)!;
        return healthB.successRate - healthA.successRate;
      });
  }

  public getSourceHealth(source: string): SourceHealth | undefined {
    return this.sourceHealth.get(source);
  }

  public getAllSourceHealth(): Record<string, SourceHealth> {
    const result: Record<string, SourceHealth> = {};
    this.sourceHealth.forEach((health, source) => {
      result[source] = health;
    });
    return result;
  }

  public getStatus(): FallbackStatus {
    return {
      activeSource: this.activeSource,
      availableSources: this.getAvailableSources(),
      sourceHealth: this.getAllSourceHealth(),
    };
  }

  public resetSource(source: string): void {
    const config = SOURCE_CONFIG[source];
    if (config) {
      this.sourceHealth.set(source, {
        source,
        healthy: true,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
      });
      log(`[Fallback] Reset source: ${source}`);
    }
  }

  public resetAllSources(): void {
    Object.keys(SOURCE_CONFIG).forEach((source) => {
      this.resetSource(source);
    });
    log('[Fallback] Reset all sources');
  }
}
