import { logCapture } from '../debugLog';
import { BatotoClient } from './clients/batoto';
import { ComickClient } from './clients/comick';
import { MangaDexClient } from './clients/mangadex';
import { WeebCentralClient } from './clients/weebcentral';
import { FallbackManager } from './fallback-manager';
import {
  type IMangaClient,
  type Manga,
  type MangaDetails,
  type SearchFilters,
  SOURCE_CONFIG,
  SOURCE_UI_CONFIG,
} from './types';

const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

const clients: Record<string, IMangaClient> = {
  batoto: BatotoClient.getInstance(),
  mangadex: MangaDexClient.getInstance(),
  comick: ComickClient.getInstance(),
  weebcentral: WeebCentralClient.getInstance(),
};

export const MangaService = {
  async search(
    query: string,
    preferredSource?: string,
    filters?: SearchFilters,
  ): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();

    if (preferredSource && clients[preferredSource]) {
      log(`[MangaService] Searching on preferred source: ${preferredSource}`);
      const results = await clients[preferredSource].search(query, filters);
      return results;
    }

    const availableSources = fallbackManager.getAvailableSources();
    const allResults: Manga[] = [];

    for (const source of availableSources) {
      try {
        log(`[MangaService] Searching on: ${source}`);
        const results = await clients[source].search(query, filters);
        allResults.push(...results);
      } catch (e) {
        logError(`[MangaService] Search failed on ${source}`, e as Error);
      }
    }

    // Deduplicate results by title (case-insensitive)
    const seenTitles = new Set<string>();
    const deduplicatedResults: Manga[] = [];

    for (const manga of allResults) {
      const titleLower = manga.title.toLowerCase();
      if (!seenTitles.has(titleLower)) {
        seenTitles.add(titleLower);
        deduplicatedResults.push(manga);
      }
    }

    log(
      `[MangaService] Search returned ${deduplicatedResults.length} unique results from ${availableSources.length} sources`,
    );
    return deduplicatedResults;
  },

  async getMangaDetails(
    id: string,
    source: string,
  ): Promise<MangaDetails | null> {
    if (!clients[source]) {
      logError(`[MangaService] Unknown source: ${source}`);
      return null;
    }

    log(`[MangaService] Fetching details from ${source} for: ${id}`);
    const details = await clients[source].getMangaDetails(id);
    return details;
  },

  async getChapterImages(chapterId: string, source: string): Promise<string[]> {
    if (!clients[source]) {
      logError(`[MangaService] Unknown source: ${source}`);
      return [];
    }

    log(
      `[MangaService] Fetching images from ${source} for chapter: ${chapterId}`,
    );
    const images = await clients[source].getChapterImages(chapterId);
    return images;
  },

  async getLatestReleases(preferredSource?: string): Promise<Manga[]> {
    const fallbackManager = FallbackManager.getInstance();

    if (preferredSource && clients[preferredSource]) {
      log(`[MangaService] Fetching latest releases from: ${preferredSource}`);
      const results = await clients[preferredSource].getLatestReleases();
      return results;
    }

    const availableSources = fallbackManager.getAvailableSources();
    const allResults: Manga[] = [];

    for (const source of availableSources) {
      try {
        log(`[MangaService] Fetching latest from: ${source}`);
        const results = await clients[source].getLatestReleases();
        allResults.push(...results);
      } catch (e) {
        logError(
          `[MangaService] Latest releases failed on ${source}`,
          e as Error,
        );
      }
    }

    // Deduplicate and limit to 30 total
    const seenIds = new Set<string>();
    const deduplicatedResults: Manga[] = [];

    for (const manga of allResults) {
      const uniqueKey = `${manga.source}-${manga.id}`;
      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        deduplicatedResults.push(manga);
      }
    }

    log(
      `[MangaService] Latest releases: ${deduplicatedResults.length} items from ${availableSources.length} sources`,
    );
    return deduplicatedResults.slice(0, 30);
  },

  getActiveMirror(): string {
    const fallbackManager = FallbackManager.getInstance();
    const activeSource = fallbackManager.getActiveSource();
    const config = SOURCE_CONFIG[activeSource];
    return config?.displayName || activeSource;
  },

  getSourceDisplayName(source: string): string {
    return SOURCE_CONFIG[source]?.displayName || source;
  },

  getSourceConfig(source: string) {
    return SOURCE_CONFIG[source];
  },

  getSourceUIConfig(source: string) {
    return SOURCE_UI_CONFIG[source];
  },

  getAllSources(): string[] {
    return Object.keys(SOURCE_CONFIG);
  },

  setActiveSource(source: string): void {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.setActiveSource(source);
  },

  getSourceHealth() {
    const fallbackManager = FallbackManager.getInstance();
    return fallbackManager.getAllSourceHealth();
  },

  resetSource(source: string): void {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.resetSource(source);
  },

  resetAllSources(): void {
    const fallbackManager = FallbackManager.getInstance();
    fallbackManager.resetAllSources();
  },

  getStatus() {
    const fallbackManager = FallbackManager.getInstance();
    return fallbackManager.getStatus();
  },
};

export type {
  Chapter,
  FallbackStatus,
  Manga,
  MangaDetails,
  SearchFilters,
  SourceHealth,
} from './types';
