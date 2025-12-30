import { logCapture } from './debugLog';
import { SupabaseService } from './supabase';
import { StorageService, storageReady } from './storage';

let storageInitialized = false;
let resolveStorageReady: () => void;
const storageReadyPromise = new Promise<void>((resolve) => {
  resolveStorageReady = resolve;
});

function markStorageReady() {
  if (storageInitialized) return;
  console.log('[UpdateService] Storage ready marked');
  storageInitialized = true;
  resolveStorageReady();
}

// Wait for global storage to be ready
storageReady.then(() => {
  console.log('[UpdateService] Global storage ready signal received');
  markStorageReady();
});

// Safety timeout: don't wait for storage more than 5 seconds
setTimeout(() => {
  if (!storageInitialized) {
    console.warn('[UpdateService] Storage init timed out, proceeding anyway');
    markStorageReady();
  }
}, 5000);

const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export interface AppUpdate {
  version: string;
  isMandatory: boolean;
  releaseNotes: string;
  forceImmediate: boolean;
  otaUrl?: string; // URL to the new lynx bundle
}

// Cooldown state for navigation-based checks
let lastCheckTimestamp = 0;
const CHECK_COOLDOWN_MS = 30 * 1000; // 30 seconds

export interface NativeAppUpdate {
  version: string;
  url: string;
  isMandatory: boolean;
  releaseNotes: string;
  forceImmediate: boolean;
}

export const APP_VERSION = '1.0.48';

export const UpdateService = {
  /**
   * Fetch the latest update entry from Supabase
   */
  async getLatestUpdate(): Promise<AppUpdate | null> {
    try {
      const data = await SupabaseService.getAll<any>(
        'app_updates',
        '?select=version,is_mandatory,force_immediate,release_notes&order=created_at.desc&limit=1',
      );

      if (data && data.length > 0) {
        const row = data[0];
        return {
          version: row.version,
          isMandatory: !!row.is_mandatory || !!row.force_immediate,
          releaseNotes: row.release_notes || '',
          forceImmediate: !!row.force_immediate,
          otaUrl:
            row.download_url ||
            'https://raw.githubusercontent.com/CodingInCarhartts/SMUTHUB/main/main.lynx.bundle',
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
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

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
   * Check if a newer version exists and hasn't been skipped.
   * Includes a cooldown to prevent spamming server during rapid navigation.
   */
  async checkUpdate(): Promise<AppUpdate | null> {
    // Wait for storage to be ready (so we have the skipped version)
    await storageReadyPromise;
    console.log('[UpdateService] Starting update check...');

    const now = Date.now();
    if (now - lastCheckTimestamp < CHECK_COOLDOWN_MS) {
      console.log(
        `[UpdateService] Skipping check (cooldown active: ${Math.round((CHECK_COOLDOWN_MS - (now - lastCheckTimestamp)) / 1000)}s left).`,
      );
      return null;
    }
    lastCheckTimestamp = now;

    console.log('[UpdateService] Fetching from Supabase (app_updates)...');
    const latest = await this.getLatestUpdate();
    if (!latest) {
      console.log('[UpdateService] No update data found in Supabase');
      return null;
    }
    console.log(`[UpdateService] Latest in DB: ${latest.version}`);

    // Check if version is skipped
    const skipped = StorageService.getSkippedVersion();
    if (skipped === latest.version && !latest.isMandatory) {
      console.log(`[UpdateService] Version ${latest.version} is skipped by user.`);
      return null;
    }

    const comparison = this.compareVersions(latest.version, APP_VERSION);
    console.log(
      `[UpdateService] Comparing ${latest.version} vs current ${APP_VERSION} => Result: ${comparison}`,
    );

    if (comparison > 0) {
      console.log('[UpdateService] NEW UPDATE FOUND!');
      return latest;
    }

    console.log('[UpdateService] App is up to date.');
    return null;
  },


  /**
   * Mark a version as skipped
   */
  skipVersion(version: string): void {
    log(`[UpdateService] Skipping version ${version}`);
    StorageService.setSkippedVersion(version);
  },

  /**
   * Check if a newer native APK version exists in Supabase
   */
  async checkNativeUpdate(): Promise<NativeAppUpdate | null> {
    try {
      const nativeUpdater =
        typeof NativeModules !== 'undefined'
          ? NativeModules.NativeUpdaterModule
          : null;
      if (!nativeUpdater) return null;

      const currentVersion = nativeUpdater.getNativeVersion();

      const data = await SupabaseService.getAll<any>(
        'app_native_updates',
        '?select=version,download_url,is_mandatory,force_immediate,release_notes&order=created_at.desc&limit=1',
      );

      if (data && data.length > 0) {
        const latest = data[0];
        if (this.compareVersions(latest.version, currentVersion) > 0) {
          log(
            `[UpdateService] New native APK found: ${latest.version} (URL: ${latest.download_url})`,
          );
          return {
            version: latest.version,
            url: latest.download_url,
            isMandatory: !!latest.is_mandatory || !!latest.force_immediate,
            releaseNotes:
              latest.release_notes ||
              'New native features and performance improvements.',
            forceImmediate: !!latest.force_immediate,
          };
        }
      }

    } catch (e) {
      logWarn('[UpdateService] Native update check failed:', e);
    }
    return null;
  },

  /**
   * Trigger the native APK installation flow
   */
  async installNativeUpdate(url: string): Promise<void> {
    log('[UpdateService] Triggering native APK install from:', url);
    const nativeUpdater =
      typeof NativeModules !== 'undefined'
        ? NativeModules.NativeUpdaterModule
        : null;
    if (nativeUpdater && nativeUpdater.installUpdate) {
      try {
        nativeUpdater.installUpdate(url);
      } catch (e) {
        logError('[UpdateService] Failed to trigger native update:', e);
      }
    } else {
      logError('[UpdateService] NativeUpdaterModule not available');
    }
  },

  /**
   * Exit the app immediately
   */
  exitApp(): void {
    log('[UpdateService] Exiting app...');
    try {
      const utils =
        typeof NativeModules !== 'undefined'
          ? NativeModules.NativeUtilsModule
          : null;
      if (utils && utils.exitApp) {
        utils.exitApp();
      } else {
        logWarn('[UpdateService] exitApp not available');
      }
    } catch (e) {
      logError('[UpdateService] Failed to exit app:', e);
    }
  },

  /**
   * Reload the Lynx bundle to apply the OTA update
   */
  async applyUpdate(update?: AppUpdate): Promise<void> {
    log('[UpdateService] Applying update...');
    try {
      const nativeUpdater =
        typeof NativeModules !== 'undefined'
          ? NativeModules.NativeUpdaterModule
          : null;

      if (update?.otaUrl && nativeUpdater && (nativeUpdater as any).setOtaUrl) {
        log(`[UpdateService] Setting remote OTA URL: ${update.otaUrl}`);
        (nativeUpdater as any).setOtaUrl(update.otaUrl);
        
        if ((nativeUpdater as any).triggerOtaReload) {
          (nativeUpdater as any).triggerOtaReload();
          return;
        }
      }

      // Fallback to standard reload
      log('[UpdateService] Falling back to standard lynx.reload()');
      const runtime =
        typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
      if (runtime && runtime.reload) {
        runtime.reload();
      } else {
        logWarn(
          '[UpdateService] lynx.reload is not available, falling back to exitApp',
        );
        this.exitApp();
      }
    } catch (e) {
      logError('[UpdateService] Reload failed:', e);
    }
  },
};
