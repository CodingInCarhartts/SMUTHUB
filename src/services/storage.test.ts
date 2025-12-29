import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './storage';
import { SupabaseService } from './supabase';

vi.mock('./supabase', () => ({
  SupabaseService: {
    getAll: vi.fn(() => Promise.resolve([])),
    upsert: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    request: vi.fn(() => Promise.resolve()),
  },
}));

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getDeviceId', () => {
    it('should return stored device ID if available', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify('test-id'));
      const id = StorageService.getDeviceId();
      expect(id).toBe('test-id');
    });

    it('should fall back to SystemInfo if no stored ID', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      const id = StorageService.getDeviceId();
      expect(id).toBe('test-device-id'); // from setup.ts mock
    });
  });

  describe('Favorites', () => {
    it('should add a favorite and sync to cloud', async () => {
      const manga = { id: 'm1', title: 'Manga 1', url: '', cover: '' };
      await StorageService.addFavorite(manga);
      
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(SupabaseService.upsert).toHaveBeenCalledWith(
        'favorites',
        expect.objectContaining({ manga_id: 'm1' }),
        'device_id,manga_id'
      );
    });

    it('should check if a manga is favorite', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([{ id: 'm1' }]));
      expect(StorageService.isFavoriteSync('m1')).toBe(true);
      expect(StorageService.isFavoriteSync('m2')).toBe(false);
    });
  });

  describe('Settings', () => {
    it('should return default settings if none stored', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      const settings = await StorageService.getSettings();
      expect(settings.readingMode).toBe('vertical');
    });

    it('should save settings and sync to cloud', async () => {
      await StorageService.saveSettings({ readingMode: 'horizontal' });
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(SupabaseService.upsert).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({ reading_mode: 'horizontal' }),
        'device_id'
      );
    });
  });

  describe('History', () => {
    it('should add to history and sync', async () => {
      const manga = { id: 'm1', title: 'Manga 1', url: '', cover: '' };
      await StorageService.addToHistory(manga, 'c1', 'Chapter 1');
      
      const history = await StorageService.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].manga.id).toBe('m1');
      expect(history[0].lastChapterId).toBe('c1');
      expect(SupabaseService.upsert).toHaveBeenCalledWith('history', expect.any(Object), expect.any(String));
    });
  });

  describe('Filters', () => {
    it('should save and get filters', async () => {
      const filters = { genres: ['Action'], status: 'ongoing' };
      StorageService.saveFilters(filters as any);
      
      const saved = StorageService.getLastFilters();
      expect(saved?.genres).toContain('Action');
    });
  });

  describe('Initialization', () => {
    it('should load from native storage on init', async () => {
      const g = globalThis as any;
      g.NativeModules.NativeLocalStorageModule.getStorageItem = vi.fn((key, cb) => cb(JSON.stringify('native-id')));
      
      await StorageService.setDeviceId('new-id');
      expect(g.NativeModules.NativeLocalStorageModule.setStorageItem).toHaveBeenCalled();
    });

    it('should handle native get failure', async () => {
      const g = globalThis as any;
      g.NativeModules.NativeLocalStorageModule.getStorageItem = vi.fn((key, cb) => {
        throw new Error('Native Boom');
      });
      
      const id = StorageService.getDeviceId();
      expect(id).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should handle clearAllData errors', async () => {
      vi.mocked(SupabaseService.delete).mockRejectedValue(new Error('Cloud Fail'));
      await expect(StorageService.clearAllData()).resolves.toBeUndefined();
    });

    it('should remove a favorite', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([{ id: 'm1' }]));
      await StorageService.removeFavorite('m1');
      expect(localStorage.setItem).toHaveBeenCalledWith(expect.any(String), JSON.stringify([]));
    });

    it('should clear all data', async () => {
      await StorageService.clearAllData();
      expect(localStorage.removeItem).toHaveBeenCalled();
      expect(SupabaseService.delete).toHaveBeenCalled();
    });
  });
});
