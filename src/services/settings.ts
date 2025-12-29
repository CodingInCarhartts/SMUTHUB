// Settings store with Supabase sync
import { StorageService, storageReady, type AppSettings } from './storage';

export type ReadingMode = 'vertical' | 'horizontal';

let settings: AppSettings = StorageService.getSettingsSync();

const listeners: Set<() => void> = new Set();

// Initialize from native storage first, then Supabase
storageReady.then(() => {
  console.log('[SettingsStore] Storage ready, loading settings...');
  // Re-read from storage now that native data is loaded
  settings = StorageService.getSettingsSync();
  listeners.forEach(fn => fn());
  
  // Then try cloud
  return StorageService.getSettings();
}).then(cloudSettings => {
  console.log('[SettingsStore] Cloud settings loaded:', cloudSettings);
  settings = cloudSettings;
  listeners.forEach(fn => fn());
}).catch(e => {
  console.error('[SettingsStore] Failed to load settings:', e);
});

export const SettingsStore = {
  get(): AppSettings {
    return { ...settings };
  },

  getReadingMode(): ReadingMode {
    return settings.readingMode;
  },

  getDarkMode(): boolean {
    return settings.darkMode;
  },

  getDevMode(): boolean {
    return settings.devMode;
  },

  setReadingMode(mode: ReadingMode): void {
    settings.readingMode = mode;
    console.log('[SettingsStore] Reading mode set to:', mode);
    StorageService.saveSettings({ readingMode: mode });
    listeners.forEach(fn => fn());
  },

  setDarkMode(enabled: boolean): void {
    console.log('[SettingsStore] Toggling dark mode to:', enabled);
    settings.darkMode = enabled;
    StorageService.saveSettings({ darkMode: enabled });
    listeners.forEach(fn => fn());
  },

  setDevMode(enabled: boolean): void {
    console.log('[SettingsStore] Developer mode set to:', enabled);
    settings.devMode = enabled;
    StorageService.saveSettings({ devMode: enabled });
    listeners.forEach(fn => fn());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
