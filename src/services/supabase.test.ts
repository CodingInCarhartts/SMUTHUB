import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseService } from './supabase';

describe('SupabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request', () => {
    it('should perform a successful fetch and parse JSON', async () => {
      const mockResponse = { data: 'ok' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as any);

      const result = await SupabaseService.request('/test');
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: expect.any(String),
          }),
        })
      );
    });

    it('should return null for non-ok responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      } as any);

      const result = await SupabaseService.request('/error');
      expect(result).toBeNull();
    });

    it('should return null for 204 No Content', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as any);

      const result = await SupabaseService.request('/empty');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should fetch all rows from a table', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([{ id: 1 }, { id: 2 }])),
      } as any);

      const rows = await SupabaseService.getAll('my_table');
      expect(rows).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/my_table'), expect.any(Object));
    });
  });

  describe('upsert', () => {
    it('should perform a POST request with correct headers', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as any);
      const success = await SupabaseService.upsert('table', { id: 1 }, 'id');
      expect(success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('on_conflict=id'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ id: 1 }),
        })
      );
    });
  });

  describe('delete', () => {
    it('should perform a DELETE request with correctly formatted filter', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as any);
      await SupabaseService.delete('table', 'id', '123');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?id=eq.123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
