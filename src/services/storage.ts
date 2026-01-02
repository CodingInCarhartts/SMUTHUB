import type { Manga, SearchFilters } from './batoto/types';
import { logCapture } from './debugLog';
import { SupabaseService } from './supabase';
import { SyncEngine } from './sync';
import { MigrationService } from './migration';
import { HISTORY_LIMIT_LOCAL, HISTORY_LIMIT_CLOUD, NATIVE_DEVICE_ID_TIMEOUT_MS } from '../config';

import {
  getNativeItem,
  getNativeItemSync,
  hasNativeStorage,
  setNativeItem,
  setNativeItemSync,
} from './nativeStorage';

// Helper to log with capture (console override doesn't work in Lynx)
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

export function normalizeUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace(/\/+$/, '').toLowerCase();
}

// Types
export interface ViewedManga {
  manga: Manga;
  lastChapterId?: string;
  lastChapterTitle?: string;
  lastPageIndex?: number;
  viewedAt: string;
  timestamp?: number; // legacy support for migration
}

export interface AppSettings {
  darkMode: boolean;
  devMode: boolean;
  scrollSpeed: number; // 0.1 = 10%, 0.2 = 20%, etc.
  debugOutlines?: boolean;
  privacyFilter?: boolean;
  privacyFilterOpacity?: number; // 0.0 to 1.0
  mockUpdates?: boolean;
}

export interface ReaderPosition {
  mangaId: string;
  chapterUrl: string;
  panelIndex: number;
  scrollPosition?: number;
  timestamp: string;
}

export const STORAGE_KEYS = {
  FAVORITES: 'batoto:favorites',
  HISTORY: 'batoto:history',
  SETTINGS: 'batoto:settings',
  FILTERS: 'batoto:filters',
  DEVICE_ID: 'batoto:device_id',
  READER_POSITION: 'batoto:reader_position',

  SKIPPED_VERSION: 'batoto:skipped_version',
  DEVICE_ID_OVERRIDE: 'batoto:device_id_override',
};

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  devMode: false,
  scrollSpeed: 0.6, // 60% of screen per scroll
  privacyFilter: false,
  privacyFilterOpacity: 0.7,
};

// In-memory fallback and cache
const memoryStorage = new Map<string, string>();
let NATIVE_DEVICE_ID: string | null = null;
let SESSION_DEVICE_ID: string | null = null;

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
      const nativeId: string | null = await new Promise((resolve) => {
        log('[Storage] Calling native getDeviceId...');
        utilsModule.getDeviceId((id: string) => {
          log('[Storage] Fetched native device ID success:', id);
          resolve(id);
        });
        // Timeout just in case
        setTimeout(() => {
          logWarn(`[Storage] Native getDeviceId timed out after ${NATIVE_DEVICE_ID_TIMEOUT_MS}ms`);
          resolve(null);
        }, NATIVE_DEVICE_ID_TIMEOUT_MS);
      });

      if (nativeId && nativeId.length > 5 && nativeId !== 'android' && nativeId !== 'undefined') {
        NATIVE_DEVICE_ID = nativeId;
        // Also ensure it is saved locally to avoid regeneration if hardware ID fetch is slow next time
        setLocal(STORAGE_KEYS.DEVICE_ID, nativeId);
      }
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


