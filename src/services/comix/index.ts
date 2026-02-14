import { logCapture } from '../debugLog';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';
import {
  COMIX_DEMOGRAPHICS,
  COMIX_FORMATS,
  COMIX_GENRES,
  COMIX_THEMES,
} from './genres';

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
    id: item.hash_id, // Use hash_id as the primary ID for API calls
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

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    try {
      const trimmedQuery = query.trim();
      const hasQuery = trimmedQuery.length > 0;

      // Check if we have any filters to apply
      const hasFilters =
        filters &&
        (filters.genres?.length ||
          filters.status !== 'all' ||
          filters.sort !== 'latest');

      log(
        `Searching for: "${trimmedQuery}" with filters: ${hasFilters ? 'yes' : 'no'}`,
      );

      const params: string[] = [];

      // Add query if present
      if (hasQuery) {
        params.push(`keyword=${encodeURIComponent(trimmedQuery)}`);
      }

      // Add sort parameter
      // When searching with a query, always use relevance by default (like the website)
      // Only use the explicit sort filter when browsing (no query)
      let sortParam: string | undefined;
      if (hasQuery) {
        sortParam = 'order[relevance]=desc';
      } else if (filters?.sort && filters.sort !== 'relevance') {
        // Skip relevance sort when no query - it doesn't make sense without a search term
        const sortMap: Record<string, string> = {
          latest: 'order[updated_at]=desc',
          new: 'order[created_at]=desc',
          az: 'order[title]=asc',
          numc: 'order[total_chapters]=desc',
          views_d030: 'order[views_30d]=desc',
        };
        sortParam = sortMap[filters.sort];
      }

      if (sortParam) {
        params.push(sortParam);
      } else {
        // Default sort for browsing
        params.push('order[updated_at]=desc');
      }

      // Add status filter
      if (filters?.status && filters.status !== 'all') {
        const statusMap: Record<string, string> = {
          ongoing: 'status=releasing',
          completed: 'status=finished',
          hiatus: 'status=hiatus',
          cancelled: 'status=cancelled',
        };
        if (statusMap[filters.status]) {
          params.push(statusMap[filters.status]);
        }
      }

      // Add types filter
      if (filters?.types && filters.types.length > 0) {
        filters.types.forEach((type) => {
          params.push(`types[]=${type}`);
        });
      }

      // Add genre filters (using IDs)
      if (filters?.genres && filters.genres.length > 0) {
        filters.genres.forEach((genre) => {
          const genreId = COMIX_GENRES[genre];
          if (genreId) {
            params.push(`genres[]=${genreId}`);
          }
        });
      }

      // Add theme filters (using IDs)
      if (filters?.themes && filters.themes.length > 0) {
        filters.themes.forEach((theme) => {
          const themeId = COMIX_THEMES[theme];
          if (themeId) {
            params.push(`themes[]=${themeId}`);
          }
        });
      }

      // Add format filters (using IDs)
      if (filters?.formats && filters.formats.length > 0) {
        filters.formats.forEach((format) => {
          const formatId = COMIX_FORMATS[format];
          if (formatId) {
            params.push(`formats[]=${formatId}`);
          }
        });
      }

      // Add demographic filters (using IDs)
      if (filters?.demographics && filters.demographics.length > 0) {
        filters.demographics.forEach((demographic) => {
          const demographicId = COMIX_DEMOGRAPHICS[demographic];
          if (demographicId) {
            params.push(`demographics[]=${demographicId}`);
          }
        });
      }

      // Limit results
      params.push('limit=20');

      const queryString = params.join('&');
      const url = `${this.baseUrl}/api/v2/manga?${queryString}`;

      log(`[Search] URL: ${url}`);

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
    log(`[Comix] START mangaId:${mangaId}`);
    try {
      log(`[Comix] getMangaDetails called with: ${mangaId}`);

      // mangaId is now the hash_id directly (e.g., "pgx4", "kl6nv")
      // Handle legacy URLs just in case
      let hashId = mangaId;
      if (mangaId.includes('comix.to/title/')) {
        hashId = mangaId.split('comix.to/title/')[1].split('-')[0];
      } else if (mangaId.startsWith('title/')) {
        hashId = mangaId.split('title/')[1].split('-')[0];
      } else if (mangaId.startsWith('/title/')) {
        hashId = mangaId.split('/title/')[1].split('-')[0];
      } else if (mangaId.includes('-')) {
        // Legacy: might be slug like "kl6nv-the-dukes-wife" - extract first part
        hashId = mangaId.split('-')[0];
      }

      log(`[Comix] Using hashId: ${hashId}`);

      const apiUrl = `${this.baseUrl}/api/v2/manga/${hashId}`;
      log(`[Comix] FETCH_URL:${apiUrl}`);
      log(`Fetching details from API: ${apiUrl}`);

      const apiRes = await fetch(apiUrl, {
        headers: this.headers,
      });
      log(`[Comix] RESPONSE_STATUS:${apiRes.status}`);

      const json = await apiRes.json();
      log(`API response status: ${json.status}`);

      if (!json || !json.result) {
        throw new Error(`API error: ${json?.message || 'Unknown error'}`);
      }

      const manga = json.result;
      log(`[Comix] MANGA_TITLE:${manga.title}`);

      // Fetch chapters from API with pagination
      log('[Comix] FETCHING_CHAPTERS');
      const allChapters: any[] = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const chaptersRes = await fetch(
          `${this.baseUrl}/api/v2/manga/${hashId}/chapters?page=${currentPage}`,
          {
            headers: this.headers,
          },
        );
        const chaptersJson = await chaptersRes.json();

        if (chaptersJson && chaptersJson.result && chaptersJson.result.items) {
          chaptersJson.result.items.forEach((item: any) => {
            const chapId = `${item.chapter_id}-chapter-${item.number}`;
            const compositeId = `${hashId}:::${chapId}`;

            allChapters.push({
              id: compositeId,
              title: item.name || `Chapter ${item.number}`,
              number: item.number,
              date: new Date(item.created_at * 1000),
              url: `/title/${manga.slug}/${chapId}`,
            });
          });

          // Get pagination info
          if (chaptersJson.result.pagination) {
            lastPage = chaptersJson.result.pagination.last_page || 1;
          }
        }

        log(
          `[Comix] CHAPTERS_PAGE_${currentPage}:${allChapters.length} items (lastPage: ${lastPage})`,
        );
        currentPage++;
      } while (currentPage <= lastPage);

      log(`[Comix] TOTAL_CHAPTERS_FETCHED:${allChapters.length}`);

      return {
        id: manga.slug,
        title: manga.title,
        url: `${this.baseUrl}/title/${manga.slug}`,
        description: manga.synopsis || '',
        cover: manga.poster?.medium || '',
        authors: [],
        status: manga.status === 'releasing' ? 'Ongoing' : 'Completed',
        chapters: allChapters.sort((a, b) => b.number - a.number),
        isNsfw: manga.is_nsfw || false,
      } as MangaDetails;
    } catch (e) {
      logError('Failed to fetch details', e);
      throw e;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    try {
      let chapterId = '';

      // Format: "hash_id:::chapter_id-chapter-number"
      if (chapterIdOrUrl.includes(':::')) {
        const parts = chapterIdOrUrl.split(':::');
        const chapPart = parts[1]; // e.g., "6740075-chapter-1"
        chapterId = chapPart.split('-')[0]; // Extract "6740075"
      } else if (chapterIdOrUrl.includes('/')) {
        // URL format like /title/slug/chapter_id-chapter-number
        const parts = chapterIdOrUrl.split('/');
        const lastPart = parts[parts.length - 1];
        chapterId = lastPart.split('-')[0];
      } else {
        // Direct chapter ID
        chapterId = chapterIdOrUrl.split('-')[0];
      }

      if (!chapterId || isNaN(parseInt(chapterId))) {
        logError(`Invalid chapter ID: ${chapterIdOrUrl}`);
        return [];
      }

      const apiUrl = `${this.baseUrl}/api/v2/chapters/${chapterId}`;
      log(`Fetching chapter pages from API: ${apiUrl}`);

      const response = await fetch(apiUrl, { headers: this.headers });
      const json = await response.json();

      if (!json || !json.result || !json.result.images) {
        logError('Invalid API response for chapter pages');
        return [];
      }

      const images = json.result.images.map((img: any) => img.url);
      log(`Found ${images.length} images for chapter ${chapterId}`);
      return images;
    } catch (e) {
      logError('Failed to fetch chapter pages', e);
      return [];
    }
  },
};
