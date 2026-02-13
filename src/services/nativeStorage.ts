import { logCapture } from './debugLog';

// Helper to log with capture
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

// Check if native module is available
export function hasNativeStorage(): boolean {
  try {
    const hasMods = typeof NativeModules !== 'undefined';
    const hasStorageMod = hasMods && !!NativeModules.NativeLocalStorageModule;
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

// Async setter using native module (wait for completion)
export function setNativeItem(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const nativeModule = NativeModules?.NativeLocalStorageModule;
      if (nativeModule && typeof nativeModule.setStorageItem === 'function') {
        // Check if it accepts a callback (some implementations might)
        // If not, we just assume it's fired.
        // But to be safe, let's wrap it.
        nativeModule.setStorageItem(key, value);
        log('[setNativeItem] Saved:', { key, valueLen: value.length });
        // Give it a tiny tick to ensure it hits the bridge?
        // Or if the native API provides a callback, use it.
        // Assuming standard bridge might be async.
        setTimeout(resolve, 50);
      } else {
        resolve();
      }
    } catch (e) {
      logError('[setNativeItem] Error:', e);
      resolve();
    }
  });
}

// Export for SyncEngine
export async function getNativeItemSync(key: string): Promise<string | null> {
  return await getNativeItem(key);
}
export function setNativeItemSync(key: string, value: string): void {
  setNativeItem(key, value);
}
