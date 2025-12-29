import { SupabaseService } from './supabase';
import { logCapture } from './debugLog';

const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export interface AppUpdate {
  version: string;
  isMandatory: boolean;
  releaseNotes: string;
}

export const APP_VERSION = '1.0.3';

export const UpdateService = {
  /**
   * Fetch the latest update entry from Supabase
   */
  async getLatestUpdate(): Promise<AppUpdate | null> {
    try {
      const data = await SupabaseService.getAll<any>(
        'app_updates', 
        '?select=version,is_mandatory,release_notes&order=created_at.desc&limit=1'
      );
      
      if (data && data.length > 0) {
        const row = data[0];
        return {
          version: row.version,
          isMandatory: !!row.is_mandatory,
          releaseNotes: row.release_notes || ''
        };
      }
    } catch (e) {
      logWarn('[UpdateService] Failed to fetch updates:', e);
    }
    return null;
  },

  /**
   * Compare two semver strings
   * Returns: 
   *   1 if v1 > v2
   *  -1 if v1 < v2
   *   0 if v1 == v2
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
    
    const length = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < length; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  },

  /**
   * Check if a newer version exists and hasn't been skipped
   */
  async checkUpdate(): Promise<AppUpdate | null> {
    const latest = await this.getLatestUpdate();
    if (!latest) return null;

    // Check if version is skipped
    const skipped = typeof localStorage !== 'undefined' ? localStorage.getItem('batoto:skipped_version') : null;
    if (skipped === latest.version && !latest.isMandatory) {
      log(`[UpdateService] Version ${latest.version} is skipped by user.`);
      return null;
    }

    if (this.compareVersions(latest.version, APP_VERSION) > 0) {
      log(`[UpdateService] New update found: ${latest.version} (Current: ${APP_VERSION})`);
      return latest;
    }
    
    return null;
  },

  /**
   * Mark a version as skipped
   */
  skipVersion(version: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('batoto:skipped_version', version);
      log(`[UpdateService] Skipping version ${version}`);
    }
  },

  /**
   * Reload the Lynx bundle to apply the OTA update
   */
  async applyUpdate(): Promise<void> {
    log('[UpdateService] Applying update (reloading bundle)...');
    try {
      // @ts-ignore
      const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
      if (runtime && runtime.reload) {
        runtime.reload();
      } else {
        logWarn('[UpdateService] lynx.reload is not available in this environment');
        // If we can't reload, the user will have to restart the app manually.
        // We notify them via the UI (handled in the Modal).
      }
    } catch (e) {
      logError('[UpdateService] Reload failed:', e);
    }
  }
};
