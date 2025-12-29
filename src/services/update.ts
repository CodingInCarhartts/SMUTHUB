import { logCapture } from './debugLog';
import { SupabaseService } from './supabase';

// Storage helper for skip version (using native storage via StorageService pattern)
const SKIP_KEY = 'batoto:skipped_version';
let skippedVersionCache: string | null = null;

function getSkippedVersion(): string | null {
  return skippedVersionCache;
}

function setSkippedVersion(version: string): void {
  skippedVersionCache = version;
  try {
    if (
      typeof NativeModules !== 'undefined' &&
      NativeModules.NativeLocalStorageModule
    ) {
      NativeModules.NativeLocalStorageModule.setStorageItem(SKIP_KEY, version);
    }
  } catch (e) {
    // Ignore
  }
}

// Initialize from native storage on load
try {
  if (
    typeof NativeModules !== 'undefined' &&
    NativeModules.NativeLocalStorageModule
  ) {
    NativeModules.NativeLocalStorageModule.getStorageItem(
      SKIP_KEY,
      (value: string | null) => {
        skippedVersionCache = value;
      },
    );
  }
} catch (e) {
  // Ignore
}

const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export interface AppUpdate {
  version: string;
  isMandatory: boolean;
  releaseNotes: string;
}

export interface NativeAppUpdate {
  version: string;
  url: string;
  isMandatory: boolean;
  releaseNotes: string;
}

export const APP_VERSION = '1.0.6';

export const UpdateService = {
  /**
   * Fetch the latest update entry from Supabase
   */
  async getLatestUpdate(): Promise<AppUpdate | null> {
    try {
      const data = await SupabaseService.getAll<any>(
        'app_updates',
        '?select=version,is_mandatory,release_notes&order=created_at.desc&limit=1',
      );

      if (data && data.length > 0) {
        const row = data[0];
        return {
          version: row.version,
          isMandatory: !!row.is_mandatory,
          releaseNotes: row.release_notes || '',
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
   * Check if a newer version exists and hasn't been skipped
   */
  async checkUpdate(): Promise<AppUpdate | null> {
    const latest = await this.getLatestUpdate();
    if (!latest) return null;

    // Check if version is skipped
    const skipped = getSkippedVersion();
    if (skipped === latest.version && !latest.isMandatory) {
      log(`[UpdateService] Version ${latest.version} is skipped by user.`);
      return null;
    }

    if (this.compareVersions(latest.version, APP_VERSION) > 0) {
      log(
        `[UpdateService] New update found: ${latest.version} (Current: ${APP_VERSION})`,
      );
      return latest;
    }

    return null;
  },

  /**
   * Mark a version as skipped
   */
  skipVersion(version: string): void {
    setSkippedVersion(version);
    log(`[UpdateService] Skipping version ${version}`);
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
        '?select=version,download_url,is_mandatory,release_notes&order=created_at.desc&limit=1',
      );

      if (data && data.length > 0) {
        const latest = data[0];
        if (this.compareVersions(latest.version, currentVersion) > 0) {
          log(
            `[UpdateService] New native APK found: ${latest.version} (Current: ${currentVersion})`,
          );
          return {
            version: latest.version,
            url: latest.download_url,
            isMandatory: !!latest.is_mandatory,
            releaseNotes:
              latest.release_notes ||
              'New native features and performance improvements.',
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
      nativeUpdater.installUpdate(url);
    } else {
      logError('[UpdateService] NativeUpdaterModule not available');
    }
  },

  /**
   * Reload the Lynx bundle to apply the OTA update
   */
  async applyUpdate(): Promise<void> {
    log('[UpdateService] Applying update (reloading bundle)...');
    try {
      const runtime =
        typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
      if (runtime && runtime.reload) {
        runtime.reload();
      } else {
        logWarn(
          '[UpdateService] lynx.reload is not available in this environment',
        );
        // If we can't reload, the user will have to restart the app manually.
        // We notify them via the UI (handled in the Modal).
      }
    } catch (e) {
      logError('[UpdateService] Reload failed:', e);
    }
  },
};