// Storage Service - Hybrid (Local First + Background Sync via REST)
export const StorageService = {
  // ============ DEVICE ID ============

  getDeviceId(): string {
    // 1. Session Cache
    if (SESSION_DEVICE_ID) return SESSION_DEVICE_ID;

    // 1.5 Check Override
    const override = getLocal<string | null>(STORAGE_KEYS.DEVICE_ID_OVERRIDE, null);
    if (override && override.length > 0) {
      SESSION_DEVICE_ID = override;
      return override;
    }

    // 2. Prioritize Real Native Device ID (fetched during init)
    if (NATIVE_DEVICE_ID && NATIVE_DEVICE_ID.length > 5 && NATIVE_DEVICE_ID !== 'android') {
      SESSION_DEVICE_ID = NATIVE_DEVICE_ID;
      return NATIVE_DEVICE_ID;
    }

    // 3. Check Memory Storage (via getLocal)
    const id = getLocal<string | null>(STORAGE_KEYS.DEVICE_ID, null);
    if (id && typeof id === 'string' && id.length > 5 && id !== 'android') {
      SESSION_DEVICE_ID = id;
      return id;
    }

    // 4. Fallback to SystemInfo
    try {
      const si = typeof SystemInfo !== 'undefined' ? SystemInfo : (globalThis as any).SystemInfo;
      if (si?.deviceId && si.deviceId.length > 5 && si.deviceId !== 'android') {
        const id = si.deviceId;
        setLocal(STORAGE_KEYS.DEVICE_ID, id);
        SESSION_DEVICE_ID = id;
        return id;
      }
    } catch (e) {
      logWarn('[Storage] SystemInfo check failed:', e);
    }

    // 5. Generate Fallback strictly for web/local dev (Lynx Explorer)
    // If we reach here, we have no ID. Generate one.
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const newId = `dev-${timestamp}-${randomPart}`;

    log('[Storage] Generating FALLBACK Device ID (Local/Dev):', newId);

    // Persist to memory/local immediately so it survives this session
    setLocal(STORAGE_KEYS.DEVICE_ID, newId);
    SESSION_DEVICE_ID = newId;
    return newId;
  },

  setDeviceId(id: string): void {
    if (id && id.length > 5) {
      setLocal(STORAGE_KEYS.DEVICE_ID, id);
      log('[Storage] Device ID manually updated to:', id);
    }
  },

  setDeviceIdOverride(id: string): void {
    if (id && id.length > 0) {
      setLocal(STORAGE_KEYS.DEVICE_ID_OVERRIDE, id);
      SESSION_DEVICE_ID = id;

      // Clear data caches to force refetch for new persona
      memoryStorage.delete(STORAGE_KEYS.FAVORITES);
      memoryStorage.delete(STORAGE_KEYS.HISTORY);
      memoryStorage.delete(STORAGE_KEYS.SETTINGS);

      log('[Storage] Device ID OVERRIDE set to:', id);
    }
  },

  clearDeviceIdOverride(): void {
    memoryStorage.delete(STORAGE_KEYS.DEVICE_ID_OVERRIDE);
    setNativeItem(STORAGE_KEYS.DEVICE_ID_OVERRIDE, '');
    SESSION_DEVICE_ID = null; // Will trigger re-detection/native fallback next call

    // Clear data caches
    memoryStorage.delete(STORAGE_KEYS.FAVORITES);
    memoryStorage.delete(STORAGE_KEYS.HISTORY);
    memoryStorage.delete(STORAGE_KEYS.SETTINGS);

    log('[Storage] Device ID OVERRIDE cleared');
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
    const deviceId = this.getDeviceId();
    console.log(`[Storage] Adding favorite for manga ${manga.id} (Device: ${deviceId})`);
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    if (!favorites.find((m) => m.id === manga.id)) {
      favorites.unshift(manga);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
    }

    await SyncEngine.enqueue({
      type: 'UPSERT',
      table: 'favorites',
      payload: {
        device_id: deviceId,
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
        const cloudHistory: ViewedManga[] = cloudData.map((row: any) => ({
          manga: row.manga_data,
          lastChapterId: row.last_chapter_id,
          lastChapterTitle: row.last_chapter_title,
          viewedAt: row.viewed_at,
        }));

        // SMART MERGE: Combine Local and Cloud, prioritizing the NEWER timestamp
        // This prevents stale cloud data from overwriting a just-read chapter
        const mergedMap = new Map<string, ViewedManga>();

        // 1. Add Cloud items first
        cloudHistory.forEach(item => {
          mergedMap.set(item.manga.id, item);
        });

        // 2. Overlay Local items if they are newer
        // We re-fetch local here to catch any changes that happened during the await
        const currentLocal = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
        
        currentLocal.forEach(localItem => {
          const cloudItem = mergedMap.get(localItem.manga.id);
          if (!cloudItem) {
            // Only in local
            mergedMap.set(localItem.manga.id, localItem);
          } else {
            // Conflict: Check timestamps
            const localDate = new Date(localItem.viewedAt).getTime();
            const cloudDate = new Date(cloudItem.viewedAt).getTime();
            
            if (localDate > cloudDate) {
               // Local is newer (e.g. user just read a chapter but sync hasn't finished)
               mergedMap.set(localItem.manga.id, localItem);
               console.log(`[Storage] Conflict resolved: Keeping LOCAL for ${localItem.manga.title} (Newer)`);
            } else {
               // Cloud is newer (or same), keep cloud (already in map)
            }
          }
        });

        // 3. Convert back to array and sort
        const mergedHistory = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
          .slice(0, HISTORY_LIMIT_LOCAL);

        setLocal(STORAGE_KEYS.HISTORY, mergedHistory);
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
        `?select=dark_mode,dev_mode,scroll_speed&device_id=eq.${deviceId}`,
      );
      if (cloudData && cloudData.length > 0) {
        const row = cloudData[0];
        const settings: AppSettings = {
          darkMode: row.dark_mode ?? DEFAULT_SETTINGS.darkMode,
          devMode: row.dev_mode ?? DEFAULT_SETTINGS.devMode,
          scrollSpeed: row.scroll_speed ?? DEFAULT_SETTINGS.scrollSpeed,
          privacyFilter: row.privacy_filter ?? DEFAULT_SETTINGS.privacyFilter,
          privacyFilterOpacity: row.privacy_filter_opacity ?? DEFAULT_SETTINGS.privacyFilterOpacity,
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

    await SyncEngine.enqueue({
      type: 'UPSERT',
      table: 'settings',
      payload: {
        device_id: this.getDeviceId(),
        dark_mode: updated.darkMode,
        dev_mode: updated.devMode,
        scroll_speed: updated.scrollSpeed,
        privacy_filter: updated.privacyFilter,
        privacy_filter_opacity: updated.privacyFilterOpacity,
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
    const deviceId = this.getDeviceId();
    const position: ReaderPosition = {
      mangaId,
      chapterUrl,
      panelIndex,
      scrollPosition,
      timestamp: new Date().toISOString(),
    };
    console.log(`[Storage] Saving reader position: manga=${mangaId}, panel=${panelIndex}, device=${deviceId}`);
    setLocal(STORAGE_KEYS.READER_POSITION, position);

    (async () => {
      await SyncEngine.enqueue({
        type: 'UPSERT',
        table: 'reader_positions',
        payload: {
          device_id: deviceId,
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

  // ============ UPDATE SKIP ============

  getSkippedVersion(): string | null {
    return getLocal<string | null>(STORAGE_KEYS.SKIPPED_VERSION, null);
  },

  setSkippedVersion(version: string): void {
    setLocal(STORAGE_KEYS.SKIPPED_VERSION, version);
  },

  // ============ CLEAR ALL ============

  async clearAllData(): Promise<void> {
    try {
      const deviceId = this.getDeviceId();
      memoryStorage.clear();
      await this.clearHistory();

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

  // ============ NATIVE ACCESSORS ============

  // ============ DEBUG & INSPECTOR ============

  getMemoryState(): Record<string, any> {
    const state: Record<string, any> = {};
    for (const [key, val] of memoryStorage.entries()) {
      try {
        state[key] = JSON.parse(val);
      } catch {
        state[key] = val;
      }
    }
    return state;
  },

  async clearKey(key: string): Promise<void> {
    memoryStorage.delete(key);
    setNativeItem(key, '');
    logWarn('[Storage] Cleared key via inspector:', key);
  },

  async getNativeItemSync(key: string): Promise<string | null> {
    return await getNativeItem(key);
  },

  setNativeItemSync(key: string, value: string): void {
    setNativeItem(key, value);
  },

  /**
   * Check if a new chapter is available by comparing the latest chapter URL.
   * This is independent of the user's reading progress.
   */
  checkForUpdates(localManga: Manga, remoteManga: Manga): boolean {
    // 1. Prefer ID-based comparison (Robuster)
    if (localManga.latestChapterId && remoteManga.latestChapterId) {
      if (localManga.latestChapterId !== remoteManga.latestChapterId) {
        log(`[Storage] Update detected via ID: Local=${localManga.latestChapterId} vs Remote=${remoteManga.latestChapterId}`);
        return true;
      }
      return false;
    }

    // 2. Fallback to URL-based comparison
    // If remote has no info, we can't confirm an update
    if (!remoteManga.latestChapterUrl) {
      return false;
    }

    // If local has no info (legacy data) but remote does, assume it's new
    if (!localManga.latestChapterUrl) {
      log('[Storage] Update assumed (Legacy local data missing latestChapterUrl)');
      return true;
    }
    
    // Normalize function to handle trailing slashes or protocol diffs if needed
    const normalize = (u: string) => u.replace(/\/+$/, '').toLowerCase().trim();
    
    const local = normalize(localManga.latestChapterUrl);
    const remote = normalize(remoteManga.latestChapterUrl);
    
    if (local !== remote) {
      log(`[Storage] Update detected via URL: Local=${local} vs Remote=${remote}`);
      return true;
    }
    
    return false;
  }
};

// Export initialization promise so other modules can wait
export const storageReady = (async () => {
  try {
    // 1. Core Native Init
    await initializeFromNativeStorage();

    // 2. Data Migration (Legacy -> Cloud)
    await MigrationService.run();

    // 3. Initial Cloud Sync
    await StorageService.getSettings();

    log('[Storage] System is READY');
  } catch (e: any) {
    logError('[Storage] Initialization sequence failed:', e?.message || e?.toString?.() || JSON.stringify(e) || e);
  }
})();
