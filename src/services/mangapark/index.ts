import { parse } from 'node-html-parser';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

// Helper for debug logging
const log = (msg: string) => console.log(`[Mangapark] ${msg}`);
const logError = (msg: string, e?: any) =>
  console.error(`[Mangapark] ${msg}`, e);

export const MangaparkService: MangaSource = {
  id: 'mangapark',
  name: 'MangaPark',
  baseUrl: 'https://mangapark.net',
  isNsfwSource: false,

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    try {
      log(`Searching for: ${query}`);
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const html = await response.text();
      const root = parse(html);

      // Select search results
      // Inspecting Mangapark structure (approximate, based on common patterns or previous knowledge)
      // Usually .item class or similar
      const items = root.querySelectorAll('.row.mt-2.border-bottom.pb-2');

      return items
        .map((item) => {
          const titleEl = item.querySelector('.fw-bold a');
          const imgEl = item.querySelector('img');
          const authorEl = item.querySelector('.text-muted');

          const url = titleEl?.getAttribute('href') || '';
          // ID is often in the URL: /title/12345/name
          const id = url.match(/\/title\/(\d+)/)?.[1] || ''; // Fallback ID extraction

          return {
            id: `mangapark:${id}`,
            title: titleEl?.text?.trim() || 'Unknown',
            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
            cover: imgEl?.getAttribute('src') || '',
            authors: authorEl ? [authorEl.text.trim()] : [],
            source: 'mangapark',
          };
        })
        .filter((m) => m.id !== 'mangapark:');
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(idOrUrl: string): Promise<MangaDetails | null> {
    try {
      const url = idOrUrl;
      if (!idOrUrl.startsWith('http')) {
        // If we have just ID, we might need a search or a direct construct if format is known
        // Mangapark URLs are usually /title/ID/SLUG.
        // If we only have ID, we might fail unless we stored the full URL.
        // For now assume passed URL or ID that we can't easily resolving without slug.
        // But `search` returns full URL, so let's allow passing full URL.
        return null;
      }

      log(`Fetching details: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      const html = await response.text();
      const root = parse(html);

      const title = root.querySelector('h3 a')?.text?.trim() || 'Unknown';
      const cover =
        root.querySelector('.attr-cover img')?.getAttribute('src') || '';
      const desc = root.querySelector('.limit-html')?.text?.trim() || '';

      // Chapters
      // Mangapark has complex chapter lists.
      const chapterItems = root.querySelectorAll('.chapter-item');
      const chapters = chapterItems
        .map((el) => {
          const link = el.querySelector('a.link-dark');
          if (!link) return null;

          const chUrl = link.getAttribute('href') || '';
          const chTitle = link.text.trim();

          return {
            id: chUrl,
            title: chTitle,
            url: chUrl.startsWith('http') ? chUrl : `${this.baseUrl}${chUrl}`,
            source: 'mangapark',
          };
        })
        .filter((c) => c !== null) as any[];

      return {
        id: idOrUrl,
        title,
        url,
        cover,
        description: desc,
        chapters,
        source: 'mangapark',
      };
    } catch (e) {
      logError('Details failed', e);
      return null;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    // Mangapark usually puts pages in a JSON variable `const load_pages = [...]`
    try {
      log(`Fetching chapter: ${chapterIdOrUrl}`);
      const response = await fetch(chapterIdOrUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      const html = await response.text();
      const root = parse(html);

      const scriptContent = root
        .querySelectorAll('script')
        .map((s) => s.text)
        .join('\n');
      const match = scriptContent.match(/load_pages\s*=\s*(\[.*?\])/s);

      if (match) {
        const json = JSON.parse(match[1]);
        return json.map((p: any) => p.u); // 'u' is usually the url property
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


};
