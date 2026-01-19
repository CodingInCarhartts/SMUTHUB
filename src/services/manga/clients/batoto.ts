import { BATO_MIRRORS, MIRROR_TIMEOUT_MS, USER_AGENTS } from '../../../config';
import { BatotoService } from '../../batoto';
import { BatotoClient as OriginalBatotoClient } from '../../batoto/client';
import { logCapture } from '../../debugLog';
import { NetworkLogService } from '../../networkLog';
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

const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

export class BatotoClient implements IMangaClient {
  private static instance: BatotoClient;
  private originalClient: OriginalBatotoClient;

  private constructor() {
    this.originalClient = OriginalBatotoClient.getInstance();
  }

  public static getInstance(): BatotoClient {
    if (!BatotoClient.instance) {
      BatotoClient.instance = new BatotoClient();
    }
    return BatotoClient.instance;
  }

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log(`[BatotoAdapter] Search called with query: "${query}"`);

      const results = await BatotoService.search(query, {
        genres: filters?.genres || [],
        status: filters?.status || 'all',
        sort: (filters?.sort || 'views_d030') as
          | 'views_d030'
          | 'views_d007'
          | 'update'
          | 'create',
        nsfw: filters?.nsfw || false,
      });

      const normalizedResults = results.map((item: any) => {
        return normalizeManga(
          {
            ...item,
            source: 'batoto',
          },
          'batoto',
        );
      });

      fallbackManager.markRequestSuccess('batoto');
      log(
        `[BatotoAdapter] Search returned ${normalizedResults.length} results`,
      );
      return normalizedResults;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] Search failed', e as Error);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<MangaDetails | null> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log(`[BatotoAdapter] Fetching details for: ${id}`);

      const details = await BatotoService.getMangaDetails(id);

      if (!details) {
        fallbackManager.markRequestFailure(
          'batoto',
          new Error('Manga not found'),
        );
        return null;
      }

      const normalizedDetails = normalizeManga(
        {
          id: details.id,
          title: details.title,
          url: details.url,
          cover: details.cover,
          description: details.description,
          authors: details.authors,
          genres: details.genres,
          status: details.status,
          rating: details.rating,
          views: details.views,
          source: 'batoto',
        },
        'batoto',
      );

      const chapters = details.chapters.map((ch: any) =>
        normalizeChapter(
          {
            ...ch,
            source: 'batoto',
          },
          'batoto',
        ),
      );

      const fullDetails: MangaDetails = {
        ...normalizedDetails,
        chapters,
        latestChapter: details.latestChapter,
        latestChapterUrl: details.latestChapterUrl,
        latestChapterId: details.latestChapterId,
      };

      fallbackManager.markRequestSuccess('batoto');
      return fullDetails;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] getMangaDetails failed', e as Error);
      return null;
    }
  }

  async getChapterImages(chapterId: string): Promise<string[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log(`[BatotoAdapter] Fetching images for chapter: ${chapterId}`);

      const images = await BatotoService.getChapterPanels(chapterId);

      fallbackManager.markRequestSuccess('batoto');
      log(`[BatotoAdapter] Retrieved ${images.length} images`);
      return images;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] getChapterImages failed', e as Error);
      return [];
    }
  }

  async getLatestReleases(): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log('[BatotoAdapter] Fetching latest releases');

      const results = await BatotoService.getLatestReleases();

      const normalizedResults = results.map((item: any) => {
        return normalizeManga(
          {
            ...item,
            source: 'batoto',
          },
          'batoto',
        );
      });

      fallbackManager.markRequestSuccess('batoto');
      log(`[BatotoAdapter] Latest releases: ${normalizedResults.length} items`);
      return normalizedResults;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] getLatestReleases failed', e as Error);
      return [];
    }
  }

  async browse(filters?: {
    page?: number;
    sort?: 'views_d030' | 'views_d007' | 'update' | 'create';
    genres?: string[];
    status?: 'all' | 'ongoing' | 'completed' | 'hiatus';
    word?: string;
  }): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log('[BatotoAdapter] Browse called');

      const results = await BatotoService.browse(filters);

      const normalizedResults = results.map((item: any) => {
        return normalizeManga(
          {
            ...item,
            source: 'batoto',
          },
          'batoto',
        );
      });

      fallbackManager.markRequestSuccess('batoto');
      log(`[BatotoAdapter] Browse returned ${normalizedResults.length} items`);
      return normalizedResults;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] Browse failed', e as Error);
      return [];
    }
  }

  async getBatchMangaInfo(ids: string[]): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.markRequestStart('batoto');

    try {
      log(`[BatotoAdapter] Batch fetching info for ${ids.length} mangas`);

      const results = await BatotoService.getBatchMangaInfo(ids);

      const normalizedResults = results.map((item: any) => {
        return normalizeManga(
          {
            ...item,
            source: 'batoto',
          },
          'batoto',
        );
      });

      fallbackManager.markRequestSuccess('batoto');
      return normalizedResults;
    } catch (e) {
      fallbackManager.markRequestFailure('batoto', e as Error);
      logError('[BatotoAdapter] getBatchMangaInfo failed', e as Error);
      return [];
    }
  }

  getSourceName(): string {
    return 'batoto';
  }
}
