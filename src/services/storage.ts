import type { Manga, SearchFilters } from './batoto/types';
import { logCapture } from './debugLog';
import { SupabaseService } from './supabase';

// Helper to log with capture (console override doesn't work in Lynx)
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

// Types
export interface ViewedManga {
  manga: Manga;
  lastChapterId?: string;
  lastChapterTitle?: string;
  viewedAt: string;
}

export interface AppSettings {
  readingMode: 'vertical' | 'horizontal';
  darkMode: boolean;
  devMode: boolean;
  remoteMode: boolean;
}

export interface ReaderPosition {
  mangaId: string;
  chapterUrl: string;
  panelIndex: number;
  scrollPosition?: number;
  timestamp: string;
}

const STORAGE_KEYS = {
  FAVORITES: 'batoto:favorites',
  HISTORY: 'batoto:history',
  SETTINGS: 'batoto:settings',
  FILTERS: 'batoto:filters',
  DEVICE_ID: 'batoto:device_id',
  READER_POSITION: 'batoto:reader_position',
};

const DEFAULT_SETTINGS: AppSettings = {
  readingMode: 'vertical',
  darkMode: false,
  devMode: false,
  remoteMode: false,
};

const HISTORY_LIMIT_LOCAL = 50;
const HISTORY_LIMIT_CLOUD = 999;

// In-memory fallback and cache
const memoryStorage = new Map<string, string>();
let NATIVE_DEVICE_ID: string | null = null;

// Immediate startup log
// log('[Storage] Module loading, checking native storage...');

