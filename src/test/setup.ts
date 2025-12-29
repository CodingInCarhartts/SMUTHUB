import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Register Lynx custom elements as web components for jsdom
// Only hyphenated names need registration; single-word elements work automatically
if (typeof customElements !== 'undefined') {
  const lynxElements = ['scroll-view', 'list-item', 'swiper-item'];
  lynxElements.forEach(tagName => {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, class extends HTMLElement {});
    }
  });
}

// Mock Lynx globals
(globalThis as any).lynx = {
  reload: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

(globalThis as any).SystemInfo = {
  deviceId: 'test-device-id',
  platform: 'android',
  pixelRatio: 3,
  pixelWidth: 1080,
  pixelHeight: 1920,
  osVersion: '13',
  runtimeType: 'lynx',
  lynxSdkVersion: '3.4.11',
};

(globalThis as any).NativeModules = {
  NativeLocalStorageModule: {
    setStorageItem: vi.fn(),
    getStorageItem: vi.fn((key, cb) => cb(null)),
    clearStorage: vi.fn(),
  },
  NativeUIModule: {
    setImmersiveMode: vi.fn(),
    setBrightness: vi.fn(),
    setOrientation: vi.fn(),
  },
  NativeToastModule: {
    show: vi.fn(),
  },
  NativeHapticModule: {
    vibrate: vi.fn(),
  },
  NativeUtilsModule: {
    copyToClipboard: vi.fn(),
    shareText: vi.fn(),
  },
  NativeUpdaterModule: {
    getNativeVersion: vi.fn(() => '1.0.0'),
    installUpdate: vi.fn(),
  },
};

// Mock LocalStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

(globalThis as any).localStorage = localStorageMock;

// Mock fetch
(globalThis as any).fetch = vi.fn();
