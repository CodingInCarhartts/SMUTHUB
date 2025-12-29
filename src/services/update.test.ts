import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateService, APP_VERSION } from './update';
import { SupabaseService } from './supabase';

vi.mock('./supabase', () => ({
  SupabaseService: {
    getAll: vi.fn(),
  },
}));

describe('UpdateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('compareVersions', () => {
    it('should correctly compare semver strings', () => {
      expect(UpdateService.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(UpdateService.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(UpdateService.compareVersions('1.1.0', '1.0.5')).toBe(1);
      expect(UpdateService.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(UpdateService.compareVersions('2.0.0', '1.9.9')).toBe(1);
    });
  });

  describe('checkUpdate', () => {
    it('should return update if newer version exists', async () => {
      vi.mocked(SupabaseService.getAll).mockResolvedValue([{ version: '9.9.9', is_mandatory: true, release_notes: 'cool' }]);
      const update = await UpdateService.checkUpdate();
      expect(update?.version).toBe('9.9.9');
    });

    it('should return null if version is skipped', async () => {
      vi.mocked(SupabaseService.getAll).mockResolvedValue([{ version: '1.0.4', is_mandatory: false }]);
      localStorage.setItem('batoto:skipped_version', '1.0.4');
      const update = await UpdateService.checkUpdate();
      expect(update).toBeNull();
    });

    it('should not skip mandatory updates', async () => {
      vi.mocked(SupabaseService.getAll).mockResolvedValue([{ version: '1.0.4', is_mandatory: true }]);
      localStorage.setItem('batoto:skipped_version', '1.0.4');
      const update = await UpdateService.checkUpdate();
      expect(update?.version).toBe('1.0.4');
    });
  });

  describe('native updates', () => {
    it('should check for native APK updates', async () => {
      vi.mocked(SupabaseService.getAll).mockResolvedValue([{ version: '2.0.0', download_url: 'http://apk.com', is_mandatory: false }]);
      const update = await UpdateService.checkNativeUpdate();
      expect(update?.version).toBe('2.0.0');
      expect(update?.url).toBe('http://apk.com');
    });

    it('should install native update via module', async () => {
      const g = globalThis as any;
      await UpdateService.installNativeUpdate('http://apk');
      expect(g.NativeModules.NativeUpdaterModule.installUpdate).toHaveBeenCalledWith('http://apk');
    });
  });

  describe('OTA Updates', () => {
    it('should reload lynx on applyUpdate', async () => {
      const g = globalThis as any;
      await UpdateService.applyUpdate();
      expect(g.lynx.reload).toHaveBeenCalled();
    });

    it('should handle reload error', async () => {
      const g = globalThis as any;
      g.lynx.reload.mockImplementationOnce(() => { throw new Error('Reload Fail'); });
      await expect(UpdateService.applyUpdate()).resolves.toBeUndefined();
    });
  });

  describe('skipVersion', () => {
    it('should store skipped version in localStorage', () => {
      UpdateService.skipVersion('1.0.4');
      expect(localStorage.setItem).toHaveBeenCalledWith('batoto:skipped_version', '1.0.4');
    });
  });
});
