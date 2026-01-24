import { logCapture } from '../debugLog';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';
import { mapGenreToApi } from '../types';

// Helper for debug logging
const log = (msg: string) => logCapture('log', `[Mangapark] ${msg}`);
const logError = (msg: string, e?: any) => {
  const errStr = e ? e.message || String(e) : 'Unknown Error';
  logCapture('error', `[Mangapark] ${msg}: ${errStr}`);
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://mangakatana.com',
};

const BASE_URL = 'https://mangakatana.com';

const GENRE_ID_BY_SLUG: Record<string, number> = {
  '4-koma': 44,
  action: 14,
  adult: 18,
  adventure: 15,
  artbook: 46,
  'award-winning': 45,
  comedy: 2,
  cooking: 39,
  doujinshi: 25,
  drama: 3,
  ecchi: 23,
  erotica: 34,
  fantasy: 24,
  'gender-bender': 33,
  gore: 11,
  harem: 20,
  historical: 26,
  horror: 37,
  isekai: 49,
  josei: 4,
  loli: 42,
  manhua: 38,
  manhwa: 10,
  'martial-arts': 22,
  mecha: 28,
  medical: 41,
  music: 47,
  mystery: 5,
  'one-shot': 32,
  'overpowered-mc': 50,
  psychological: 6,
  reincarnation: 52,
  romance: 7,
  'school-life': 8,
  'sci-fi': 16,
  seinen: 19,
  'sexual-violence': 31,
  shota: 43,
  shoujo: 27,
  'shoujo-ai': 35,
  shounen: 17,
  'shounen-ai': 29,
  'slice-of-life': 9,
  sports: 12,
  'super-power': 48,
  supernatural: 21,
  survival: 51,
  'time-travel': 53,
  tragedy: 30,
  webtoon: 36,
  yaoi: 40,
  yuri: 13,
};

function fixUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  return url;
}

