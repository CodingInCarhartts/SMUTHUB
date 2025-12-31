import { logCapture } from './debugLog';

// Helper to log with capture
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

// Check if native module is available
export function hasNativeStorage(): boolean {
  try {
    const hasMods = typeof NativeModules !== 'undefined';
    const hasStorageMod =
      hasMods && !!NativeModules.NativeLocalStorageModule;
    log('[Storage] hasNativeStorage check:', { hasMods, hasStorageMod });
    return hasStorageMod;
  } catch (e) {
    logError('[Storage] hasNativeStorage error:', e);
    return false;
  }
}

// Async getter using native module
export function getNativeItem(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const nativeModule = NativeModules?.NativeLocalStorageModule;
      if (nativeModule && typeof nativeModule.getStorageItem === 'function') {
        nativeModule.getStorageItem(key, (value: string | null) => {
          log('[getNativeItem] Got value for:', key);
          resolve(value);
        });
      } else {
        resolve(null);
      }
    } catch (e) {
      logError('[getNativeItem] Error:', e);
      resolve(null);
    }
  });
}

// Sync setter using native module (fire and forget)
export function setNativeItem(key: string, value: string): void {
  try {
    const nativeModule = NativeModules?.NativeLocalStorageModule;
    if (nativeModule && typeof nativeModule.setStorageItem === 'function') {
      nativeModule.setStorageItem(key, value);
      log('[setNativeItem] Saved:', { key, valueLen: value.length });
    }
  } catch (e) {
    logError('[setNativeItem] Error:', e);
  }
}

// Export for SyncEngine
export async function getNativeItemSync(key: string): Promise<string | null> {
  return await getNativeItem(key);
}
export function setNativeItemSync(key: string, value: string): void {
  setNativeItem(key, value);
}
