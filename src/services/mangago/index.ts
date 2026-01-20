import { parse } from 'node-html-parser';
import { NetworkLogService } from '../networkLog';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

// Helper for debug logging
const log = (msg: string) => console.log(`[Mangago] ${msg}`);
const logError = (msg: string, e?: any) => console.error(`[Mangago] ${msg}`, e);

export const MangagoService = {
  id: 'mangago',
  name: 'Mangago',
  baseUrl: 'https://mangago.me',
  isNsfwSource: true,

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    try {
      log(`Searching for: ${query}`);
      const url = `${this.baseUrl}/r/l_search/?name=${encodeURIComponent(query)}`;

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
      // Mangago usually lists results in <ul id="search_list"> <li>...</li>
      const items = root.querySelectorAll('#search_list li');

      return items
        .map((item) => {
          const titleEl = item.querySelector('.title a');
          const imgEl = item.querySelector('.left img');
          const genreEl = item.querySelector('.genre');

          const url = titleEl?.getAttribute('href') || '';
          const id = url.split('/read-manga/')[1]?.replace(/\/$/, '') || '';

          return {
            id: `mangago:${id}`,
            title: titleEl?.text?.trim() || 'Unknown',
            url: url,
            cover: imgEl?.getAttribute('src') || '',
            source: 'mangago',
          };
        })
        .filter((m) => m.id !== 'mangago:');
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(idOrUrl: string): Promise<MangaDetails | null> {
    try {
      let url = idOrUrl;
      if (!idOrUrl.startsWith('http')) {
        const id = idOrUrl.replace(/^mangago:/, '');
        url = `${this.baseUrl}/read-manga/${id}/`;
      }

      log(`Fetching details: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      const html = await response.text();
      const root = parse(html);

      const title = root.querySelector('.w-title')?.text?.trim() || 'Unknown';
      const cover = root.querySelector('.cover img')?.getAttribute('src') || '';
      const plot = root.querySelector('#noid')?.text?.trim() || '';

      // Chapters table
      const chapterRows = root.querySelectorAll('#chapter_table tr');
      const chapters = chapterRows
        .map((row) => {
          const link = row.querySelector('a');
          if (!link) return null;

          const chUrl = link.getAttribute('href') || '';
          const chTitle = link.text.trim();

          // Mangago chapter URLs: /read-manga/manga_id/bt/chapter_id/
          // Extract ID?
          // Let's use the full URL path as ID for simplicity or hash it

          return {
            id: chUrl,
            title: chTitle,
            url: chUrl,
            source: 'mangago',
          };
        })
        .filter((c) => c !== null) as any[];

      return {
        id: idOrUrl,
        title,
        url,
        cover,
        description: plot,
        chapters,
        source: 'mangago',
      };
    } catch (e) {
      logError('Details failed', e);
      return null;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    try {
      let url = chapterIdOrUrl;
      if (!url.startsWith('http')) {
        url = `${this.baseUrl}${chapterIdOrUrl}`;
      }

      log(`Fetching chapter: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      const html = await response.text();
      const root = parse(html);

      // Mangago has all images or requires one page at a time?
      // Usually Mangago has "All pages" mode or single page.
      // We typically look for javascript array "imgsrcs"

      // Match imgsrcs var
      const scriptContent = root
        .querySelectorAll('script')
        .map((s) => s.text)
        .join('\n');
      const match =
        scriptContent.match(/var\s+imgsrcs\s*=\s*new\s+Array\((.*?)\);/s) ||
        scriptContent.match(/imgsrcs\s*=\s*\[(.*?)\]/s);

      if (match) {
        const raw = match[1];
        // cleanup quotes and split
        const urls = raw
          .replace(/['"\s\n]/g, '')
          .split(',')
          .filter((u) => u);
        return urls;
      }

      return [];
    } catch (e) {
      logError('Chapter pages failed', e);
      return [];
    }
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    try {
      log('Fetching home feed...');
      const [popular, latest] = await Promise.all([
        this.getPopular(),
        this.getLatest(),
      ]);
      return { popular, latest };
    } catch (e) {
      logError('getHomeFeed failed', e);
      return { popular: [], latest: [] };
    }
  },

  async getPopular(): Promise<Manga[]> {
    try {
      // Use directory sorted by views (guessing param o=v based on common engines, or default)
      // If o=v doesn't work, it defaults to alphabetical, which is better than empty.
      const url = `${this.baseUrl}/list/directory/all/1/?o=v`; 
      log(`Fetching popular: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      const html = await response.text();
      const root = parse(html);

      // Directory items structure: .flex1.listitem
      const items = root.querySelectorAll('.listitem');
      
      return items.map(item => {
        const left = item.querySelector('.left');
        const link = left?.querySelector('a');
        const img = left?.querySelector('img');
        const titleSpan = item.querySelector('span.title a');
        
        const fullUrl = link?.getAttribute('href') || '';
        // Extract ID: /read-manga/manga_id/
        const id = fullUrl.split('/read-manga/')[1]?.replace(/\/$/, '') || '';

        return {
          id: `mangago:${id}`,
          title: titleSpan?.text?.trim() || link?.getAttribute('title') || 'Unknown',
          url: fullUrl,
          cover: img?.getAttribute('data-src') || img?.getAttribute('src') || '',
          source: 'mangago'
        };
      }).filter(m => m.id !== 'mangago:');

    } catch (e) {
      logError('getPopular failed', e);
      return [];
    }
  },

  async getLatest(): Promise<Manga[]> {
    try {
      // Scrape homepage for "Latest Updates"
      // They are usually in li.toplist
      const url = this.baseUrl;
      log(`Fetching latest from homepage: ${url}`);

      const response = await fetch(url, {
         headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: this.baseUrl,
        },
      });

      const html = await response.text();
      const root = parse(html);

      const items = root.querySelectorAll('li.toplist');

      return items.map(item => {
         const left = item.querySelector('.left.listimg');
         const link = left?.querySelector('a');
         const img = left?.querySelector('img');
         
         // Title is in .right h3 a
         const titleEl = item.querySelector('.right h3 a');
         
         const fullUrl = link?.getAttribute('href') || '';
         const id = fullUrl.split('/read-manga/')[1]?.replace(/\/$/, '') || '';
         
         const latestChapter = item.querySelector('.right ul li a')?.text?.trim();

         return {
           id: `mangago:${id}`,
           title: titleEl?.text?.trim() || link?.getAttribute('title') || 'Unknown',
           url: fullUrl,
           cover: img?.getAttribute('data-src') || img?.getAttribute('src') || '',
           latestChapter: latestChapter,
           source: 'mangago'
         };
      }).filter(m => m.id !== 'mangago:');
      
    } catch (e) {
      logError('getLatest failed', e);
      return [];
    }
  },


};
