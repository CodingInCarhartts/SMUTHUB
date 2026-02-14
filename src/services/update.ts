import {
  DEFAULT_OTA_BUNDLE_URL,
  STORAGE_INIT_TIMEOUT_MS,
  UPDATE_CHECK_COOLDOWN_MS,
} from '../config';
import { logCapture } from './debugLog';
import { StorageService, storageReady } from './storage';
import { SupabaseService } from './supabase';

let storageInitialized = false;
let resolveStorageReady: () => void;
const storageReadyPromise = new Promise<void>((resolve) => {
  resolveStorageReady = resolve;
});

function markStorageReady() {
  if (storageInitialized) return;
  log('[UpdateService] Storage ready marked');
  storageInitialized = true;
  resolveStorageReady();
}

// Wait for global storage to be ready
storageReady.then(() => {
  log('[UpdateService] Global storage ready signal received');
  markStorageReady();
});

// Safety timeout: don't wait for storage more than configured time
setTimeout(() => {
  if (!storageInitialized) {
    console.warn('[UpdateService] Storage init timed out, proceeding anyway');
    markStorageReady();
  }
}, STORAGE_INIT_TIMEOUT_MS);

const log = (...args: any[]) => logCapture('log', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export interface AppUpdate {
  version: string;
  commitHash?: string;
  isMandatory: boolean;
  releaseNotes: string;
  forceImmediate: boolean;
  otaUrl?: string; // URL to the new lynx bundle
}

// Cooldown state for navigation-based checks
let lastCheckTimestamp = 0;

export interface NativeAppUpdate {
  version: string;
  url: string;
  isMandatory: boolean;
  releaseNotes: string;
  forceImmediate: boolean;
  commitHash?: string;
}

export const BUNDLE_VERSION = '1.0.268';
export const BUNDLE_COMMIT_HASH = 'c43d376'; // Will be injected by publish-ota.js

export const UpdateService = {
  /**
   * Fetch the latest update entry from Supabase
   */
  async getLatestUpdate(): Promise<AppUpdate | null> {
    try {
      const data = await SupabaseService.getAll<any>(
        'app_updates',
        '?select=version,commit_hash,is_mandatory,force_immediate,release_notes,download_url&order=created_at.desc&limit=1',
      );

      if (data && data.length > 0) {
        const row = data[0];
        return {
          version: row.version,
          commitHash: row.commit_hash || '',
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
    log('[UpdateService] Starting update check...');

    const now = Date.now();
    if (now - lastCheckTimestamp < UPDATE_CHECK_COOLDOWN_MS) {
      log(
        `[UpdateService] Skipping check (cooldown active: ${Math.round((UPDATE_CHECK_COOLDOWN_MS - (now - lastCheckTimestamp)) / 1000)}s left).`,
      );
      return null;
    }
    lastCheckTimestamp = now;

    log('[UpdateService] Fetching from Supabase (app_updates)...');
    const latest = await this.getLatestUpdate();
    if (!latest) {
      log('[UpdateService] No update data found in Supabase');
      return null;
    }
    log(
      `[UpdateService] Latest in DB: ${latest.version} (hash: ${latest.commitHash})`,
    );

    // LOOP PROTECTION:
    // If we just attempted this update (based on last_update_attempt)
    // AND our BUNDLE_COMMIT_HASH is still different (update didn't take),
    // then assume we downloaded a stale bundle and STOP.
    const lastAttempt = StorageService.getLastUpdateAttempt();
    if (
      lastAttempt &&
      lastAttempt === latest.commitHash &&
      latest.commitHash !== BUNDLE_COMMIT_HASH
    ) {
      console.warn(
        `[UpdateService] LOOP DETECTED! We already attempted update to ${lastAttempt} but are still on ${BUNDLE_COMMIT_HASH}. Aborting.`,
      );
      // Optional: Clear it if we want to retry later? No, wait for next version.
      // But if user manually forces via "Check Update" button, we might want to bypass?
      // For auto-check, definitely block.
      return null;
    }

    // If we are here, it means either:
    // 1. We haven't tried this update yet.
    // 2. We DID try it, and it SUCCEEDED (so BUNDLE matches LastAttempt).
    //    In case 2, we shouldn't be here if check below passes.

    // If successfully updated, clear the flag
    if (BUNDLE_COMMIT_HASH === lastAttempt) {
      StorageService.clearLastUpdateAttempt();
    }

    // Check if commit hash matches (primary check)
    if (latest.commitHash && latest.commitHash === BUNDLE_COMMIT_HASH) {
      log('[UpdateService] Commit hash matches. App is up to date.');
      return null;
    }

    // Check if version/hash is skipped
    const skipped = StorageService.getSkippedVersion();
    if (
      (skipped === latest.commitHash || skipped === latest.version) &&
      !latest.isMandatory
    ) {
      log(`[UpdateService] Version ${latest.version} is skipped by user.`);
      return null;
    }

    // If commit hash differs, there's an update
    if (latest.commitHash && latest.commitHash !== BUNDLE_COMMIT_HASH) {
      log(
        `[UpdateService] NEW UPDATE FOUND! Hash mismatch: ${latest.commitHash} vs ${BUNDLE_COMMIT_HASH}`,
      );
      return latest;
    }

    // Fallback to semver comparison for legacy entries without commit_hash
    const comparison = this.compareVersions(latest.version, BUNDLE_VERSION);
    log(
      `[UpdateService] Fallback semver compare: ${latest.version} vs ${BUNDLE_VERSION} => Result: ${comparison}`,
    );

    if (comparison > 0) {
      log('[UpdateService] NEW UPDATE FOUND (via semver fallback)!');
      return latest;
    }

    log('[UpdateService] App is up to date.');
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

        // LOOP PROTECTION: Mark this hash as attempted
        if (update.commitHash) {
          await StorageService.setLastUpdateAttempt(update.commitHash);
        }

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
