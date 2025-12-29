import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsStore } from './settings';
import { StorageService } from './storage';

vi.mock('./storage', () => ({
  StorageService: {
    getSettingsSync: vi.fn(() => ({
      readingMode: 'vertical',
      darkMode: true,
      devMode: false,
    })),
    getSettings: vi.fn(() => Promise.resolve({
      readingMode: 'vertical',
      darkMode: true,
      devMode: false,
    })),
    saveSettings: vi.fn(),
  },
  storageReady: Promise.resolve(),
}));

describe('SettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial settings', () => {
    expect(SettingsStore.getReadingMode()).toBe('vertical');
    expect(SettingsStore.getDarkMode()).toBe(true);
  });

  it('should update reading mode and notify listeners', () => {
    const listener = vi.fn();
    SettingsStore.subscribe(listener);
    
    SettingsStore.setReadingMode('horizontal');
    
    expect(SettingsStore.getReadingMode()).toBe('horizontal');
    expect(StorageService.saveSettings).toHaveBeenCalledWith({ readingMode: 'horizontal' });
    expect(listener).toHaveBeenCalled();
  });

  it('should update dark mode', () => {
    SettingsStore.setDarkMode(false);
    expect(SettingsStore.getDarkMode()).toBe(false);
    expect(StorageService.saveSettings).toHaveBeenCalledWith({ darkMode: false });
  });

  it('should update dev mode', () => {
    SettingsStore.setDevMode(true);
    expect(SettingsStore.getDevMode()).toBe(true);
    expect(StorageService.saveSettings).toHaveBeenCalledWith({ devMode: true });
  });
});
