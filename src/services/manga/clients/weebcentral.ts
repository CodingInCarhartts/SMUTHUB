import { parse } from 'node-html-parser';
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

export class WeebCentralClient implements IMangaClient {
  private static instance: WeebCentralClient;
  private baseUrl: string;
  private userAgent: string;
  private apiEndpoint: string;

  private constructor() {
    const config = SOURCE_CONFIG.weebcentral;
    this.baseUrl = config.mirrors[0];
    this.apiEndpoint = config.endpoint;
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  public static getInstance(): WeebCentralClient {
    if (!WeebCentralClient.instance) {
      WeebCentralClient.instance = new WeebCentralClient();
    }
    return WeebCentralClient.instance;
  }

  private async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    log(`[WeebCentral] Fetching: ${fullUrl}`);

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
        throw new Error('WeebCentral rate limit exceeded');
      }
      if (response.status === 403 || response.status === 503) {
        throw new Error('WeebCentral: Access denied or Cloudflare challenge');
      }
      throw new Error(
        `WeebCentral API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('weebcentral');

    try {
      const url = new URL(`${this.baseUrl}/api/search`);
      url.searchParams.append('q', query);
      url.searchParams.append('limit', '20');

      const response = await this.fetch(url.toString());
      const json = await response.json();

      if (!json || !Array.isArray(json.results)) {
        throw new Error('WeebCentral search returned invalid data');
      }

      const results = json.results.map((item: any) => {
        return normalizeManga(
          {
            id: item.id || item.slug || '',
            title: item.title || item.name || 'Unknown Title',
            url: item.url || `${this.baseUrl}/manga/${item.slug}`,
            cover: item.cover || '',
            description: item.description || item.desc || '',
            authors: item.authors || [item.author].filter(Boolean),
            genres: item.genres || item.tags || [],
            status: item.status || '',
            rating: item.rating || '',
          },
          'weebcentral',
        );
      });

      fallbackManager.markRequestSuccess('weebcentral');
      log(`[WeebCentral] Search returned ${results.length} results`);
      return results;
    } catch (e) {
      logError('[WeebCentral] Search failed', e as Error);

      // Fallback to HTML scraping if API fails
      return this.scrapeSearch(query);
    }
  }

  private async scrapeSearch(query: string): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();

    try {
      log('[WeebCentral] Falling back to HTML scraping for search');

      const url = new URL(`${this.baseUrl}/search`);
      url.searchParams.append('q', query);

      const response = await this.fetch(url.toString());
      const html = await response.text();
      const doc = parse(html);

      const results: Manga[] = [];

      const mangaCards = doc.querySelectorAll(
        '.manga-card, .manga-item, .series-card',
      );

      for (const card of mangaCards) {
        const link = card.querySelector('a');
        const img = card.querySelector('img');
        const titleEl = card.querySelector('.title, .name, h3');

        if (link) {
          const href = link.getAttribute('href');
          const title =
            titleEl?.textContent?.trim() ||
            img?.getAttribute('alt') ||
            'Unknown Title';
          const cover =
            img?.getAttribute('src') || img?.getAttribute('data-src') || '';

          results.push(
            normalizeManga(
              {
                id: href?.split('/').pop() || '',
                title,
                url: href?.startsWith('http') ? href : `${this.baseUrl}${href}`,
                cover: cover?.startsWith('http')
                  ? cover
                  : `${this.baseUrl}${cover}`,
              },
              'weebcentral',
            ),
          );
        }
      }

      fallbackManager.markRequestSuccess('weebcentral');
      log(`[WeebCentral] Scraped ${results.length} results`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('weebcentral', e as Error);
      logError('[WeebCentral] Scraping failed', e as Error);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<MangaDetails | null> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('weebcentral');

    try {
      log(`[WeebCentral] Fetching details for: ${id}`);

      // Try API first
      const apiUrl = `${this.baseUrl}/api/manga/${id}`;
      const response = await this.fetch(apiUrl);

      // If API fails, try scraping
      if (!response.ok) {
        return this.scrapeMangaDetails(id);
      }

      const json = await response.json();
      const manga = json;

      const mangaData = normalizeManga(
        {
          id: manga.id || manga.slug || '',
          title: manga.title || manga.name || 'Unknown Title',
          url: manga.url || `${this.baseUrl}/manga/${manga.slug}`,
          cover: manga.cover || '',
          description: manga.description || manga.desc || '',
          authors: manga.authors || [manga.author].filter(Boolean),
          genres: manga.genres || manga.tags || [],
          status: manga.status || '',
          rating: manga.rating || '',
        },
        'weebcentral',
      );

      // Fetch chapters
      const chaptersUrl = `${this.baseUrl}/api/manga/${id}/chapters`;
      const chaptersResponse = await this.fetch(chaptersUrl);
      const chaptersJson = await chaptersResponse.json();

      const chapters = (chaptersJson.chapters || chaptersJson || []).map(
        (ch: any) => {
          return normalizeChapter(
            {
              id: ch.id || ch.chapterId || '',
              title: ch.title || ch.chapterTitle || `Chapter ${ch.chapter}`,
              url: ch.url || `${this.baseUrl}/chapter/${id}/${ch.chapter}`,
              chapterNum: ch.chapter,
              volNum: ch.volume,
              language: ch.lang || ch.language || 'en',
              group: ch.group || ch.scanlationGroup || 'Unknown Group',
              uploadDate: ch.date || ch.uploadedAt,
            },
            'weebcentral',
          );
        },
      );

      const details: MangaDetails = {
        ...mangaData,
        chapters,
      };

      fallbackManager.markRequestSuccess('weebcentral');
      return details;
    } catch (e) {
      fallbackManager.markRequestFailure('weebcentral', e as Error);
      logError('[WeebCentral] getMangaDetails failed', e as Error);
      return null;
    }
  }

  private async scrapeMangaDetails(id: string): Promise<MangaDetails | null> {
    const fallbackManager = FallbackManager.getInstance();

    try {
      log('[WeebCentral] Falling back to HTML scraping for details');

      const url = `${this.baseUrl}/manga/${id}`;
      const response = await this.fetch(url);
      const html = await response.text();
      const doc = parse(html);

      const titleEl = doc.querySelector('h1.title, h1.name, .manga-title');
      const coverEl = doc.querySelector('.cover img, .manga-cover img');
      const descEl = doc.querySelector('.description, .synopsis, .summary');
      const authorEl = doc.querySelector('.author, .author-name');
      const statusEl = doc.querySelector('.status, .publication-status');

      const title = titleEl?.textContent?.trim() || 'Unknown Title';
      const cover =
        coverEl?.getAttribute('src') || coverEl?.getAttribute('data-src') || '';
      const description = descEl?.textContent?.trim() || '';
      const author = authorEl?.textContent?.trim() || '';
      const status = statusEl?.textContent?.trim() || '';

      const mangaData = normalizeManga(
        {
          id,
          title,
          url: `${this.baseUrl}/manga/${id}`,
          cover: cover?.startsWith('http') ? cover : `${this.baseUrl}${cover}`,
          description,
          authors: [author].filter(Boolean),
          status,
        },
        'weebcentral',
      );

      // Scrape chapters
      const chapters: any[] = [];
      const chapterRows = doc.querySelectorAll(
        '.chapter-row, .chapter-item, tr.chapter-row',
      );

      for (const row of chapterRows) {
        const link = row.querySelector('a');
        const chapterNum = row
          .querySelector('.chapter-num, .chapter-number')
          ?.textContent?.trim();

        if (link) {
          const href = link.getAttribute('href');
          const chapterTitle =
            link.textContent?.trim() || `Chapter ${chapterNum}`;

          chapters.push(
            normalizeChapter(
              {
                id: href?.split('/').pop() || chapterNum || '',
                title: chapterTitle,
                url: href?.startsWith('http') ? href : `${this.baseUrl}${href}`,
                chapterNum,
                group: 'Unknown Group',
              },
              'weebcentral',
            ),
          );
        }
      }

      const details: MangaDetails = {
        ...mangaData,
        chapters: chapters.sort((a, b) => {
          const aNum = parseFloat(a.chapterNum || '0');
          const bNum = parseFloat(b.chapterNum || '0');
          return bNum - aNum;
        }),
      };

      fallbackManager.markRequestSuccess('weebcentral');
      return details;
    } catch (e) {
      fallbackManager.markRequestFailure('weebcentral', e as Error);
      logError('[WeebCentral] Scraping failed', e as Error);
      return null;
    }
  }

  async getChapterImages(chapterId: string): Promise<string[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('weebcentral');

    try {
      log(`[WeebCentral] Fetching images for chapter: ${chapterId}`);

      const url = `${this.baseUrl}/api/chapter/${chapterId}`;
      const response = await this.fetch(url);
      const json = await response.json();

      if (!json || !json.pages) {
        throw new Error('WeebCentral chapter images not found');
      }

      const images = json.pages || [];
      const imageUrls = images
        .map((img: any) => {
          return img.url || img.image || img;
        })
        .filter(Boolean);

      fallbackManager.markRequestSuccess('weebcentral');
      log(`[WeebCentral] Retrieved ${imageUrls.length} images for chapter`);
      return imageUrls;
    } catch (e) {
      logError('[WeebCentral] getChapterImages failed', e as Error);

      // Fallback to HTML scraping
      return this.scrapeChapterImages(chapterId);
    }
  }

  private async scrapeChapterImages(chapterId: string): Promise<string[]> {
    const fallbackManager = FallbackManager.getInstance();

    try {
      log('[WeebCentral] Falling back to HTML scraping for chapter images');

      const url = `${this.baseUrl}/chapter/${chapterId}`;
      const response = await this.fetch(url);
      const html = await response.text();
      const doc = parse(html);

      const images: string[] = [];
      const imgElements = doc.querySelectorAll(
        '.page-image img, .chapter-image img, img.page-image',
      );

      for (const img of imgElements) {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src) {
          images.push(src.startsWith('http') ? src : `${this.baseUrl}${src}`);
        }
      }

      fallbackManager.markRequestSuccess('weebcentral');
      log(`[WeebCentral] Scraped ${images.length} images`);
      return images;
    } catch (e) {
      fallbackManager.markRequestFailure('weebcentral', e as Error);
      logError('[WeebCentral] Scraping failed', e as Error);
      return [];
    }
  }

  async getLatestReleases(): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('weebcentral');

    try {
      log('[WeebCentral] Fetching latest releases');

      const url = `${this.baseUrl}/api/latest`;
      const response = await this.fetch(url);
      const json = await response.json();

      if (!json || !Array.isArray(json)) {
        throw new Error('WeebCentral latest releases returned invalid data');
      }

      const results = json.map((item: any) => {
        return normalizeManga(
          {
            id: item.id || item.slug || '',
            title: item.title || item.name || 'Unknown Title',
            url: item.url || `${this.baseUrl}/manga/${item.slug}`,
            cover: item.cover || '',
            description: item.description || item.desc || '',
            authors: item.authors || [item.author].filter(Boolean),
            genres: item.genres || item.tags || [],
            status: item.status || '',
            rating: item.rating || '',
            latestChapter: item.latestChapter || item.lastChapter || '',
          },
          'weebcentral',
        );
      });

      fallbackManager.markRequestSuccess('weebcentral');
      log(`[WeebCentral] Latest releases: ${results.length} items`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('weebcentral', e as Error);
      logError('[WeebCentral] getLatestReleases failed', e as Error);
      return [];
    }
  }

  getSourceName(): string {
    return 'weebcentral';
  }
}
