import { logCapture } from '../../debugLog';
import {
  normalizeChapter,
  normalizeChapterList,
  normalizeManga,
  normalizeMangaList,
} from '../adapters';
import { FallbackManager } from '../fallback-manager';
import {
  type Chapter,
  type IMangaClient,
  type Manga,
  type MangaDetails,
  type SearchFilters,
  SOURCE_CONFIG,
  SOURCE_UI_CONFIG,
} from '../types';

const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

export class MangaDexClient implements IMangaClient {
  private static instance: MangaDexClient;
  private baseUrl: string;
  private userAgent: string;
  private requestQueue: Promise<any>[] = [];
  private maxConcurrent: number = 5;

  private constructor() {
    const config = SOURCE_CONFIG.mangadex;
    this.baseUrl = config.mirrors[0];
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  public static getInstance(): MangaDexClient {
    if (!MangaDexClient.instance) {
      MangaDexClient.instance = new MangaDexClient();
    }
    return MangaDexClient.instance;
  }

  private async fetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    log(`[MangaDex] Fetching: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `MangaDex API error: ${response.status} ${response.statusText}`,
      );
    }

    return response;
  }

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('mangadex');

    try {
      const url = new URL(`${this.baseUrl}manga`);
      url.searchParams.append('title', query);
      url.searchParams.append('limit', '20');
      url.searchParams.append('contentRating[]', 'safe');
      url.searchParams.append('contentRating[]', 'suggestive');
      url.searchParams.append('contentRating[]', 'erotica');
      url.searchParams.append('contentRating[]', 'pornographic');
      url.searchParams.append('translatedLanguage[]', 'en');
      url.searchParams.append('includes[]', 'cover_art');
      url.searchParams.append('includes[]', 'author');
      url.searchParams.append('includes[]', 'artist');
      url.searchParams.append('order[relevance]', 'desc');

      const response = await this.fetch(url.toString());
      const json = await response.json();

      if (json.result !== 'ok') {
        throw new Error('MangaDex search failed');
      }

      const results = json.data.map((item: any) => {
        const title =
          item.attributes.title.en ||
          Object.values(item.attributes.title)[0] ||
          'Unknown Title';

        const coverRel = item.relationships?.find(
          (r: any) => r.type === 'cover_art',
        );
        const coverFileName = coverRel?.attributes?.fileName;
        const coverUrl = coverFileName
          ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.256.jpg`
          : '';

        const authorRel = item.relationships?.find(
          (r: any) => r.type === 'author',
        );
        const artistRel = item.relationships?.find(
          (r: any) => r.type === 'artist',
        );
        const authors = [
          authorRel?.attributes?.name,
          artistRel?.attributes?.name,
        ].filter(Boolean);

        return normalizeManga(
          {
            id: item.id,
            title,
            url: `https://mangadex.org/title/${item.id}`,
            cover: coverUrl,
            description: item.attributes.description?.en || '',
            authors,
            genres:
              item.attributes.tags?.map((t: any) => t.attributes.name.en) || [],
            status: item.attributes.status || '',
            rating: item.attributes.contentRating || '',
          },
          'mangadex',
        );
      });

