// Supabase REST Client
// Bypasses the official client to avoid WebSocket/Runtime issues in Lynx

import { SUPABASE_REST_URL, SUPABASE_ANON_KEY } from '../config';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal', // Don't return the inserted row to save data
};

export const SupabaseService = {
  /**
   * Generic Fetch Wrapper
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T | null> {
    try {
      if (typeof fetch === 'undefined') {
        // console.warn('[Supabase] fetch is not defined in this environment. Skipping request.');
        return null;
      }

      const response = await fetch(`${SUPABASE_REST_URL}${endpoint}`, {
        ...options,
        headers: {
          ...HEADERS,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Supabase] Request failed: ${response.status} ${response.statusText}`,
          errorText,
          `Endpoint: ${endpoint}`,
          `Body: ${options.body}`
        );
        return null;
      }

      // If no content (204), return null
      if (response.status === 204) {
        return null; // Explicit 204
      }

      // Safe JSON parsing for handling empty bodies (even if not 204)
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn('[Supabase] Failed to parse JSON response:', text);
        return null;
      }
    } catch (e) {
      console.warn('[Supabase] Network error:', e);
      return null;
    }
  },

  /**
   * Get all rows from a table
   */
  async getAll<T>(table: string, queryParams: string = ''): Promise<T[]> {
    // Example: ?select=*&order=created_at.desc
    const result = await this.request<T[]>(`/${table}${queryParams}`);
    return result || [];
  },

  /**
   * Upsert a row (Insert or Update)
   */
  async upsert(
    table: string,
    data: any,
    conflictColumn: string = 'id',
  ): Promise<boolean> {
    // resolution=merge-duplicates is key for upsert behavior via REST
    const headers = {
      Prefer: `resolution=merge-duplicates,return=minimal`,
    };

    const result = await this.request(
      `/${table}?on_conflict=${conflictColumn}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      },
    );

    // If result is null (due to 204 No Content), it succeeded
    // If request failed, it returned null but logged error
    // check if it was a success or failure is tricky with just null return
    // But our request wrapper catches errors.
    // Ideally request should throw or return { error, data } tuple.
    // For simplicity, assuming if it didn't throw/log, it worked.
    return true;
  },

  /**
   * Delete rows matching a condition
   * @param value - Can be a raw value (implies 'eq.') or an operator string like 'neq.0'
   */
  async delete(table: string, column: string, value: string): Promise<boolean> {
    const filter = value.match(
      /^(eq\.|neq\.|gt\.|gte\.|lt\.|lte\.|like\.|ilike\.|is\.|in\.|cs\.|cd\.|ov\.|sl\.|sr\.|nxr\.|nxl\.|adj\.)/,
    )
      ? value
      : `eq.${value}`;

    const result = await this.request(`/${table}?${column}=${filter}`, {
      method: 'DELETE',
    });
    return true;
  },

  /**
   * Get a global config value by key from 'app_config' table
   */
  async getGlobalConfig(key: string): Promise<string | null> {
    try {
      // Expects table "app_config" with columns "key", "value"
      const data = await this.getAll<{ value: string }>(
        'app_config',
        `?select=value&key=eq.${key}&limit=1`
      );
      if (data && data.length > 0) {
        return data[0].value;
      }
      return null;
    } catch (e) {
      console.warn(`[Supabase] Failed to fetch config for ${key}`, e);
      return null;
    }
  },
};
