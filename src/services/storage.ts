import {
  HISTORY_LIMIT_CLOUD,
  HISTORY_LIMIT_LOCAL,
  NATIVE_DEVICE_ID_TIMEOUT_MS,
} from '../config';
import { logCapture } from './debugLog';
import { MigrationService } from './migration';
import {
  getNativeItem,
  getNativeItemSync,
  hasNativeStorage,
  setNativeItem,
  setNativeItemSync,
} from './nativeStorage';
import { SupabaseService } from './supabase';
import { SyncEngine } from './sync';
import type { Manga, SearchFilters } from './types';

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

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface StorageResult<T> {
  data: T;
  status: SyncStatus;
  lastSyncedAt?: number;
}

const syncStatus: Map<string, SyncStatus> = new Map();
const lastSyncedAt: Map<string, number> = new Map();

const writeLockQueues = new Map<string, Array<() => void>>();

async function acquireWriteLock(key: string): Promise<() => void> {
  const queue = writeLockQueues.get(key);

  if (!queue || queue.length === 0) {
    const newQueue: Array<() => void> = [];
    writeLockQueues.set(key, newQueue);

    return () => {
      const q = writeLockQueues.get(key);
      if (q && q.length > 0) {
        const next = q.shift()!;
        next();
      } else {
        writeLockQueues.delete(key);
      }
    };
  }

  return new Promise<void>((resolve) => {
    const q = writeLockQueues.get(key);
    if (q) {
      q.push(resolve);
    }
  }).then(() => {
    const newQueue: Array<() => void> = [];
    writeLockQueues.set(key, newQueue);

    return () => {
      const q = writeLockQueues.get(key);
      if (q && q.length > 0) {
        const next = q.shift()!;
        next();
      } else {
        writeLockQueues.delete(key);
      }
    };
  });
}

function setSyncStatus(key: string, status: SyncStatus): void {
  syncStatus.set(key, status);
  log(`[Storage] Sync status for ${key}: ${status}`);
}

function getSyncStatus(key: string): SyncStatus {
  return syncStatus.get(key) || 'idle';
}

function setLastSynced(key: string, timestamp: number): void {
  lastSyncedAt.set(key, timestamp);
}

function getLastSynced(key: string): number | undefined {
  return lastSyncedAt.get(key);
}

