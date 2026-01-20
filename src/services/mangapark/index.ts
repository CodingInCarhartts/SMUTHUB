import { parse } from 'node-html-parser';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

import { logCapture } from '../debugLog';

// Helper for debug logging
const log = (msg: string) => logCapture('log', `[Mangapark] ${msg}`);
const logError = (msg: string, e?: any) =>
  logCapture('error', `[Mangapark] ${msg}`, e);

export const MangaparkService = {
  id: 'mangapark',
  name: 'MangaPark',
  baseUrl: 'https://mangapark.net',
  isNsfwSource: false,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://mangapark.net',
  },

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
      // Select search results
      // Verified selector from homepage/search dump
      const items = root.querySelectorAll('div.group.relative');

      return items
        .map((item): Manga | null => {
          const titleEl = item.querySelector('h3 a, a.link-hover.font-bold');
          const imgEl = item.querySelector('img');
          // In search results, author might be missing or different
          const authorEl = item.querySelector('.text-muted, .author'); 

          const urlEl = item.querySelector('a[href^="/title/"]');
          if (!urlEl) return null;

          const url = urlEl.getAttribute('href') || '';
          // ID is often in the URL: /title/12345/name
          const id = url.match(/\/title\/(\d+)/)?.[1] || ''; 

          return {
            id: `mangapark:${id}`,
            title: titleEl?.text?.trim() || 'Unknown',
            url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
            cover: imgEl?.getAttribute('src') || '',
            authors: authorEl ? [authorEl.text.trim()] : [],
            source: 'mangapark',
          };
        })
        .filter((m): m is Manga => m !== null && m.id !== 'mangapark:');
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
        root.querySelector('img.shadow-md')?.getAttribute('src') || '';
      const desc = root.querySelector('.limit-html')?.text?.trim() || '';

      // Chapters
      // Select all links and filter by chapter pattern
      const allLinks = root.querySelectorAll('a');
      const chapters = allLinks
        .map((link) => {
          const href = link.getAttribute('href');
          if (!href) return null;
          
          // Mangapark chapter links usually look like: /title/ID-slug/ID-chapter-NUMBER
          // or just contain "chapter-" segment
          if (!href.includes('-chapter-')) return null;

          // Some links might be "Read Chapter 1" buttons, duplication is fine or specific filtering
          // We want the list items.
          // Usually in a list container, but global filter is robust if we dedup
          
          const chTitle = link.text.trim();
          // Filter out "Read" buttons which might be "Start Reading"
          if (chTitle === 'Start Reading') return null;
          if (!chTitle) return null;

          return {
            id: href,
            title: chTitle,
            url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
            source: 'mangapark',
          };
        })
        .filter((c) => c !== null) as any[];

         // Dedup chapters by ID/URL
        const uniqueChapters = new Map();
        for (const ch of chapters) {
            if (!uniqueChapters.has(ch.id)) {
                uniqueChapters.set(ch.id, ch);
            }
        }
        
        // Sort chapters? usually they are in order on page
        const finalChapters = Array.from(uniqueChapters.values());

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

      // Mangapark uses Qwik, so data is often in <script type="qwik/json">
      const scripts = root.querySelectorAll('script[type="qwik/json"]');
      
      let allImages: string[] = [];
      
      // Strategy 1: Parse generic Qwik JSON and look for image patterns
      for (const script of scripts) {
          try {
              const jsonStr = script.text; // .text usually contains the raw content provided by node-html-parser
              // Flatten the JSON string to search for URLs
              // We match standard image extensions. Mangapark images usually hosted on mpvim.org or similar
              // We filter for large images, not thumbs, but thumbs often have 'thumb' in path
              const matches = jsonStr.match(/https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)/g);
              
              if (matches) {
                  const images = [...new Set(matches)]; // Unique
                  // Filter out likely thumbnails or avatars if possible
                  // Mangapark chapter images often have /media/mpup/ or similar
                  // Avatars often have /thumb/
                  const contentImages = images.filter(url => !url.includes('/thumb/') && !url.includes('avatar'));
                  
                  if (contentImages.length > allImages.length) {
                      allImages = contentImages;
                  }
              }
          } catch (e) {
              // Ignore parse errors, try next
          }
      }

      // Fallback: Check strictly for load_pages if they revert
      if (allImages.length === 0) {
          const scriptContent = root.querySelectorAll('script').map((s) => s.text).join('\n');
          const match = scriptContent.match(/load_pages\s*=\s*(\[.*?\])/s);
          if (match) {
            const json = JSON.parse(match[1]);
            allImages = json.map((p: any) => p.u); 
          }
      }

      return allImages;
    } catch (e) {
      logError('Chapter pages failed', e);
      return [];
    }
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    try {
      log('Fetching home feed (via search aggregations)');
      
      const [popular, latest] = await Promise.all([
          this.getPopular(),
          this.getLatest()
      ]);

      log(`Home feed fetched: ${popular.length} popular, ${latest.length} latest`);
      
      return {
          popular,
          latest,
      };

    } catch (e) {
      logError('Home feed failed', e);
      return { popular: [], latest: [] };
    }
  },

  async getPopular(page = 1): Promise<Manga[]> {
    return this.search('', { sortBy: 'rating' } as any); // Fallback to search sorted
  },

  async getLatest(page = 1): Promise<Manga[]> {
      return this.search('', { sortBy: 'latest' } as any); // Fallback to search sorted
  },
};
