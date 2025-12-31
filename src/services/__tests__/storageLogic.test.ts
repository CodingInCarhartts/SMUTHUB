import { describe, it, expect, vi } from 'vitest';
import { normalizeUrl } from '../../services/storage';

// Mock native storage to prevent "NativeModules is not defined" error
vi.mock('../../services/nativeStorage', () => ({
  getNativeItem: vi.fn(),
  setNativeItem: vi.fn(),
  hasNativeStorage: () => false,
}));

describe('Storage Logic', () => {
  describe('normalizeUrl', () => {
    it('should return empty string for undefined/null/empty', () => {
      expect(normalizeUrl(undefined)).toBe('');
      expect(normalizeUrl('')).toBe('');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeUrl('https://example.com/chapter/1/')).toBe('https://example.com/chapter/1');
      expect(normalizeUrl('https://example.com/chapter/1///')).toBe('https://example.com/chapter/1');
    });

    it('should lowercase the URL', () => {
      expect(normalizeUrl('HTTPS://EXAMPLE.COM/Chapter/1')).toBe('https://example.com/chapter/1');
    });

    it('should handle URLs without trailing slashes correctly', () => {
      expect(normalizeUrl('https://example.com/chapter/1')).toBe('https://example.com/chapter/1');
    });
  });
});
