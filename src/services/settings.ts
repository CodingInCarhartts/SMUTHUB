// Settings store with Supabase sync
import { StorageService, type AppSettings } from './storage';

export type ReadingMode = 'vertical' | 'horizontal';

let settings: AppSettings = StorageService.getSettingsSync();

const listeners: Set<() => void> = new Set();

// Initialize from Supabase async
StorageService.getSettings().then(cloudSettings => {
  settings = cloudSettings;
  listeners.forEach(fn => fn());
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

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
