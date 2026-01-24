import { parse } from 'node-html-parser';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

import { logCapture } from '../debugLog';

// Helper for debug logging
const log = (msg: string) => logCapture('log', `[Mangapark] ${msg}`);
const logError = (msg: string, e?: any) =>
  logCapture('error', `[Mangapark] ${msg}`, e);
const logWarn = (msg: string) => logCapture('warn', `[Mangapark] ${msg}`);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://mangakatana.com',
};

const BASE_URL = 'https://mangakatana.com';

function fixUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

// Helper for fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    log(`[Fetch] Starting request to ${url} (timeout: ${timeout}ms)`);
    const fetchPromise = fetch(url, {
      ...options,
      signal: controller.signal as any, // Lynx might strictly type signal
    });

    // Fallback race in case signal is ignored by environment
    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timed out after ${timeout}ms`)),
        timeout,
      ),
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(id);
    log(`[Fetch] Response received: ${response.status} ${response.statusText}`);
    return response;
  } catch (e) {
    clearTimeout(id);
    logError(`[Fetch] Failed: ${url}`, e);
    throw e;
  }
}

export const MangaparkService: MangaSource = {
  id: 'mangapark',
  name: 'MangaPark',
  baseUrl: BASE_URL,
  isNsfwSource: false,
  headers: HEADERS,

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    try {
      log(`Searching for: ${query}`);
      const url = `${this.baseUrl}/?search=${encodeURIComponent(query)}`;

      const response = await fetchWithTimeout(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const html = await response.text();
      const root = parse(html);

      const items = root.querySelectorAll('#book_list .item');

      return items
        .map((item): Manga | null => {
          const titleEl = item.querySelector('.text .title a');
          const imgEl = item.querySelector('.media .wrap_img img');
          const genreEls = item.querySelectorAll('.text .genres a');

          if (!titleEl) return null;

          const href = titleEl.getAttribute('href') || '';
          const id = href.split('/').pop() || '';

          return {
            id: `mangapark:${id}`,
            title: titleEl.text.trim(),
            url: href,
            cover: fixUrl(imgEl?.getAttribute('src')),
            genres: genreEls.map((g) => g.text.trim()),
            source: 'mangapark',
          };
        })
        .filter((m): m is Manga => m !== null);
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(idOrUrl: string): Promise<MangaDetails | null> {
    try {
      const url = idOrUrl.startsWith('http')
        ? idOrUrl
        : `${this.baseUrl}/manga/${idOrUrl.replace('mangapark:', '')}`;
      log(`Fetching details: ${url}`);

      const response = await fetchWithTimeout(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const html = await response.text();
      const root = parse(html);

      const title = root.querySelector('h1.heading')?.text?.trim() || 'Unknown';
      const imgEl = root.querySelector('.cover img');
      const desc = root.querySelector('.summary p')?.text?.trim() || '';
      const authorEls = root.querySelectorAll('.info .authors a');
      const genreEls = root.querySelectorAll('.info .genres a');
      const status = root.querySelector('.info .status')?.text?.trim() || '';

      const chapterRows = root.querySelectorAll('.chapters table tbody tr');
      const chapters = chapterRows
        .map((row) => {
          const a = row.querySelector('td .chapter a');
          const updateTime = row.querySelector('td .update_time')?.text?.trim();

          if (!a) return null;

          const href = a.getAttribute('href') || '';

          return {
            id: href,
            title: a.text.trim(),
            url: href,
            uploadDate: updateTime,
            source: 'mangapark',
          };
        })
        .filter((c) => c !== null) as any[];

      return {
        id: idOrUrl,
        title,
        url,
        cover: fixUrl(imgEl?.getAttribute('src')),
        description: desc,
        authors: authorEls.map((a) => a.text.trim()),
        genres: genreEls.map((g) => g.text.trim()),
        status,
        chapters,
        source: 'mangapark',
      };
    } catch (e) {
      logError('Details failed', e);
      return null;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    try {
      log(`Fetching chapter: ${chapterIdOrUrl}`);
      const response = await fetchWithTimeout(chapterIdOrUrl, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const html = await response.text();

      // MangaKatana stores images in script variables
      const matches = html.matchAll(/var\s+[a-z0-9]+\s*=\s*\[(.*?)\];/gis);
      for (const match of matches) {
        const arrayStr = match[1];
        // Extract all URLs from the matched array string
        const urls = arrayStr.match(/https?:\/\/[^'"]+/g);

        if (urls && urls.length > 5) {
          // Reliable filter for the real image list
          return [...new Set(urls)].map((u) => u.replace(/\\/g, ''));
        }
      }

      return [];
    } catch (e) {
      logError('Chapter pages failed', e);
      return [];
    }
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    return { popular: [], latest: [] };
  },

  async getPopular(): Promise<Manga[]> {
    try {
      log('getPopular: Start');
      const response = await fetchWithTimeout(BASE_URL, { headers: HEADERS });
      log('getPopular: Fetch complete');
      
      const text = await response.text();
      log(`[Popular] Body length: ${text.length}`);
      if (text.length < 500) {
          logWarn(`[Popular] Suspiciously short body: ${text.substring(0, 100)}`);
      }

      const root = parse(text); 
      const items = root.querySelectorAll('#hot_book .item');
      log(`[Popular] Found ${items.length} items`);

      if (items.length > 0) {
        return items.map((item) => {
          const a = item.querySelector('.title a');
          const img = item.querySelector('img');
          const href = a?.getAttribute('href') || '';
          return {
            id: `mangapark:${href.split('/').pop()}`,
            title: a?.text.trim() || 'Unknown',
            url: href,
            cover: fixUrl(img?.getAttribute('src')),
            source: 'mangapark',
          };
        });
      }

      log('[Popular] Fallback to search');
      return this.search('');
    } catch (e) {
      logError('Popular failed', e);
      return [];
    }
  },

  async getLatest(): Promise<Manga[]> {
    try {
      log('getLatest: Start');
      const url = `${BASE_URL}/latest`;
      const response = await fetchWithTimeout(url, { headers: HEADERS });
      log('getLatest: Fetch complete');
      const html = await response.text();
      const root = parse(html);

      const items = root.querySelectorAll('#book_list .item');

      return items
        .map((item): Manga | null => {
          const a = item.querySelector('.text .title a');
          const img = item.querySelector('.media .wrap_img img');
          const href = a?.getAttribute('href') || '';
          const genreEls = item.querySelectorAll('.text .genres a');

          if (!a) return null;

          return {
            id: `mangapark:${href.split('/').pop()}`,
            title: a.text.trim(),
            url: href,
            cover: fixUrl(img?.getAttribute('src')),
            genres: genreEls.map((g) => g.text.trim()),
            source: 'mangapark',
          };
        })
        .filter((m): m is Manga => m !== null);
    } catch (e) {
      logError('Latest failed', e);
      return [];
    }
  },
};
