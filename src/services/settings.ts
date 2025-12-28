// Simple settings store using module-level state
// In a real app, this would persist to AsyncStorage/localStorage

export type ReadingMode = 'vertical' | 'horizontal';

interface AppSettings {
  readingMode: ReadingMode;
}

let settings: AppSettings = {
  readingMode: 'vertical'  // Default to webtoon vertical
};

const listeners: Set<() => void> = new Set();

export const SettingsStore = {
  get(): AppSettings {
    return { ...settings };
  },

  getReadingMode(): ReadingMode {
    return settings.readingMode;
  },

  setReadingMode(mode: ReadingMode): void {
    settings.readingMode = mode;
    console.log('[SettingsStore] Reading mode set to:', mode);
    listeners.forEach(fn => fn());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
