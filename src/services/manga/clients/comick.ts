import { logCapture } from '../../debugLog';
import {
  normalizeChapter,
  normalizeChapterList,
  normalizeManga,
  normalizeMangaList,
} from '../adapters';
import { FallbackManager } from '../fallback-manager';
import type {
  IMangaClient,
  Manga,
  MangaDetails,
  SearchFilters,
} from '../types';
import { SOURCE_CONFIG } from '../types';

const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

export class ComickClient implements IMangaClient {
  private static instance: ComickClient;
  private baseUrl: string;
  private userAgent: string;

  private constructor() {
    const config = SOURCE_CONFIG.comick;
    this.baseUrl = config.mirrors[0];
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  public static getInstance(): ComickClient {
    if (!ComickClient.instance) {
      ComickClient.instance = new ComickClient();
    }
    return ComickClient.instance;
  }

  private async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    log(`[Comick] Fetching: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Comick rate limit exceeded');
      }
      if (response.status === 403 || response.status === 503) {
        throw new Error('Comick: Cloudflare challenge detected');
      }
      throw new Error(
        `Comick API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('comick');

    try {
      const response = await this.fetch('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: query,
          limit: 20,
          page: 1,
          lang: 'en',
        }),
      });

      const json = await response.json();

      if (!json || !Array.isArray(json)) {
        throw new Error('Comick search returned invalid data');
      }

      const results = json.map((item: any) => {
        const coverKey =
          item.md_covers && item.md_covers[0] ? item.md_covers[0].b2key : '';

        return normalizeManga(
          {
            id: item.hid || item.id || '',
            title: item.title || 'Unknown Title',
            url: `${this.baseUrl}/comic/${item.hid}`,
            cover: coverKey ? `https://meo.comick.pictures/${coverKey}` : '',
            description: item.desc || item.md_titles?.[0] || '',
            authors: item.md_comics?.map((c: any) => c.title) || [],
            genres: item.md_comics?.[0]?.mu_comics?.[0]?.genres || [],
            status: item.status || '',
            rating: item.rating || '',
          },
          'comick',
        );
      });

      fallbackManager.markRequestSuccess('comick');
      log(`[Comick] Search returned ${results.length} results`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('comick', e as Error);
      logError('[Comick] Search failed', e as Error);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<MangaDetails | null> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('comick');

    try {
      log(`[Comick] Fetching details for: ${id}`);

      const response = await this.fetch(`/comic/${id}?lang=en`);

      const json = await response.json();

      if (!json || !json.comic) {
        throw new Error('Comick manga details not found');
      }

      const comic = json.comic;
      const coverKey =
        comic.md_covers && comic.md_covers[0] ? comic.md_covers[0].b2key : '';

      // Fetch chapters
      const chaptersResponse = await this.fetch(
        `/comic/${id}/chapter?page=1&limit=500&lang=en`,
      );

      const chaptersJson = await chaptersResponse.json();
      const chaptersData = chaptersJson?.chapters || [];

      const chapters = chaptersData.map((ch: any) => {
        return normalizeChapter(
          {
            id: ch.hid || ch.id || '',
            title: ch.title || ch.chap || `Chapter ${ch.chap}`,
            url: `${this.baseUrl}/chapter/${ch.hid}`,
            chapterNum: ch.chap,
            volNum: ch.vol,
            language: ch.lang || 'en',
            group: ch.group_name || ch.group || 'Unknown Group',
            uploadDate: ch.created_at,
          },
          'comick',
        );
      });

      const mangaData = normalizeManga(
        {
          id: comic.hid || comic.id || '',
          title: comic.title || 'Unknown Title',
          url: `${this.baseUrl}/comic/${comic.hid}`,
          cover: coverKey ? `https://meo.comick.pictures/${coverKey}` : '',
          description: comic.desc || '',
          authors: comic.md_comics?.map((c: any) => c.title) || [],
          genres: comic.md_comics?.[0]?.mu_comics?.[0]?.genres || [],
          status: comic.status || '',
          rating: comic.rating || '',
        },
        'comick',
      );

      const details: MangaDetails = {
        ...mangaData,
        chapters,
      };

      fallbackManager.markRequestSuccess('comick');
      return details;
    } catch (e) {
      fallbackManager.markRequestFailure('comick', e as Error);
      logError('[Comick] getMangaDetails failed', e as Error);
      return null;
    }
  }

  async getChapterImages(chapterId: string): Promise<string[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('comick');

    try {
      log(`[Comick] Fetching images for chapter: ${chapterId}`);

      const response = await this.fetch(`/chapter/${chapterId}`);
      const json = await response.json();

      if (!json || !json.chapter) {
        throw new Error('Comick chapter images not found');
      }

      const chapter = json.chapter;
      const images = chapter.md_images || [];

      const imageUrls = images
        .map((img: any) => {
          return img.b2key ? `https://meo.comick.pictures/${img.b2key}` : '';
        })
        .filter(Boolean);

      fallbackManager.markRequestSuccess('comick');
      log(`[Comick] Retrieved ${imageUrls.length} images for chapter`);
      return imageUrls;
    } catch (e) {
      fallbackManager.markRequestFailure('comick', e as Error);
      logError('[Comick] getChapterImages failed', e as Error);
      return [];
    }
  }

  async getLatestReleases(): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('comick');

    try {
      log('[Comick] Fetching latest releases');

      const response = await this.fetch('/updates?page=1&limit=30&lang=en');
      const json = await response.json();

      if (!json || !Array.isArray(json)) {
        throw new Error('Comick latest releases returned invalid data');
      }

      const seenManga = new Map<string, Manga>();

      json.forEach((item: any) => {
        const comic = item.comic;
        const hid = comic?.hid || comic?.id;

        if (hid && !seenManga.has(hid)) {
          const coverKey =
            comic.md_covers && comic.md_covers[0]
              ? comic.md_covers[0].b2key
              : '';

          seenManga.set(
            hid,
            normalizeManga(
              {
                id: hid,
                title: comic.title || 'Unknown Title',
                url: `${this.baseUrl}/comic/${hid}`,
                cover: coverKey
                  ? `https://meo.comick.pictures/${coverKey}`
                  : '',
                description: comic.desc || '',
                authors: comic.md_comics?.map((c: any) => c.title) || [],
                genres: comic.md_comics?.[0]?.mu_comics?.[0]?.genres || [],
                status: comic.status || '',
                rating: comic.rating || '',
              },
              'comick',
            ),
          );
        }
      });

      const results = Array.from(seenManga.values());
      fallbackManager.markRequestSuccess('comick');
      log(`[Comick] Latest releases: ${results.length} items`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('comick', e as Error);
      logError('[Comick] getLatestReleases failed', e as Error);
      return [];
    }
  }

  getSourceName(): string {
    return 'comick';
  }
}
