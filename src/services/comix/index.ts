
import { parse } from 'node-html-parser';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';
import { logCapture } from '../debugLog';

const log = (msg: string) => logCapture('log', `[Comix] ${msg}`);
const logError = (msg: string, e?: any) => logCapture('error', `[Comix] ${msg}`, e);

export const ComixService: MangaSource = {
  id: 'comix',
  name: 'Comix',
  baseUrl: 'https://comix.to',
  isNsfwSource: false,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://comix.to/',
    Origin: 'https://comix.to',
  },


  async getPopular(): Promise<Manga[]> {
    try {
      log('Fetching popular/home feed');
      const response = await fetch(`${this.baseUrl}/home`, {
        headers: this.headers,
      });
      const html = await response.text();
      const root = parse(html);

      const items: Manga[] = [];

      // Selectors:
      // Slider: .swiper-slide.item
      // Grid: .comic .item
      const nodes = root.querySelectorAll('.item');
      
      nodes.forEach((node) => {
          // Check if it's a manga item
          const anchor = node.querySelector('a.poster');
          const titleEl = node.querySelector('.detail .title') || node.querySelector('.title');
          const imgEl = node.querySelector('img');
          const chapterEl = node.querySelector('.metadata span');

          const href = anchor?.getAttribute('href');
          const title = titleEl?.textContent?.trim();
          const cover = imgEl?.getAttribute('src');
          const latestChap = chapterEl?.textContent?.trim();

          if (href && title && href.includes('/title/')) {
            const id = href.split('/title/')[1] || href;
            
            items.push({
              id,
              title,
              url: `${this.baseUrl}${href}`,
              cover: cover || '',
              latestChapter: latestChap || '',
              status: 'Unknown', 
              authors: [],
            });
          }
      });
      
      // De-duplicate
      const uniqueItems = new Map();
      items.forEach(i => uniqueItems.set(i.id, i));

      log(`Found ${uniqueItems.size} items`);
      return Array.from(uniqueItems.values());
    } catch (e) {
      logError('Failed to fetch popular manga', e);
      return [];
    }
  },

  async getLatest(): Promise<Manga[]> {
       // Comix home feed mixes popular and latest.
       // We can just reuse getPopular or try to find a specific latest section.
       // For now, return same as popular or empty if paginated differently.
       return this.getPopular();
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
      const popular = await this.getPopular();
      return { popular, latest: [] };
  },

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    try {
      log(`Searching for: ${query}`);
      const url = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: this.headers });
      const html = await response.text();
      const root = parse(html);

      const items: Manga[] = [];
      const nodes = root.querySelectorAll('.item');

       nodes.forEach((node) => {
          const anchor = node.querySelector('a.poster');
          const titleEl = node.querySelector('.detail .title') || node.querySelector('.title');
          const imgEl = node.querySelector('img');
          const latestEl = node.querySelector('.metadata span');

          const href = anchor?.getAttribute('href');
          const title = titleEl?.textContent?.trim();
          const cover = imgEl?.getAttribute('src');
          const latest = latestEl?.textContent?.trim();

          if (href && title && href.includes('/title/')) {
             const id = href.split('/title/')[1] || href;
             items.push({
               id,
               title,
               url: `${this.baseUrl}${href}`,
               cover: cover || '',
               latestChapter: latest || '',
               status: 'Unknown',
               authors: [],
             });
          }
       });

      log(`Search found ${items.length} items`);
      return items;
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(mangaId: string): Promise<MangaDetails> {
    try {
      // mangaId is expected to be "slug" e.g., "kl6nv-the-dukes-wife-obsession"
      // or full path "title/..."
      const cleanId = mangaId.startsWith('title/') ? mangaId.split('title/')[1] : mangaId;
      const url = `${this.baseUrl}/title/${cleanId}`;
      log(`Fetching details: ${url}`);

      const response = await fetch(url, { headers: this.headers });
      const html = await response.text();
      const root = parse(html);

      // Parse metadata
      const title = root.querySelector('.comic-info h1.title')?.textContent?.trim() || root.querySelector('h1.title')?.textContent?.trim() || 'Unknown Title';
      const desc = root.querySelector('.comic-info .description .content')?.textContent?.trim() || '';
      const cover = root.querySelector('.comic-info .poster img')?.getAttribute('src') || '';
      const author = root.querySelector('.comic-info .metadata a[href*="authors"]')?.textContent?.trim() || '';
      const artist = root.querySelector('.comic-info .metadata a[href*="artists"]')?.textContent?.trim() || '';
      const statusStr = root.querySelector('.comic-info .detail-top .status')?.textContent?.trim() || 'Unknown';

      // Parse Chapters via API v2
      // Extract hash_id for API: Slug is usually "hash-title"
      const hashId = cleanId.split('-')[0];
      const chapters: any[] = [];
      
      if (hashId) {
          log(`Fetching chapters for hash_id: ${hashId}`);
          try {
             // https://comix.to/api/v2/manga/kl6nv/chapters
             const apiRes = await fetch(`${this.baseUrl}/api/v2/manga/${hashId}/chapters`, {
                 headers: this.headers
             });
             const json = await apiRes.json();
             if (json && json.result && json.result.items) {
                 // items: [{ chapter_id: 8170995, number: 51, ... }]
                 json.result.items.forEach((item: any) => {
                     // Url format: {chapter_id}-chapter-{number}
                     const chapId = `${item.chapter_id}-chapter-${item.number}`;
                     // We MUST encode mangaId in ID to allow retrieval
                     const compositeId = `${cleanId}:::${chapId}`;
                     
                     chapters.push({
                         id: compositeId,
                         title: item.name || `Chapter ${item.number}`,
                         number: item.number,
                         date: new Date(item.created_at * 1000), 
                         url: `/title/${cleanId}/${chapId}`
                     });
                 });
             } else {
                 log('No chapters found in API response');
             }
          } catch (e) {
              logError('Failed to fetch chapter API', e);
          }
      }

      return {
        id: cleanId,
        title,
        url,
        description: desc,
        cover,
        authors: [author, artist].filter(Boolean),
        status: statusStr.toLowerCase().includes('releasing') ? 'Ongoing' : 'Completed',
        chapters: chapters.sort((a, b) => b.number - a.number),
        isNsfw: false
      } as MangaDetails;
    } catch (e) {
      logError('Failed to fetch details', e);
      throw e;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    try {
        let mangaId = '';
        let chapterId = '';

        if (chapterIdOrUrl.includes(':::')) {
            const parts = chapterIdOrUrl.split(':::');
            mangaId = parts[0];
            chapterId = parts[1];
        } else {
            // Fallback or if passed URL
            // If it's a URL like /title/slug/chap-id
             if (chapterIdOrUrl.includes('/title/')) {
                 const part = chapterIdOrUrl.split('/title/')[1];
                 const slashIdx = part.indexOf('/');
                 if (slashIdx !== -1) {
                     mangaId = part.substring(0, slashIdx);
                     chapterId = part.substring(slashIdx + 1);
                 }
             } else {
                 logError(`Invalid chapter ID format: ${chapterIdOrUrl}`);
                 return [];
             }
        }
        
        const url = `${this.baseUrl}/title/${mangaId}/${chapterId}`;
        log(`Fetching chapter pages from ${url}`);
        
        const response = await fetch(url, { headers: this.headers });
        const html = await response.text();
        
        // Scrape for image URLs (simple regex for webp/jpg/png)
        const matches = html.matchAll(/https:\/\/[^"']+\.(webp|jpg|png)/g);
        const images: string[] = [];
        const seen = new Set();
        
        for (const match of matches) {
            const imgUrl = match[0];
            // Filter out assets
            if (imgUrl.includes('static.comix.to') && imgUrl.includes('@')) continue; 
            if (imgUrl.includes('logo') || imgUrl.includes('icon') || imgUrl.includes('favicon')) continue;
            
            if (!seen.has(imgUrl)) {
                images.push(imgUrl);
                seen.add(imgUrl);
            }
        }
        
        log(`Found ${images.length} images`);
        return images;
    } catch (e) {
        logError('Failed to fetch chapter pages', e);
        return [];
    }
  }
};
