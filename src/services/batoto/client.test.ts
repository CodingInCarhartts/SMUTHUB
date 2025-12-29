import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatotoClient } from './client';

describe('BatotoClient', () => {
  let client: BatotoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - reset private singleton for testing
    BatotoClient.instance = null;
    client = BatotoClient.getInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = BatotoClient.getInstance();
      const instance2 = BatotoClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should resolve to the first responding mirror', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
      } as any);

      await client.initialize();
      expect(client.getBaseUrl()).toBe('https://bato.si');
      expect(fetch).toHaveBeenCalledWith('https://bato.si', expect.any(Object));
    });

    it('should fall back if mirrors fail', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      await client.initialize();
      expect(client.getBaseUrl()).toBe('https://bato.si');
    });
  });

  describe('fetch', () => {
    it('should include user agent and referer headers', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
      } as any);

      await client.fetch('/test');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Referer': expect.any(String),
          }),
        })
      );
    });

    it('should save and send cookies', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'set-cookie': 'session=123; path=/' }),
      } as any);

      await client.fetch('/login');
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as any);

      await client.fetch('/profile');
      
      expect(fetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': 'session=123',
          }),
        })
      );
    });
  });
});
