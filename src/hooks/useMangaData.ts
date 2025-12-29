import { useCallback, useState } from '@lynx-js/react';
import {
  BatotoService,
  type Manga,
  type MangaDetails,
  type SearchFilters,
} from '../services/batoto';

export function useMangaData() {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [popularMangas, setPopularMangas] = useState<Manga[]>([]);
  const [latestMangas, setLatestMangas] = useState<Manga[]>([]);
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [mangaDetails, setMangaDetails] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  const fetchHomeFeed = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      console.log('[useMangaData] fetchHomeFeed started');
      const feed = await BatotoService.getHomeFeed();
      setPopularMangas(feed.popular);
      setLatestMangas(feed.latest);
      if (feed.popular.length === 0 && feed.latest.length === 0) {
        setHomeError(
          'Connected but found no content. Batoto might be blocking the request.',
        );
      }
    } catch (e: unknown) {
      console.error('[useMangaData] fetchHomeFeed failed:', e);
      const message =
        e instanceof Error ? e.message : 'Failed to connect to Batoto.';
      setHomeError(message);
    } finally {
      setHomeLoading(false);
    }
  }, []);

  const loadBrowse = useCallback(async (filters?: SearchFilters) => {
    console.log(
      '[useMangaData] Loading browse with filters:',
      JSON.stringify(filters),
    );
    setLoading(true);
    try {
      const browseParams = {
        sort: filters?.sort || 'views_d030',
        genres: filters?.genres,
        status: filters?.status,
        word: (filters as any)?.word,
      };
      console.log(
        '[useMangaData] Browse params:',
        JSON.stringify(browseParams),
      );
      const results = await BatotoService.browse(browseParams);
      console.log(`[useMangaData] Browse loaded: ${results.length} items`);
      setMangas(results);
    } catch (error) {
      console.error('[useMangaData] Browse error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMangaDetails = useCallback(async (url: string) => {
    setLoading(true);
    setMangaDetails(null);
    const details = await BatotoService.getMangaDetails(url);
    setMangaDetails(details);
    setLoading(false);
  }, []);

  const selectManga = useCallback(
    async (manga: Manga) => {
      console.log(`[useMangaData] Selected manga: ${manga.title}`);
      setSelectedManga(manga);
      await fetchMangaDetails(manga.url);
    },
    [fetchMangaDetails],
  );

  return {
    mangas,
    setMangas,
    popularMangas,
    latestMangas,
    selectedManga,
    setSelectedManga,
    mangaDetails,
    setMangaDetails,
    loading,
    homeLoading,
    homeError,
    fetchHomeFeed,
    loadBrowse,
    fetchMangaDetails,
    selectManga,
  };
}