// Check if native module is available
function hasNativeStorage(): boolean {
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
function getNativeItem(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const nativeModule = NativeModules?.NativeLocalStorageModule;
      if (nativeModule && typeof nativeModule.getStorageItem === 'function') {
        nativeModule.getStorageItem(key, (value) => {
          log('[getNativeItem] Got value:', {
            key,
            value: value?.substring?.(0, 50),
          });
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

// Helper for storage - tries localStorage first, then memory cache
function getLocal<T>(key: string, defaultValue: T): T {
  // First check memory cache (populated by async native loads)
  const cached = memoryStorage.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return defaultValue;
    }
  }

  // Try localStorage (won't work in Lynx but kept for web dev)
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (e) {
    // Ignore
  }

  return defaultValue;
}

function setLocal<T>(key: string, value: T): void {
  const strValue = JSON.stringify(value);

  // Always update memory cache
  memoryStorage.set(key, strValue);

  // Try localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, strValue);
    }
  } catch (e) {
    // Ignore
  }

  // Also save to native storage
  setNativeItem(key, strValue);
}

// Initialize device ID from native storage on startup
async function initializeFromNativeStorage(): Promise<void> {
  log('[Storage] initializeFromNativeStorage starting...');

  if (!hasNativeStorage()) {
    log('[Storage] Native storage not available, skipping init');
    return;
  }

  // Debug: View available modules
  log('[Storage] Available NativeModules:', Object.keys(NativeModules || {}));

  // Pre-fetch device ID from NativeUtilsModule
  try {
    const modules = (NativeModules as any);
    const utilsModule = modules?.NativeUtilsModule;
    log('[Storage] Checking NativeUtilsModule:', { 
      exists: !!utilsModule, 
      hasGetDeviceId: typeof utilsModule?.getDeviceId === 'function' 
    });

    if (utilsModule && typeof utilsModule.getDeviceId === 'function') {
      NATIVE_DEVICE_ID = await new Promise((resolve) => {
        log('[Storage] Calling native getDeviceId...');
        utilsModule.getDeviceId((id: string) => {
          log('[Storage] Fetched native device ID success:', id);
          // If we previously generated a temp UUID, we should overwrite it in SharedPreferences
          // but ONLY if the native ID is valid.
          if (id && id.length > 5) {
            setNativeItem(STORAGE_KEYS.DEVICE_ID, id);
          }
          resolve(id);
        });
        // Timeout just in case
        setTimeout(() => {
          logWarn('[Storage] Native getDeviceId timed out after 2s');
          resolve(null);
        }, 2000);
      });
    }
  } catch (e) {
    logError('[Storage] Failed to fetch native device ID:', e);
  }

  log('[Storage] Loading from native storage...');

  const keys = [
    STORAGE_KEYS.DEVICE_ID,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.FAVORITES,
    STORAGE_KEYS.HISTORY,
    STORAGE_KEYS.FILTERS,
    STORAGE_KEYS.READER_POSITION,
  ];

  for (const key of keys) {
    try {
      const value = await getNativeItem(key);
      if (value) {
        memoryStorage.set(key, value);
        log('[Storage] Loaded from native:', {
          key,
          hasValue: true,
          preview: value.substring(0, 30),
        });
      } else {
        log('[Storage] No value in native for:', key);
      }
    } catch (e) {
      logError('[Storage] Failed to load key:', key, e);
    }
  }

  log('[Storage] Native storage initialization complete');
}

// Export initialization promise so other modules can wait
export const storageReady = (async () => {
  try {
    // 1. Core Native Init
    await initializeFromNativeStorage();
    
    // 2. Data Migration (Legacy -> Cloud)
    const { MigrationService } = await import('./migration');
    await MigrationService.run();
    
    // 3. Initial Cloud Sync
    // We do one quick fetch of settings to ensure we have terbaru
    await StorageService.getSettings();
    
    log('[Storage] System is READY');
  } catch (e) {
    logError('[Storage] Initialization sequence failed:', e);
  }
})();

// Storage Service - Hybrid (Local First + Background Sync via REST)
export const StorageService = {
  // ============ DEVICE ID ============

  getDeviceId(): string {
    // 1. Prioritize Real Native Device ID (fetched during init)
    if (NATIVE_DEVICE_ID && NATIVE_DEVICE_ID.length > 5 && NATIVE_DEVICE_ID !== 'android') {
      return NATIVE_DEVICE_ID;
    }

    // 2. Check LocalStorage next for a persistent ID
    const id = getLocal<string | null>(STORAGE_KEYS.DEVICE_ID, null);
    log('[Storage] getDeviceId - LocalStorage check:', {
      key: STORAGE_KEYS.DEVICE_ID,
      found: id,
      type: typeof id,
    });

    if (id && typeof id === 'string' && id.length > 5) {
      log('[Storage] getDeviceId - Using stored ID:', id);
      return id;
    }

    // 2. Check SystemInfo, but only use it if it's not a generic/malformed ID
    try {
      const si =
        typeof SystemInfo !== 'undefined'
          ? SystemInfo
          : (globalThis as any).SystemInfo;
      log('[Storage] getDeviceId - SystemInfo check:', {
        available: !!si,
        deviceId: si?.deviceId,
      });
      if (
        si &&
        si.deviceId &&
        si.deviceId.length > 5 &&
        si.deviceId !== 'undefined' &&
        si.deviceId !== 'android'
      ) {
        setLocal(STORAGE_KEYS.DEVICE_ID, si.deviceId);
        log('[Storage] getDeviceId - Using SystemInfo ID:', si.deviceId);
        return si.deviceId;
      }
    } catch (e) {
      logWarn('[Storage] SystemInfo check failed:', e);
    }

    // 3. Generate a fresh UUID if nothing else is found
    // If we're on a native-capable device, we'd prefer to wait for NATIVE_DEVICE_ID,
    // but this function is sync. So we generate a temp one but DON'T save it permanently
    // to Native Storage yet if we are still initializing.
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    // Only save permanently to LocalStorage/Native if we are NOT on a hardware-capable device
    // OR if we've determined native ID fetch is truly impossible.
    if (!hasNativeStorage()) {
      setLocal(STORAGE_KEYS.DEVICE_ID, newId);
      log('[Storage] Generated & SAVED NEW Device ID (web/fallback):', newId);
    } else {
      log('[Storage] ⚠️ Generated TEMPORARY Device ID (still waiting for native?):', newId);
    }
    
    return newId;
  },

  setDeviceId(id: string): void {
    if (id && id.length > 5) {
      setLocal(STORAGE_KEYS.DEVICE_ID, id);
      log('[Storage] Device ID manually updated to:', id);
    }
  },

  // ============ FAVORITES ============

  async getFavorites(): Promise<Manga[]> {
    // 1. Immediate Return from Cache
    const local = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    
    // 2. Background Sync
    (async () => {
      const deviceId = this.getDeviceId();
      const cloudData = await SupabaseService.getAll<{ manga_data: Manga }>(
        'favorites',
        `?select=manga_data&device_id=eq.${deviceId}&order=created_at.desc`,
      );
      if (cloudData.length > 0) {
        const favorites = cloudData.map((row) => row.manga_data);
        setLocal(STORAGE_KEYS.FAVORITES, favorites);
        // We could trigger a listener here if needed
      }
    })();

    return local;
  },

  async addFavorite(manga: Manga): Promise<void> {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    if (!favorites.find((m) => m.id === manga.id)) {
      favorites.unshift(manga);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
    }

    const { SyncEngine } = await import('./sync');
    await SyncEngine.enqueue({
      type: 'UPSERT',
      table: 'favorites',
      payload: {
        device_id: this.getDeviceId(),
        manga_id: manga.id,
        manga_data: manga,
        created_at: new Date().toISOString()
      },
      timestamp: Date.now()
    });
  },

  async removeFavorite(mangaId: string): Promise<void> {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    setLocal(
      STORAGE_KEYS.FAVORITES,
      favorites.filter((m) => m.id !== mangaId),
    );

    const { SyncEngine } = await import('./sync');
    await SyncEngine.enqueue({
      type: 'DELETE',
      table: 'favorites',
      payload: {
        device_id: this.getDeviceId(),
        manga_id: mangaId
      },
      timestamp: Date.now()
    });
  },

  isFavoriteSync(mangaId: string): boolean {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    return favorites.some((m) => m.id === mangaId);
  },

  async isFavorite(mangaId: string): Promise<boolean> {
    return this.isFavoriteSync(mangaId);
  },

  // ============ HISTORY ============

  async getHistory(): Promise<ViewedManga[]> {
    const local = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    
    (async () => {
      const deviceId = this.getDeviceId();
      const cloudData = await SupabaseService.getAll<any>(
        'history',
        `?select=manga_data,last_chapter_id,last_chapter_title,viewed_at&device_id=eq.${deviceId}&order=viewed_at.desc&limit=${HISTORY_LIMIT_CLOUD}`,
      );
      if (cloudData.length > 0) {
        const history = cloudData.map((row: any) => ({
          manga: row.manga_data,
          lastChapterId: row.last_chapter_id,
          lastChapterTitle: row.last_chapter_title,
          viewedAt: row.viewed_at,
        }));
        setLocal(STORAGE_KEYS.HISTORY, history.slice(0, HISTORY_LIMIT_LOCAL));
      }
    })();

    return local;
  },

  async addToHistory(
    manga: Manga,
    chapterId?: string,
    chapterTitle?: string,
  ): Promise<void> {
    let history = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    history = history.filter((h) => h.manga.id !== manga.id);
    history.unshift({
      manga,
      lastChapterId: chapterId,
      lastChapterTitle: chapterTitle,
      viewedAt: new Date().toISOString(),
    });
    setLocal(STORAGE_KEYS.HISTORY, history.slice(0, HISTORY_LIMIT_LOCAL));

    const { SyncEngine } = await import('./sync');
    await SyncEngine.enqueue({
      type: 'UPSERT',
      table: 'history',
      payload: {
        device_id: this.getDeviceId(),
        manga_id: manga.id,
        manga_data: manga,
        last_chapter_id: chapterId,
        last_chapter_title: chapterTitle,
        viewed_at: new Date().toISOString(),
      },
      timestamp: Date.now()
    });
  },

  async clearHistory(): Promise<void> {
    const deviceId = this.getDeviceId();
    setLocal(STORAGE_KEYS.HISTORY, []);
    
    const { SyncEngine } = await import('./sync');
    await SyncEngine.enqueue({
      type: 'DELETE',
      table: 'history',
      payload: { device_id: deviceId },
      timestamp: Date.now()
    });
  },

  // ============ SETTINGS ============

  async getSettings(): Promise<AppSettings> {
    const local = getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    
    (async () => {
      const deviceId = this.getDeviceId();
      const cloudData = await SupabaseService.getAll<any>(
        'settings',
        `?select=reading_mode,dark_mode,dev_mode,remote_mode&device_id=eq.${deviceId}`,
      );
      if (cloudData && cloudData.length > 0) {
        const row = cloudData[0];
        const settings: AppSettings = {
          readingMode: (row.reading_mode as any) || DEFAULT_SETTINGS.readingMode,
          darkMode: row.dark_mode ?? DEFAULT_SETTINGS.darkMode,
          devMode: row.dev_mode ?? DEFAULT_SETTINGS.devMode,
          remoteMode: row.remote_mode ?? DEFAULT_SETTINGS.remoteMode,
        };
        setLocal(STORAGE_KEYS.SETTINGS, settings);
      }
    })();

    return local;
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...settings };
    setLocal(STORAGE_KEYS.SETTINGS, updated);

    const { SyncEngine } = await import('./sync');
    await SyncEngine.enqueue({
      type: 'UPSERT',
      table: 'settings',
      payload: {
        device_id: this.getDeviceId(),
        reading_mode: updated.readingMode,
        dark_mode: updated.darkMode,
        dev_mode: updated.devMode,
        remote_mode: updated.remoteMode,
        updated_at: new Date().toISOString()
      },
      timestamp: Date.now()
    });
  },

  getSettingsSync(): AppSettings {
    return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  // ============ FILTERS ============

  getLastFilters(): SearchFilters | null {
    return getLocal<SearchFilters | null>(STORAGE_KEYS.FILTERS, null);
  },

  saveFilters(filters: SearchFilters): void {
    setLocal(STORAGE_KEYS.FILTERS, filters);
  },

  clearFilters(): void {
    memoryStorage.delete(STORAGE_KEYS.FILTERS);
    setNativeItem(STORAGE_KEYS.FILTERS, '');
  },

  // ============ READER POSITION ============

  saveReaderPosition(
    mangaId: string,
    chapterUrl: string,
    panelIndex: number,
    scrollPosition?: number,
  ): void {
    const position: ReaderPosition = {
      mangaId,
      chapterUrl,
      panelIndex,
      scrollPosition,
      timestamp: new Date().toISOString(),
    };
    setLocal(STORAGE_KEYS.READER_POSITION, position);
    
    (async () => {
      const { SyncEngine } = await import('./sync');
      await SyncEngine.enqueue({
        type: 'UPSERT',
        table: 'reader_positions',
        payload: {
          device_id: this.getDeviceId(),
          manga_id: mangaId,
          chapter_url: chapterUrl,
          panel_index: panelIndex,
          updated_at: position.timestamp,
        },
        timestamp: Date.now()
      });
    })();
  },

  async getReaderPositionForManga(mangaId: string): Promise<ReaderPosition | null> {
    const local = this.getReaderPosition();
    if (local && local.mangaId === mangaId) return local;

    try {
      const deviceId = this.getDeviceId();
      const data = await SupabaseService.getAll<any>(
        'reader_positions',
        `?select=chapter_url,panel_index,updated_at&device_id=eq.${deviceId}&manga_id=eq.${mangaId}&limit=1`
      );

      if (data && data.length > 0) {
        const row = data[0];
        return {
          mangaId,
          chapterUrl: row.chapter_url,
          panelIndex: Number(row.panel_index),
          timestamp: row.updated_at,
        };
      }
    } catch (e) {
      logError('[Storage] Failed to fetch reader position from cloud:', e);
    }

    return null;
  },

  getReaderPosition(): ReaderPosition | null {
    return getLocal<ReaderPosition | null>(STORAGE_KEYS.READER_POSITION, null);
  },

  clearReaderPosition(): void {
    memoryStorage.delete(STORAGE_KEYS.READER_POSITION);
    setNativeItem(STORAGE_KEYS.READER_POSITION, '');
  },

  // ============ CLEAR ALL ============

  async clearAllData(): Promise<void> {
    try {
      const deviceId = this.getDeviceId();
      memoryStorage.clear();
      await this.clearHistory();
      
      const { SyncEngine } = await import('./sync');
      await SyncEngine.enqueue({
        type: 'DELETE',
        table: 'favorites',
        payload: { device_id: deviceId },
        timestamp: Date.now()
      });
    } catch (e) {
      logWarn('[Storage] clearAllData failed:', e);
    }
  },
};
