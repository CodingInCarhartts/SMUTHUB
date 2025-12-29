import { SupabaseService } from './supabase';
import type { Manga, SearchFilters } from './batoto/types';

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

const STORAGE_KEYS = {
  FAVORITES: 'batoto:favorites',
  HISTORY: 'batoto:history',
  SETTINGS: 'batoto:settings',
  FILTERS: 'batoto:filters',
  DEVICE_ID: 'batoto:device_id',
};

const DEFAULT_SETTINGS: AppSettings = {
  readingMode: 'vertical',
  darkMode: false,
  devMode: false,
};

const HISTORY_LIMIT_LOCAL = 50;
const HISTORY_LIMIT_CLOUD = 999;

// In-memory fallback
const memoryStorage = new Map<string, string>();

// Helper for storage
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    }
  } catch (e) {
    // Ignore error
  }
  
  const stored = memoryStorage.get(key);
  return stored ? JSON.parse(stored) : defaultValue;
}

function setLocal<T>(key: string, value: T): void {
  const strValue = JSON.stringify(value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, strValue);
    }
  } catch (e) {
    console.error('[Storage] localStorage error:', e);
  }
  memoryStorage.set(key, strValue);
}

// Storage Service - Hybrid (Local First + Background Sync via REST)
export const StorageService = {
  // ============ DEVICE ID ============
  
  getDeviceId(): string {
    // 1. Check LocalStorage first for a persistent ID
    let id = getLocal<string | null>(STORAGE_KEYS.DEVICE_ID, null);
    if (id && id.length > 5) return id;

    // 2. Check SystemInfo, but only use it if it's not a generic/malformed ID
    try {
      // @ts-ignore - SystemInfo is provided by Lynx runtime
      const si = typeof SystemInfo !== 'undefined' ? SystemInfo : (globalThis as any).SystemInfo;
      if (si && si.deviceId && si.deviceId.length > 5 && si.deviceId !== 'undefined' && si.deviceId !== 'android') {
        setLocal(STORAGE_KEYS.DEVICE_ID, si.deviceId);
        return si.deviceId;
      }
    } catch (e) {
      console.warn('[Storage] SystemInfo check failed:', e);
    }

    // 3. Generate a fresh UUID if nothing else is found
    // crypto.randomUUID fallback for environments without it
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : 'xxxx-xxxx-xxxx-xxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

    setLocal(STORAGE_KEYS.DEVICE_ID, newId);
    console.log('[Storage] Generated robust persistent Device ID:', newId);
    return newId;
  },

  // ============ FAVORITES ============
  
  async getFavorites(): Promise<Manga[]> {
    const deviceId = this.getDeviceId();
    const cloudData = await SupabaseService.getAll<{ manga_data: Manga }>(
      'favorites', 
      `?select=manga_data&device_id=eq.${deviceId}&order=created_at.desc`
    );
    
    if (cloudData.length > 0) {
      const favorites = cloudData.map(row => row.manga_data);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
      return favorites;
    }
    
    return getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
  },

  async addFavorite(manga: Manga): Promise<void> {
    // Optimistic Update
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    if (!favorites.find(m => m.id === manga.id)) {
      favorites.unshift(manga);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
    }
    
    // Sync to Cloud
    await SupabaseService.upsert('favorites', {
      device_id: this.getDeviceId(),
      manga_id: manga.id,
      manga_data: manga
    }, 'device_id,manga_id');
    console.log('[Storage] Synced favorite to cloud:', manga.title);
  },

  async removeFavorite(mangaId: string): Promise<void> {
    // Optimistic Update
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    setLocal(STORAGE_KEYS.FAVORITES, favorites.filter(m => m.id !== mangaId));
    
    // Sync to Cloud
    const deviceId = this.getDeviceId();
    await SupabaseService.request(`/favorites?device_id=eq.${deviceId}&manga_id=eq.${mangaId}`, {
      method: 'DELETE'
    });
    console.log('[Storage] Removed favorite from cloud:', mangaId);
  },

  isFavoriteSync(mangaId: string): boolean {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    return favorites.some(m => m.id === mangaId);
  },
  
  async isFavorite(mangaId: string): Promise<boolean> {
    return this.isFavoriteSync(mangaId);
  },

  // ============ HISTORY ============

  async getHistory(): Promise<ViewedManga[]> {
    const deviceId = this.getDeviceId();
    // Try Cloud
    const cloudData = await SupabaseService.getAll<{
      manga_data: Manga,
      last_chapter_id: string,
      last_chapter_title: string,
      viewed_at: string
    }>('history', `?select=manga_data,last_chapter_id,last_chapter_title,viewed_at&device_id=eq.${deviceId}&order=viewed_at.desc&limit=${HISTORY_LIMIT_CLOUD}`);
    
    if (cloudData.length > 0) {
      const history = cloudData.map(row => ({
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

  async addToHistory(manga: Manga, chapterId?: string, chapterTitle?: string): Promise<void> {
    // Optimistic Update
    let history = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    history = history.filter(h => h.manga.id !== manga.id);
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
    await SupabaseService.upsert('history', {
      device_id: this.getDeviceId(),
      manga_id: manga.id,
      manga_data: manga,
      last_chapter_id: chapterId,
      last_chapter_title: chapterTitle,
      viewed_at: new Date().toISOString(),
    }, 'device_id,manga_id');
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
      `?select=reading_mode,dark_mode,dev_mode&device_id=eq.${deviceHash}`
    );
    
    // If that fails (likely 400 because dev_mode column missing), try basic fetch
    if (!cloudData || cloudData.length === 0) {
      cloudData = await SupabaseService.getAll<any>(
        'settings', 
        `?select=reading_mode,dark_mode&device_id=eq.${deviceHash}`
      );
    }
    
    if (cloudData && cloudData.length > 0) {
      const row = cloudData[0];
      const settings: AppSettings = {
        readingMode: row.reading_mode as any || DEFAULT_SETTINGS.readingMode,
        darkMode: row.dark_mode ?? DEFAULT_SETTINGS.darkMode,
        devMode: row.dev_mode ?? getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS).devMode,
      };
      setLocal(STORAGE_KEYS.SETTINGS, settings);
      return settings;
    }
    return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...settings };
    setLocal(STORAGE_KEYS.SETTINGS, updated);
    
    // Sync to Cloud
    await SupabaseService.upsert('settings', {
      device_id: this.getDeviceId(),
      reading_mode: updated.readingMode,
      dark_mode: updated.darkMode,
      dev_mode: updated.devMode,
    }, 'device_id');
    console.log('[Storage] Saved device-specific settings');
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
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEYS.FILTERS);
      memoryStorage.delete(STORAGE_KEYS.FILTERS);
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
      console.warn('[Storage] clearAllData failed:', e);
    }
  },
};