// SAFE FETCH
async function fetchSafe(
  url: string,
  options: RequestInit = {},
  timeout = 15000,
): Promise<string> {
  try {
    log(`[Fetch] -> ${url}`);

    const fetchPromise = fetch(url, options);

    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout ${timeout}ms`)), timeout);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const text = await response.text();
    log(`[Fetch] <- ${response.status} (Length: ${text.length})`);
    return text;
  } catch (e: any) {
    const msg = e.message || String(e);
    logError(`[Fetch] Failed: ${url}`, msg);
    throw new Error(msg);
  }
}

export const MangaparkService: MangaSource = {
  id: 'mangapark',
  name: 'MangaPark',
  baseUrl: BASE_URL,
  isNsfwSource: false,
  headers: HEADERS,

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    try {
      const trimmedQuery = query.trim();
      const hasQuery = trimmedQuery.length > 0;
      const hasGenres = Boolean(filters?.genres?.length);
      const basePath = hasQuery ? `${this.baseUrl}/` : `${this.baseUrl}/manga`;
      const params: string[] = [];

      if (hasQuery) {
        params.push(`s=${encodeURIComponent(trimmedQuery)}`);
      }

      if (!hasQuery && filters) {
        // Add Order (Default to 'latest' if not views_d030)
        const order = filters.sort === 'views_d030' ? '' : filters.sort;
        if (order) params.push(`order=${order}`);

        // Add Status
        if (filters.status && filters.status !== 'all') {
          const statusMap: Record<string, string> = {
            ongoing: '1',
            completed: '2',
            cancelled: '0',
          };
          const statusValue = statusMap[filters.status];
          if (statusValue) {
            params.push(`status=${statusValue}`);
          }
        }

        // Add Genres (Multi-param)
        if (filters.genres && filters.genres.length > 0) {
          filters.genres.forEach((g) => {
            const slug = mapGenreToApi(g);
            const genreId = slug ? GENRE_ID_BY_SLUG[slug] : undefined;
            if (genreId) params.push(`include_genre_chk=${genreId}`);
          });
        }
      }

      const queryString = params.length ? `?${params.join('&')}` : '';
      const url = `${basePath}${queryString}`;

      log(`[Search] Query: "${query}", URL: ${url}`);
      const html = await fetchSafe(url, { headers: HEADERS });

      const results: Manga[] = [];
      const blocks = html.split('<div class="item"');
      blocks.shift(); // discard header

      for (const block of blocks) {
        const genreDataMatch = block.match(/data-genre="([^"]*)"/);
        const genreIds = genreDataMatch
          ? genreDataMatch[1]
              .split(',')
              .map((id) => Number.parseInt(id.trim(), 10))
              .filter((id) => Number.isFinite(id))
          : undefined;
        const titleMatch = block.match(
          /<h3 class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
        );
        if (titleMatch) {
          const href = titleMatch[1];
          const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          const imgMatch = block.match(/<img[\s\S]*?src="([^"]+)"/);

          const genres: string[] = [];
          const genreMatches = block.matchAll(
            /<a href="[^"]+\/genre\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g,
          );
          for (const gm of genreMatches) {
            genres.push(gm[1].trim());
          }

          results.push({
            id: `mangapark:${href.split('/').pop()}`,
            title: title,
            url: href,
            cover: imgMatch ? fixUrl(imgMatch[1]) : '',
            genres,
            genreIds: genreIds && genreIds.length > 0 ? genreIds : undefined,
            source: 'mangapark',
          });
        }
      }

      let filteredResults = results;

      if (hasGenres && filters?.genres?.length) {
        const requiredGenreIds = filters.genres
          .map((genre) => GENRE_ID_BY_SLUG[mapGenreToApi(genre)])
          .filter((id): id is number => Number.isFinite(id));

        if (requiredGenreIds.length > 0) {
          const beforeCount = filteredResults.length;
          filteredResults = filteredResults.filter((manga) => {
            if (!manga.genreIds || manga.genreIds.length === 0) {
              return true;
            }
            return requiredGenreIds.every((id) => manga.genreIds?.includes(id));
          });
          log(
            `[Search] Client filter: ${beforeCount} -> ${filteredResults.length} (${requiredGenreIds.join(', ')})`,
          );
        }
      }

      return filteredResults;
    } catch (e) {
      logError('Search failed', e);
      return [];
    }
  },

  async getMangaDetails(idOrUrl: string): Promise<MangaDetails | null> {
    try {
      let url = idOrUrl;
      if (!idOrUrl.startsWith('http')) {
        url = `${this.baseUrl}/manga/${idOrUrl.replace('mangapark:', '')}`;
      }

      const html = await fetchSafe(url, { headers: HEADERS });

      const titleMatch = html.match(/<h1 class="heading">([^<]+)<\/h1>/);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

      const coverMatch = html.match(
        /<div class="cover">[^<]*<img[^>]+src="([^"]+)"/,
      );
      const cover = coverMatch ? fixUrl(coverMatch[1]) : '';

      const descMatch = html.match(/<div class="summary">([\s\S]*?)<\/div>/);
      const descRaw = descMatch ? descMatch[1] : '';
      const description = descRaw.replace(/<[^>]+>/g, '').trim();

      const statusMatch = html.match(
        /<div class="status [^"]+">([^<]+)<\/div>/,
      );
      const status = statusMatch ? statusMatch[1].trim() : '';

      const authors: string[] = [];
      const authorBlockMatch = html.match(
        /<div class="authors">([\s\S]*?)<\/div>/,
      );
      if (authorBlockMatch) {
        const ams = authorBlockMatch[1].matchAll(/<a[^>]+>([^<]+)<\/a>/g);
        for (const am of ams) authors.push(am[1]);
      }

      const genres: string[] = [];
      const genreBlockMatch = html.match(
        /<div class="genres">([\s\S]*?)<\/div>/,
      );
      if (genreBlockMatch) {
        const gms = genreBlockMatch[1].matchAll(/<a[^>]+>([^<]+)<\/a>/g);
        for (const gm of gms) genres.push(gm[1]);
      }

      const chapters: any[] = [];
      const tableMatch = html.match(
        /<div class="chapters">([\s\S]*?)<\/table>/,
      );
      if (tableMatch) {
        const tableContent = tableMatch[1];
        const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
        for (const rm of rowMatches) {
          const row = rm[1];
          const linkM = row.match(/<a href="([^"]+)">([^<]+)<\/a>/);
          if (linkM) {
            const chUrl = linkM[1];
            const chTitle = linkM[2];
            const timeM = row.match(/<div class="update_time">([^<]+)<\/div>/);
            chapters.push({
              id: chUrl,
              title: chTitle.trim(),
              url: chUrl,
              uploadDate: timeM ? timeM[1].trim() : '',
              source: 'mangapark',
            });
          }
        }
      }

      return {
        id: idOrUrl,
        title,
        url,
        cover,
        description,
        authors,
        genres,
        status,
        chapters,
        source: 'mangapark',
      };
    } catch (e) {
      logError('Details failed', e);
      return null;
    }
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    try {
      const html = await fetchSafe(chapterIdOrUrl, { headers: HEADERS });
      const scriptRegex = /var\s+[a-z0-9]+\s*=\s*\[(.*?)\];/gis;
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const arrayStr = match[1];
        const urls = arrayStr.match(/https?:\/\/[^'"]+/g);
        if (urls && urls.length > 5) {
          return [...new Set(urls)].map((u) => u.replace(/\\/g, ''));
        }
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
      if (!this.getPopular || !this.getLatest) {
        throw new Error('Scrapers not implemented');
      }
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
      log('getPopular: Start');
      const html = await fetchSafe(BASE_URL, { headers: HEADERS });

      const results: Manga[] = [];
      const hotSectionMatch = html.match(
        /<div id="hot_book">([\s\S]*?)(?:<div id="ugh"|<div id="book_list"|<!--)/,
      );
      const content = hotSectionMatch ? hotSectionMatch[1] : html;

      const blocks = content.split('<div class="item"');
      blocks.shift();

      for (const block of blocks) {
        const linkMatch = block.match(
          /<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/,
        );
        if (linkMatch) {
          const href = linkMatch[1];
          const title = linkMatch[2];
          const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
          results.push({
            id: `mangapark:${href.split('/').pop()}`,
            title: title.trim(),
            url: href,
            cover: imgMatch ? fixUrl(imgMatch[1]) : '',
            source: 'mangapark',
          });
        }
      }
      log(`[Popular] Found ${results.length} items`);
      return results.length > 0 ? results : this.search('');
    } catch (e) {
      logError('Popular failed', e);
      return [];
    }
  },

  async getLatest(): Promise<Manga[]> {
    try {
      log('getLatest: Start');
      const url = `${BASE_URL}/latest`;
      const html = await fetchSafe(url, { headers: HEADERS });

      const results: Manga[] = [];
      const blocks = html.split('<div class="item"');
      blocks.shift();

      for (const block of blocks) {
        // Robust match for Title and Href
        const titleMatch = block.match(
          /<h3 class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
        );
        if (titleMatch) {
          const href = titleMatch[1];
          const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          const imgMatch = block.match(/<img[\s\S]*?src="([^"]+)"/);

          const genres: string[] = [];
          // Match all genre links: /genre/name
          const genreMatches = block.matchAll(
            /<a href="[^"]+\/genre\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g,
          );
          for (const gm of genreMatches) {
            genres.push(gm[1].trim());
          }

          results.push({
            id: `mangapark:${href.split('/').pop()}`,
            title: title,
            url: href,
            cover: imgMatch ? fixUrl(imgMatch[1]) : '',
            genres,
            source: 'mangapark',
          });
        }
      }
      log(`[Latest] Found ${results.length} items`);
      return results;
    } catch (e) {
      logError('Latest failed', e);
      return [];
    }
  },
};
