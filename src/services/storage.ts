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
}

const STORAGE_KEYS = {
  FAVORITES: 'batoto:favorites',
  HISTORY: 'batoto:history',
  SETTINGS: 'batoto:settings',
  FILTERS: 'batoto:filters',
};

const DEFAULT_SETTINGS: AppSettings = {
  readingMode: 'vertical',
  darkMode: false,
};

const HISTORY_LIMIT = 50;

// Helper for localStorage
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[Storage] localStorage error:', e);
  }
}

// Storage Service - localStorage only (Supabase disabled due to Lynx compatibility)
export const StorageService = {
  // ============ FAVORITES ============
  
  async getFavorites(): Promise<Manga[]> {
    return getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
  },

  async addFavorite(manga: Manga): Promise<void> {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    if (!favorites.find(m => m.id === manga.id)) {
      favorites.unshift(manga);
      setLocal(STORAGE_KEYS.FAVORITES, favorites);
      console.log('[Storage] Added favorite:', manga.title);
    }
  },

  async removeFavorite(mangaId: string): Promise<void> {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    setLocal(STORAGE_KEYS.FAVORITES, favorites.filter(m => m.id !== mangaId));
    console.log('[Storage] Removed favorite:', mangaId);
  },

  async isFavorite(mangaId: string): Promise<boolean> {
    return this.isFavoriteSync(mangaId);
  },

  isFavoriteSync(mangaId: string): boolean {
    const favorites = getLocal<Manga[]>(STORAGE_KEYS.FAVORITES, []);
    return favorites.some(m => m.id === mangaId);
  },

  // ============ HISTORY ============

  async getHistory(): Promise<ViewedManga[]> {
    return getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
  },

  async addToHistory(manga: Manga, chapterId?: string, chapterTitle?: string): Promise<void> {
    let history = getLocal<ViewedManga[]>(STORAGE_KEYS.HISTORY, []);
    // Remove existing entry if present
    history = history.filter(h => h.manga.id !== manga.id);
    // Add to front
    history.unshift({
      manga,
      lastChapterId: chapterId,
      lastChapterTitle: chapterTitle,
      viewedAt: new Date().toISOString(),
    });
    // Limit size
    if (history.length > HISTORY_LIMIT) {
      history = history.slice(0, HISTORY_LIMIT);
    }
    setLocal(STORAGE_KEYS.HISTORY, history);
    console.log('[Storage] Added to history:', manga.title, chapterTitle);
  },

  async clearHistory(): Promise<void> {
    setLocal(STORAGE_KEYS.HISTORY, []);
    console.log('[Storage] Cleared history');
  },

  // ============ SETTINGS ============

  async getSettings(): Promise<AppSettings> {
    return getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = getLocal<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...settings };
    setLocal(STORAGE_KEYS.SETTINGS, updated);
    console.log('[Storage] Saved settings:', updated);
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
    console.log('[Storage] Saved filters');
  },

  clearFilters(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.FILTERS);
    } catch (e) {
      console.warn('[Storage] clearFilters failed:', e);
    }
  },

  // ============ CLEAR ALL ============

  async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.FAVORITES);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.FILTERS);
      console.log('[Storage] Cleared all data');
    } catch (e) {
      console.warn('[Storage] clearAllData failed:', e);
    }
  },
};