export const STORAGE_KEYS = {
  FAVORITES: 'batoto:favorites',
  HISTORY: 'batoto:history',
  SETTINGS: 'batoto:settings',
  FILTERS: 'batoto:filters',
  DEVICE_ID: 'batoto:device_id',
  READER_POSITION: 'batoto:reader_position',

  SKIPPED_VERSION: 'batoto:skipped_version',
  UPDATE_ATTEMPT: 'batoto:last_update_attempt',
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

async function setLocal<T>(key: string, value: T): Promise<void> {
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
  return setNativeItem(key, strValue);
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
    const modules = NativeModules as any;
    const utilsModule = modules?.NativeUtilsModule;
    log('[Storage] Checking NativeUtilsModule:', {
      exists: !!utilsModule,
      hasGetDeviceId: typeof utilsModule?.getDeviceId === 'function',
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
          logWarn(
            `[Storage] Native getDeviceId timed out after ${NATIVE_DEVICE_ID_TIMEOUT_MS}ms`,
          );
          resolve(null);
        }, NATIVE_DEVICE_ID_TIMEOUT_MS);
      });

      if (
        nativeId &&
        nativeId.length > 5 &&
        nativeId !== 'android' &&
        nativeId !== 'undefined'
      ) {
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
    STORAGE_KEYS.UPDATE_ATTEMPT,
    STORAGE_KEYS.SKIPPED_VERSION,
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
    const override = getLocal<string | null>(
      STORAGE_KEYS.DEVICE_ID_OVERRIDE,
      null,
    );
    if (override && override.length > 0) {
      SESSION_DEVICE_ID = override;
      return override;
    }

    // 2. Prioritize Real Native Device ID (fetched during init)
    if (
      NATIVE_DEVICE_ID &&
      NATIVE_DEVICE_ID.length > 5 &&
      NATIVE_DEVICE_ID !== 'android'
    ) {
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
      const si =
        typeof SystemInfo !== 'undefined'
          ? SystemInfo
          : (globalThis as any).SystemInfo;
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

  async syncFavorites(): Promise<Manga[]> {
    const deviceId = this.getDeviceId();
    setSyncStatus('favorites', 'syncing');

    try {
      const cloudData = await SupabaseService.getAll<{ manga_data: Manga }>(
        'favorites',
        `?select=manga_data&device_id=eq.${deviceId}&order=created_at.desc`,
      );

      if (cloudData.length > 0) {
        let cloudFavorites = cloudData.map((row) => row.manga_data);

        const pendingDeletions =
          await SyncEngine.getPendingDeletions('favorites');
        if (pendingDeletions.size > 0) {
          cloudFavorites = cloudFavorites.filter(
            (m) => !pendingDeletions.has(m.id),
          );
        }

        const currentLocal = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
        const mergedMap = new Map<string, Manga>();

        cloudFavorites.forEach((m) => mergedMap.set(m.id, m));
        currentLocal.forEach((m) => mergedMap.set(m.id, m));

        const mergedFavorites = Array.from(mergedMap.values());
        setLocal(STORAGE_KEYS.FAVORITES, mergedFavorites);
        setLastSynced('favorites', Date.now());
        setSyncStatus('favorites', 'idle');
        return mergedFavorites;
      }

      setSyncStatus('favorites', 'idle');
      return getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    } catch (e) {
      logError('[Storage] Failed to sync favorites:', e);
      setSyncStatus('favorites', 'error');
      return getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    }
  },

  async getFavorites(
    forceRefresh: boolean = false,
  ): Promise<StorageResult<Manga[]>> {
    const local = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    const status = getSyncStatus('favorites');
    const lastSynced = getLastSynced('favorites');

    if (forceRefresh || status === 'idle') {
      if (forceRefresh || status === 'idle') {
        const release = await acquireWriteLock('favorites');
        try {
          await this.syncFavorites();
        } finally {
          release();
        }
      }
    } else {
      this.syncFavorites();
    }

    return {
      data: getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []),
      status: getSyncStatus('favorites'),
      lastSyncedAt: getLastSynced('favorites'),
    };
  },

  async addFavorite(manga: Manga): Promise<void> {
    const release = await acquireWriteLock('favorites');
    try {
      const deviceId = this.getDeviceId();
      console.log(
        `[Storage] Adding favorite for manga ${manga.id} (Device: ${deviceId})`,
      );
      const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);

      if (!favorites.some((m) => m.id === manga.id)) {
        const newFavorites = [manga, ...favorites];
        setLocal(STORAGE_KEYS.FAVORITES, newFavorites);

        await SyncEngine.enqueue({
          type: 'UPSERT',
          table: 'favorites',
          payload: {
            device_id: deviceId,
            manga_id: manga.id,
            manga_data: manga,
            created_at: new Date().toISOString(),
          },
          timestamp: Date.now(),
        });
      } else {
        console.log(`[Storage] Favorite already exists for ${manga.id}`);
      }
    } finally {
      release();
    }
  },

  async removeFavorite(mangaId: string): Promise<void> {
    const release = await acquireWriteLock('favorites');
    try {
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
          manga_id: mangaId,
        },
        timestamp: Date.now(),
      });
    } finally {
      release();
    }
  },

  isFavoriteSync(mangaId: string): boolean {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    return favorites.some((m) => m.id === mangaId);
  },

  async isFavorite(mangaId: string): Promise<boolean> {
    return this.isFavoriteSync(mangaId);
  },

  // ============ HISTORY ============

  async syncHistory(): Promise<ViewedManga[]> {
    const deviceId = this.getDeviceId();
    setSyncStatus('history', 'syncing');

    try {
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

        const mergedMap = new Map<string, ViewedManga>();

        cloudHistory.forEach((item) => {
          mergedMap.set(item.manga.id, item);
        });

        const currentLocal = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);

        currentLocal.forEach((localItem) => {
          const cloudItem = mergedMap.get(localItem.manga.id);
          if (!cloudItem) {
            mergedMap.set(localItem.manga.id, localItem);
          } else {
            const localDate = new Date(localItem.viewedAt).getTime();
            const cloudDate = new Date(cloudItem.viewedAt).getTime();

            if (localDate > cloudDate) {
              mergedMap.set(localItem.manga.id, localItem);
              console.log(
                `[Storage] Conflict resolved: Keeping LOCAL for ${localItem.manga.title} (Newer)`,
              );
            }
          }
        });

        const mergedHistory = Array.from(mergedMap.values())
          .sort(
            (a, b) =>
              new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime(),
          )
          .slice(0, HISTORY_LIMIT_LOCAL);

        setLocal(STORAGE_KEYS.HISTORY, mergedHistory);
        setLastSynced('history', Date.now());
        setSyncStatus('history', 'idle');
        return mergedHistory;
      }

      setSyncStatus('history', 'idle');
      return getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    } catch (e) {
      logError('[Storage] Failed to sync history:', e);
      setSyncStatus('history', 'error');
      return getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    }
  },

  async getHistory(
    forceRefresh: boolean = false,
  ): Promise<StorageResult<ViewedManga[]>> {
    const local = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    const status = getSyncStatus('history');

    if (forceRefresh || status === 'idle') {
      const release = await acquireWriteLock('history');
      try {
        await this.syncHistory();
      } finally {
        release();
      }
    } else {
      this.syncHistory();
    }

    return {
      data: getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []),
      status: getSyncStatus('history'),
      lastSyncedAt: getLastSynced('history'),
    };
  },

  async addToHistory(
    manga: Manga,
    chapterId?: string,
    chapterTitle?: string,
  ): Promise<void> {
    const release = await acquireWriteLock('history');
    try {
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
        timestamp: Date.now(),
      });
    } finally {
      release();
    }
  },

  async clearHistory(): Promise<void> {
    const release = await acquireWriteLock('history');
    try {
      const deviceId = this.getDeviceId();

      await SupabaseService.request(`/history?device_id=eq.${deviceId}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });

      setLocal(STORAGE_KEYS.HISTORY, []);
    } finally {
      release();
    }
  },

  // ============ SETTINGS ============

  async syncSettings(): Promise<AppSettings> {
    const deviceId = this.getDeviceId();
    setSyncStatus('settings', 'syncing');

    try {
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
        };
        setLocal(STORAGE_KEYS.SETTINGS, settings);
        setLastSynced('settings', Date.now());
        setSyncStatus('settings', 'idle');
        return settings;
      }

      setSyncStatus('settings', 'idle');
      return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    } catch (e) {
      logError('[Storage] Failed to sync settings:', e);
      setSyncStatus('settings', 'error');
      return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
  },

  async getSettings(): Promise<StorageResult<AppSettings>> {
    const local = getLocal<AppSettings>(
      STORAGE_KEYS.SETTINGS,
      DEFAULT_SETTINGS,
    );
    const status = getSyncStatus('settings');

    if (status === 'idle') {
      const release = await acquireWriteLock('settings');
      try {
        await this.syncSettings();
      } finally {
        release();
      }
    } else {
      this.syncSettings();
    }

    return {
      data: getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
      status: getSyncStatus('settings'),
      lastSyncedAt: getLastSynced('settings'),
    };
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const release = await acquireWriteLock('settings');
    try {
      const current = getLocal<AppSettings>(
        STORAGE_KEYS.SETTINGS,
        DEFAULT_SETTINGS,
      );
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
          updated_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });
    } finally {
      release();
    }
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
    console.log(
      `[Storage] Saving reader position: manga=${mangaId}, panel=${panelIndex}, device=${deviceId}`,
    );
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
        timestamp: Date.now(),
      });
    })();
  },

  async getReaderPositionForManga(
    mangaId: string,
  ): Promise<ReaderPosition | null> {
    const local = this.getReaderPosition();
    if (local && local.mangaId === mangaId) return local;

    try {
      const deviceId = this.getDeviceId();
      const data = await SupabaseService.getAll<any>(
        'reader_positions',
        `?select=chapter_url,panel_index,updated_at&device_id=eq.${deviceId}&manga_id=eq.${mangaId}&limit=1`,
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

  // ============ UPDATE SKIP / ATTEMPT ============

  getSkippedVersion(): string | null {
    return getLocal<string | null>(STORAGE_KEYS.SKIPPED_VERSION, null);
  },

  setSkippedVersion(version: string): void {
    setLocal(STORAGE_KEYS.SKIPPED_VERSION, version);
  },

  getLastUpdateAttempt(): string | null {
    return getLocal<string | null>(STORAGE_KEYS.UPDATE_ATTEMPT, null);
  },

  async setLastUpdateAttempt(hash: string): Promise<void> {
    await setLocal(STORAGE_KEYS.UPDATE_ATTEMPT, hash);
  },

  clearLastUpdateAttempt(): void {
    memoryStorage.delete(STORAGE_KEYS.UPDATE_ATTEMPT);
    setNativeItem(STORAGE_KEYS.UPDATE_ATTEMPT, '');
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
        timestamp: Date.now(),
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
        log(
          `[Storage] Update detected via ID: Local=${localManga.latestChapterId} vs Remote=${remoteManga.latestChapterId}`,
        );
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
      log(
        '[Storage] Update assumed (Legacy local data missing latestChapterUrl)',
      );
      return true;
    }

    // Normalize function to handle trailing slashes or protocol diffs if needed
    const normalize = (u: string) => u.replace(/\/+$/, '').toLowerCase().trim();

    const local = normalize(localManga.latestChapterUrl);
    const remote = normalize(remoteManga.latestChapterUrl);

    if (local !== remote) {
      log(
        `[Storage] Update detected via URL: Local=${local} vs Remote=${remote}`,
      );
      return true;
    }

    return false;
  },

  /**
   * Check for updates on user's favorites.
   * force = true bypasses the 1-hour throttle.
   */
  async checkFavoritesForUpdates(
    force: boolean = false,
  ): Promise<Map<string, Manga>> {
    try {
      const settingsResult = await this.getSettings();
      const settings = settingsResult.data;
      log(
        `[Storage] checkFavoritesForUpdates. Force=${force}, Mock=${!!settings.mockUpdates}`,
      );

      if (settings.mockUpdates) {
        log(
          '[Storage] Mock Updates ENABLED - Forcing updates on history items',
        );
        const mockMap = new Map<string, Manga>();
        const historyResult = await this.getHistory();
        const currentHistory = historyResult.data;

        currentHistory.forEach((item) => {
          const mockManga = { ...item.manga };
          mockManga.latestChapterUrl =
            (item.manga.latestChapterUrl || '') + '_mock_update';
          mockManga.latestChapter =
            'NEW ' + (item.manga.latestChapter || 'Chapter');
          mockMap.set(item.manga.id, mockManga);
        });

        return mockMap;
      }

      // Check throttle if not forced
      const LAST_CHECK_KEY = 'batoto:last_update_check';
      const CACHED_UPDATES_KEY = 'batoto:cached_updates';
      const ONE_HOUR = 60 * 60 * 1000;

      const now = Date.now();

      if (!force) {
        const lastCheckStr = await getNativeItemSync(LAST_CHECK_KEY);
        const lastCheck = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;
        const shouldCheck = now - lastCheck > ONE_HOUR;

        if (!shouldCheck) {
          log(
            `[Storage] Throttled update check (Last: ${new Date(lastCheck).toLocaleTimeString()}). Loading cache.`,
          );
          const cachedStr = await getNativeItemSync(CACHED_UPDATES_KEY);
          if (cachedStr) {
            try {
              const cachedList: Manga[] = JSON.parse(cachedStr);
              const map = new Map<string, Manga>();
              cachedList.forEach((m) => map.set(m.id, m));
              return map;
            } catch (e) {
              logError('[Storage] Failed to parse cached updates:', e);
            }
          }
          return new Map();
        }
      }

      // NOTE: Batoto is removed, avoiding batch fetch for now.
      const updates: Manga[] = [];
      log(`[Storage] Fetched updates for ${updates.length} favorites`);

      const updateMap = new Map<string, Manga>();
      updates.forEach((m) => updateMap.set(m.id, m));

      // Save Cache
      setNativeItemSync(CACHED_UPDATES_KEY, JSON.stringify(updates));
      setNativeItemSync(LAST_CHECK_KEY, now.toString());

      return updateMap;
    } catch (e) {
      logError('[Storage] Failed to check for updates:', e);
      return new Map();
    }
  },

  // Trigger debug capture for debugging stuck loading states
  async triggerDebugCapture(): Promise<void> {
    log('[Storage] AUTO-CAPTURE: Triggering debug report capture');
    try {
      const { DebugLogService } = await import('./debugLog');
      const { SupabaseService } = await import('./supabase');
      const settingsResult = await this.getSettings();
      const settings = settingsResult.data;
      const deviceId = this.getDeviceId();

      const storageValues: Record<string, any> = {};
      const keysToCapture = [
        STORAGE_KEYS.FAVORITES,
        STORAGE_KEYS.HISTORY,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.FILTERS,
      ];

      for (const key of keysToCapture) {
        try {
          const value = getLocal(key, null);
          if (value !== null) {
            storageValues[key] = JSON.stringify(value).substring(0, 500); // Truncate
          }
        } catch (e) {
          storageValues[key] = '<error>';
        }
      }

      const structuredReport = {
        app_version: '1.0.250',
        environment_info: { deviceId, platform: 'Lynx' },
        settings,
        storage_state: storageValues,
        console_logs: [],
        supabase_status: { status: 'Auto-capture' },
      };

      const debugReport = DebugLogService.getDebugReport(structuredReport);

      // Use upsert like DeveloperOptions does
      await SupabaseService.upsert(
        'debug_logs',
        {
          device_id: deviceId,
          report: debugReport,
          app_version: structuredReport.app_version,
          environment_info: structuredReport.environment_info,
          settings: structuredReport.settings,
          supabase_status: structuredReport.supabase_status,
          storage_state: structuredReport.storage_state,
          console_logs: structuredReport.console_logs,
          created_at: new Date().toISOString(),
        },
        'device_id',
      );

      log('[Storage] AUTO-CAPTURE: Debug report sent successfully');
    } catch (e) {
      logError('[Storage] AUTO-CAPTURE: Failed to capture debug report:', e);
    }
  },
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
    logError(
      '[Storage] Initialization sequence failed:',
      e?.message || e?.toString?.() || JSON.stringify(e) || e,
    );
  }
})();
