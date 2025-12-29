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
};

const HISTORY_LIMIT_LOCAL = 50;
const HISTORY_LIMIT_CLOUD = 999;

// In-memory fallback and cache
const memoryStorage = new Map<string, string>();

// Immediate startup log
log('[Storage] Module loading, checking native storage...');

// Check if native module is available
function hasNativeStorage(): boolean {
  try {
    const hasMods = typeof NativeModules !== 'undefined';
    const hasStorageMod =
      hasMods && NativeModules.NativeLocalStorageModule !== undefined;
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
      if (hasNativeStorage()) {
        NativeModules.NativeLocalStorageModule.getStorageItem(key, (value) => {
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
function setNativeItem(key: string, value: string): void {
  try {
    if (hasNativeStorage()) {
      NativeModules.NativeLocalStorageModule.setStorageItem(key, value);
      log('[setNativeItem] Saved:', { key, valueLen: value.length });
    }
  } catch (e) {
    logError('[setNativeItem] Error:', e);
  }
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
export const storageReady = initializeFromNativeStorage().catch((e) => {
  logError('[Storage] Initialization failed:', e);
});

// Storage Service - Hybrid (Local First + Background Sync via REST)
export const StorageService = {
  // ============ DEVICE ID ============

  getDeviceId(): string {
    // 1. Check LocalStorage first for a persistent ID
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
    // crypto.randomUUID fallback for environments without it
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

    setLocal(STORAGE_KEYS.DEVICE_ID, newId);
    log('[Storage] ⚠️ Generated NEW Device ID (nothing found):', newId);
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
    const deviceId = this.getDeviceId();
    const cloudData = await SupabaseService.getAll<{ manga_data: Manga }>(
      'favorites',
      `?select=manga_data&device_id=eq.${deviceId}&order=created_at.desc`,
    );

    if (cloudData.length > 0) {
      const favorites = cloudData.map((row) => row.manga_data);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
      return favorites;
    }

    return getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
  },

  async addFavorite(manga: Manga): Promise<void> {
    // Optimistic Update
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    if (!favorites.find((m) => m.id === manga.id)) {
      favorites.unshift(manga);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
    }

    // Sync to Cloud
    await SupabaseService.upsert(
      'favorites',
      {
        device_id: this.getDeviceId(),
        manga_id: manga.id,
        manga_data: manga,
      },
      'device_id,manga_id',
    );
    log('[Storage] Synced favorite to cloud:', manga.title);
  },

  async removeFavorite(mangaId: string): Promise<void> {
    // Optimistic Update
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    setLocal(
      STORAGE_KEYS.FAVORITES,
      favorites.filter((m) => m.id !== mangaId),
    );

    // Sync to Cloud
    const deviceId = this.getDeviceId();
    await SupabaseService.request(
      `/favorites?device_id=eq.${deviceId}&manga_id=eq.${mangaId}`,
      {
        method: 'DELETE',
      },
    );
    log('[Storage] Removed favorite from cloud:', mangaId);
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
    const deviceId = this.getDeviceId();
    // Try Cloud
    const cloudData = await SupabaseService.getAll<{
      manga_data: Manga;
      last_chapter_id: string;
      last_chapter_title: string;
      viewed_at: string;
    }>(
      'history',
      `?select=manga_data,last_chapter_id,last_chapter_title,viewed_at&device_id=eq.${deviceId}&order=viewed_at.desc&limit=${HISTORY_LIMIT_CLOUD}`,
    );

    if (cloudData.length > 0) {
      const history = cloudData.map((row) => ({
        manga: row.manga_data,
        lastChapterId: row.last_chapter_id,
        lastChapterTitle: row.last_chapter_title,
        viewedAt: row.viewed_at,
      }));
      setLocal(STORAGE_KEYS.HISTORY, history.slice(0, HISTORY_LIMIT_LOCAL)); // Cache only recent part locally
      return history;
    }

    return getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
  },

  async addToHistory(
    manga: Manga,
    chapterId?: string,
    chapterTitle?: string,
  ): Promise<void> {
    // Optimistic Update
    let history = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    history = history.filter((h) => h.manga.id !== manga.id);
    history.unshift({
      manga,
      lastChapterId: chapterId,
      lastChapterTitle: chapterTitle,
      viewedAt: new Date().toISOString(),
    });
    if (history.length > HISTORY_LIMIT_LOCAL) {
      history = history.slice(0, HISTORY_LIMIT_LOCAL);
    }
    setLocal(STORAGE_KEYS.HISTORY, history);

    // Sync to Cloud
    await SupabaseService.upsert(
      'history',
      {
        device_id: this.getDeviceId(),
        manga_id: manga.id,
        manga_data: manga,
        last_chapter_id: chapterId,
        last_chapter_title: chapterTitle,
        viewed_at: new Date().toISOString(),
      },
      'device_id,manga_id',
    );
  },

  async clearHistory(): Promise<void> {
    const deviceId = this.getDeviceId();
    setLocal(STORAGE_KEYS.HISTORY, []);
    // Delete only this device's history
    await SupabaseService.delete('history', 'device_id', `eq.${deviceId}`);
  },

  // ============ SETTINGS ============

  async getSettings(): Promise<AppSettings> {
    const deviceHash = this.getDeviceId();

    // First, try fetching with dev_mode (the newer schema)
    let cloudData = await SupabaseService.getAll<any>(
      'settings',
      `?select=reading_mode,dark_mode,dev_mode&device_id=eq.${deviceHash}`,
    );

    // If that fails (likely 400 because dev_mode column missing), try basic fetch
    if (!cloudData || cloudData.length === 0) {
      cloudData = await SupabaseService.getAll<any>(
        'settings',
        `?select=reading_mode,dark_mode&device_id=eq.${deviceHash}`,
      );
    }

    if (cloudData && cloudData.length > 0) {
      const row = cloudData[0];
      const settings: AppSettings = {
        readingMode: (row.reading_mode as any) || DEFAULT_SETTINGS.readingMode,
        darkMode: row.dark_mode ?? DEFAULT_SETTINGS.darkMode,
        devMode:
          row.dev_mode ??
          getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
            .devMode,
      };
      setLocal(STORAGE_KEYS.SETTINGS, settings);
      return settings;
    }
    return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = getLocal<AppSettings>(
      STORAGE_KEYS.SETTINGS,
      DEFAULT_SETTINGS,
    );
    const updated = { ...current, ...settings };
    setLocal(STORAGE_KEYS.SETTINGS, updated);

    // Sync to Cloud
    await SupabaseService.upsert(
      'settings',
      {
        device_id: this.getDeviceId(),
        reading_mode: updated.readingMode,
        dark_mode: updated.darkMode,
        dev_mode: updated.devMode,
      },
      'device_id',
    );
    log('[Storage] Saved device-specific settings');
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
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.removeItem(STORAGE_KEYS.FILTERS);
      memoryStorage.delete(STORAGE_KEYS.FILTERS);
    } catch (e) {}
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
    log('[Storage] Saved reader position:', { mangaId, panelIndex });
  },

  getReaderPosition(): ReaderPosition | null {
    return getLocal<ReaderPosition | null>(STORAGE_KEYS.READER_POSITION, null);
  },

  clearReaderPosition(): void {
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.removeItem(STORAGE_KEYS.READER_POSITION);
      memoryStorage.delete(STORAGE_KEYS.READER_POSITION);
      setNativeItem(STORAGE_KEYS.READER_POSITION, '');
      log('[Storage] Cleared reader position');
    } catch (e) {}
  },

  // ============ CLEAR ALL ============

  async clearAllData(): Promise<void> {
    try {
      const deviceId = this.getDeviceId();
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.FAVORITES);
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        localStorage.removeItem(STORAGE_KEYS.FILTERS);
      }
      memoryStorage.clear();

      await this.clearHistory();
      await SupabaseService.delete('favorites', 'device_id', `eq.${deviceId}`);
    } catch (e) {
      logWarn('[Storage] clearAllData failed:', e);
    }
  },
};
