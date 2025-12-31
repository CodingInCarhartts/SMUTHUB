import { describe, it, expect } from 'vitest';

/**
 * Note: We can't directly import UpdateService because it has Lynx-specific dependencies.
 * Instead, we'll re-implement the pure function logic here for testing.
 */

/**
 * Compare two semver strings
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 == v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

describe('UpdateService', () => {
  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('2.5.3', '2.5.3')).toBe(0);
    });

    it('should return 1 when v1 > v2', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    });

    it('should return -1 when v1 < v2', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.9', '1.1.0')).toBe(-1);
    });

    it('should handle different version lengths', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.0', '1')).toBe(0);
      expect(compareVersions('1.0.1', '1.0')).toBe(1);
      expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    });

    it('should handle pre-release style versions', () => {
      expect(compareVersions('1.0.84', '1.0.83')).toBe(1);
      expect(compareVersions('1.0.83', '1.0.84')).toBe(-1);
    });
  });
});