      fallbackManager.markRequestSuccess('mangadex');
      log(`[MangaDex] Search returned ${results.length} results`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('mangadex', e as Error);
      logError('[MangaDex] Search failed', e as Error);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<MangaDetails | null> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('mangadex');

    try {
      log(`[MangaDex] Fetching details for: ${id}`);

      const url = new URL(`${this.baseUrl}manga/${id}`);
      url.searchParams.append('includes[]', 'cover_art');
      url.searchParams.append('includes[]', 'author');
      url.searchParams.append('includes[]', 'artist');
      url.searchParams.append('includes[]', 'manga');

      const response = await this.fetch(url.toString());
      const json = await response.json();

      if (json.result !== 'ok' || !json.data) {
        throw new Error('MangaDex manga details not found');
      }

      const manga = json.data;
      const title =
        manga.attributes.title.en ||
        Object.values(manga.attributes.title)[0] ||
        'Unknown Title';

      const coverRel = manga.relationships?.find(
        (r: any) => r.type === 'cover_art',
      );
      const coverFileName = coverRel?.attributes?.fileName;
      const coverUrl = coverFileName
        ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.512.jpg`
        : '';

      const authorRel = manga.relationships?.find(
        (r: any) => r.type === 'author',
      );
      const artistRel = manga.relationships?.find(
        (r: any) => r.type === 'artist',
      );
      const authors = [
        authorRel?.attributes?.name,
        artistRel?.attributes?.name,
      ].filter(Boolean);

      // Fetch chapters
      const chaptersUrl = new URL(`${this.baseUrl}manga/${id}/feed`);
      chaptersUrl.searchParams.append('translatedLanguage[]', 'en');
      chaptersUrl.searchParams.append('limit', '500');
      chaptersUrl.searchParams.append('order[chapter]', 'desc');
      chaptersUrl.searchParams.append('includes[]', 'scanlation_group');
      chaptersUrl.searchParams.append('includes[]', 'user');

      const chaptersResponse = await this.fetch(chaptersUrl.toString());
      const chaptersJson = await chaptersResponse.json();

      const chapters = (chaptersJson.data || []).map((ch: any) => {
        const groupRel = ch.relationships?.find(
          (r: any) => r.type === 'scanlation_group',
        );
        const groupName = groupRel?.attributes?.name || 'Unknown Group';

        const chapterNum = ch.attributes.chapter;
        const volNum = ch.attributes.volume;

        return normalizeChapter(
          {
            id: ch.id,
            title: ch.attributes.title || `Chapter ${chapterNum}`,
            url: `https://mangadex.org/chapter/${ch.id}`,
            chapterNum,
            volNum,
            language: ch.attributes.translatedLanguage,
            group: groupName,
            uploadDate: ch.attributes.publishAt,
          },
          'mangadex',
        );
      });

      const mangaData = normalizeManga(
        {
          id: manga.id,
          title,
          url: `https://mangadex.org/title/${manga.id}`,
          cover: coverUrl,
          description: manga.attributes.description?.en || '',
          authors,
          genres:
            manga.attributes.tags?.map((t: any) => t.attributes.name.en) || [],
          status: manga.attributes.status || '',
          rating: manga.attributes.contentRating || '',
        },
        'mangadex',
      );

      const details: MangaDetails = {
        ...mangaData,
        chapters,
      };

      fallbackManager.markRequestSuccess('mangadex');
      return details;
    } catch (e) {
      fallbackManager.markRequestFailure('mangadex', e as Error);
      logError('[MangaDex] getMangaDetails failed', e as Error);
      return null;
    }
  }

  async getChapterImages(chapterId: string): Promise<string[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('mangadex');

    try {
      log(`[MangaDex] Fetching images for chapter: ${chapterId}`);

      const response = await this.fetch(`/at-home/server/${chapterId}`);
      const json = await response.json();

      if (json.result !== 'ok') {
        throw new Error('MangaDex chapter images not found');
      }

      const baseUrl = json.baseUrl;
      const hash = json.chapter.hash;
      const files = json.chapter.data;

      const imageUrls = files.map((file: any, index: number) => {
        return `${baseUrl}/data/${hash}/${file}`;
      });

      fallbackManager.markRequestSuccess('mangadex');
      log(`[MangaDex] Retrieved ${imageUrls.length} images for chapter`);
      return imageUrls;
    } catch (e) {
      fallbackManager.markRequestFailure('mangadex', e as Error);
      logError('[MangaDex] getChapterImages failed', e as Error);
      return [];
    }
  }

  async getLatestReleases(): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('mangadex');

    try {
      log('[MangaDex] Fetching latest releases');

      const url = new URL(`${this.baseUrl}manga`);
      url.searchParams.append('limit', '30');
      url.searchParams.append('contentRating[]', 'safe');
      url.searchParams.append('contentRating[]', 'suggestive');
      url.searchParams.append('contentRating[]', 'erotica');
      url.searchParams.append('contentRating[]', 'pornographic');
      url.searchParams.append('translatedLanguage[]', 'en');
      url.searchParams.append('includes[]', 'cover_art');
      url.searchParams.append('includes[]', 'latestUploadedChapter');
      url.searchParams.append('order[latestUploadedChapter]', 'desc');

      const response = await this.fetch(url.toString());
      const json = await response.json();

      if (json.result !== 'ok') {
        throw new Error('MangaDex latest releases failed');
      }

      const results = json.data.map((item: any) => {
        const title =
          item.attributes.title.en ||
          Object.values(item.attributes.title)[0] ||
          'Unknown Title';

        const coverRel = item.relationships?.find(
          (r: any) => r.type === 'cover_art',
        );
        const coverFileName = coverRel?.attributes?.fileName;
        const coverUrl = coverFileName
          ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.256.jpg`
          : '';

        const latestChapRel = item.relationships?.find(
          (r: any) => r.type === 'latest_uploaded_chapter',
        );
        const latestChapterId = latestChapRel?.id;

        return normalizeManga(
          {
            id: item.id,
            title,
            url: `https://mangadex.org/title/${item.id}`,
            cover: coverUrl,
            description: item.attributes.description?.en || '',
            genres:
              item.attributes.tags?.map((t: any) => t.attributes.name.en) || [],
            status: item.attributes.status || '',
            rating: item.attributes.contentRating || '',
            latestChapterId,
          },
          'mangadex',
        );
      });

      fallbackManager.markRequestSuccess('mangadex');
      log(`[MangaDex] Latest releases: ${results.length} items`);
      return results;
    } catch (e) {
      fallbackManager.markRequestFailure('mangadex', e as Error);
      logError('[MangaDex] getLatestReleases failed', e as Error);
      return [];
    }
  }

  getSourceName(): string {
    return 'mangadex';
  }
}
