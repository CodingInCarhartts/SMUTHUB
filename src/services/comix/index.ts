import { logCapture } from '../debugLog';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

const log = (msg: string) => logCapture('log', `[Comix] ${msg}`);
const logError = (msg: string, e?: any) =>
  logCapture('error', `[Comix] ${msg}`, e);

interface ComixApiManga {
  manga_id: number;
  hash_id: string;
  title: string;
  slug: string;
  poster: { medium: string; large: string };
  status: string;
  latest_chapter: number;
}

interface ComixApiResponse {
  status: number;
  result: {
    items: ComixApiManga[];
  };
}

function parseApiManga(item: ComixApiManga): Manga {
  return {
    id: item.slug,
    title: item.title,
    url: `https://comix.to/title/${item.slug}`,
    cover: item.poster?.medium || '',
    latestChapter: item.latest_chapter ? `Ch. ${item.latest_chapter}` : '',
    status: item.status === 'ongoing' ? 'Ongoing' : 'Completed',
    authors: [],
  };
}

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
      log('Fetching popular via API');
      const response = await fetch(
        `${this.baseUrl}/api/v2/manga?sort=views_total&limit=20`,
        {
          headers: this.headers,
        },
      );
      const json: ComixApiResponse = await response.json();

      if (json && json.result && json.result.items) {
        const items = json.result.items.map(parseApiManga);
        log(`Popular: found ${items.length} items`);
        return items;
      }
      log('No items in popular response');
      return [];
    } catch (e) {
      logError('Failed to fetch popular manga', e);
      return [];
    }
  },

  async getLatest(): Promise<Manga[]> {
    try {
      log('Fetching latest via API');
      const response = await fetch(
        `${this.baseUrl}/api/v2/manga?sort=latest&limit=20`,
        {
          headers: this.headers,
        },
      );
      const json: ComixApiResponse = await response.json();

      if (json && json.result && json.result.items) {
        const items = json.result.items.map(parseApiManga);
        log(`Latest: found ${items.length} items`);
        return items;
      }
      log('No items in latest response');
      return [];
    } catch (e) {
      logError('Failed to fetch latest manga', e);
      return [];
    }
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    const [popular, latest] = await Promise.all([
      this.getPopular!(),
      this.getLatest!(),
    ]);
    return { popular, latest };
  },

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    try {
      log(`Searching for: ${query}`);
      const url = `${this.baseUrl}/api/v2/manga?keyword=${encodeURIComponent(query)}&limit=20`;
      const response = await fetch(url, { headers: this.headers });
      const json: ComixApiResponse = await response.json();

      if (json && json.result && json.result.items) {
        const items = json.result.items.map(parseApiManga);
        log(`Search found ${items.length} items`);
        return items;
      }
      log('No items in search response');
      return [];
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(mangaId: string): Promise<MangaDetails> {
    try {
      log(`getMangaDetails called with: ${mangaId}`);

      // Handle full URLs like https://comix.to/title/kl6nv-the-dukes-wife-obsession
      let cleanId = mangaId;
      if (mangaId.includes('comix.to/title/')) {
        cleanId = mangaId.split('comix.to/title/')[1];
      } else if (mangaId.startsWith('title/')) {
        cleanId = mangaId.split('title/')[1];
      } else if (mangaId.startsWith('/title/')) {
        cleanId = mangaId.split('/title/')[1];
      }

      // Extract hash_id from slug (first part before first hyphen)
      const hashId = cleanId.split('-')[0];
      log(`Using hashId: ${hashId}, full slug: ${cleanId}`);

      // Fetch manga details from API
      const apiUrl = `${this.baseUrl}/api/v2/manga/${hashId}`;
      log(`Fetching details from API: ${apiUrl}`);

      const apiRes = await fetch(apiUrl, { headers: this.headers });
      const json = await apiRes.json();

      if (!json || !json.result) {
        throw new Error('Failed to fetch manga details');
      }

      const manga = json.result;

      // Fetch chapters from API
      const chaptersRes = await fetch(
        `${this.baseUrl}/api/v2/manga/${hashId}/chapters`,
        {
          headers: this.headers,
        },
      );
      const chaptersJson = await chaptersRes.json();

      const chapters: any[] = [];
      if (chaptersJson && chaptersJson.result && chaptersJson.result.items) {
        chaptersJson.result.items.forEach((item: any) => {
          const chapId = `${item.chapter_id}-chapter-${item.number}`;
          const compositeId = `${cleanId}:::${chapId}`;

          chapters.push({
            id: compositeId,
            title: item.name || `Chapter ${item.number}`,
            number: item.number,
            date: new Date(item.created_at * 1000),
            url: `/title/${cleanId}/${chapId}`,
          });
        });
      }

      return {
        id: manga.slug,
        title: manga.title,
        url: `${this.baseUrl}/title/${manga.slug}`,
        description: manga.synopsis || '',
        cover: manga.poster?.medium || '',
        authors: [],
        status: manga.status === 'releasing' ? 'Ongoing' : 'Completed',
        chapters: chapters.sort((a, b) => b.number - a.number),
        isNsfw: manga.is_nsfw || false,
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
        if (imgUrl.includes('static.comix.to') && imgUrl.includes('@'))
          continue;
        if (
          imgUrl.includes('logo') ||
          imgUrl.includes('icon') ||
          imgUrl.includes('favicon')
        )
          continue;

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
  },
};
