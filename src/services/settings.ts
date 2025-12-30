// Settings store with Supabase sync
import { type AppSettings, StorageService, storageReady } from './storage';

let settings: AppSettings = StorageService.getSettingsSync();

const listeners: Set<() => void> = new Set();

// Initialize from native storage first, then Supabase
storageReady
  .then(() => {
    console.log('[SettingsStore] Storage ready, loading settings...');
    // Re-read from storage now that native data is loaded
    settings = StorageService.getSettingsSync();
    listeners.forEach((fn) => fn());

    // Then try cloud
    return StorageService.getSettings();
  })
  .then((cloudSettings) => {
    console.log('[SettingsStore] Cloud settings loaded:', cloudSettings);
    settings = cloudSettings;
    listeners.forEach((fn) => fn());
  })
  .catch((e) => {
    console.error('[SettingsStore] Failed to load settings:', e);
  });

export const SettingsStore = {
  get(): AppSettings {
    return { ...settings };
  },

  getDarkMode(): boolean {
    return settings.darkMode;
  },

  getDevMode(): boolean {
    return settings.devMode;
  },

  getScrollSpeed(): number {
    return settings.scrollSpeed ?? 0.15;
  },

  setDarkMode(enabled: boolean): void {
    console.log('[SettingsStore] Toggling dark mode to:', enabled);
    settings.darkMode = enabled;
    StorageService.saveSettings({ darkMode: enabled });
    listeners.forEach((fn) => fn());
  },

  setDevMode(enabled: boolean): void {
    console.log('[SettingsStore] Developer mode set to:', enabled);
    settings.devMode = enabled;
    StorageService.saveSettings({ devMode: enabled });
    listeners.forEach((fn) => fn());
  },

  setScrollSpeed(speed: number): void {
    console.log('[SettingsStore] Scroll speed set to:', speed);
    settings.scrollSpeed = speed;
    StorageService.saveSettings({ scrollSpeed: speed });
    listeners.forEach((fn) => fn());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
