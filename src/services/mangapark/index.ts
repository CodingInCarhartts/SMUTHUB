import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';
import { logCapture } from '../debugLog';

// Helper for debug logging
const log = (msg: string) => logCapture('log', `[Mangapark] ${msg}`);
const logError = (msg: string, e?: any) => {
    const errStr = e ? (e.message || String(e)) : 'Unknown Error';
    logCapture('error', `[Mangapark] ${msg}: ${errStr}`);
};

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://mangakatana.com',
};

const BASE_URL = 'https://mangakatana.com';

// SAFE FETCH PROBE
async function fetchProbe(url: string): Promise<void> {
  try {
    log(`[Probe] -> ${url}`);
    const response = await fetch(url, { headers: HEADERS });
    const text = await response.text();
    log(`[Probe] <- ${response.status} (Length: ${text.length})`);
  } catch (e: any) {
    const msg = e.message || String(e);
    logError(`[Probe] Failed: ${url}`, msg);
    // We do NOT throw here for the probe, we just log it.
  }
}

export const MangaparkService: MangaSource = {
  id: 'mangapark',
  name: 'MangaPark (PROBE)',
  baseUrl: 'https://mangakatana.com',
  isNsfwSource: false,
  headers: {},

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    // PROBE: Run the fetch, but ignore result
    const url = `${this.baseUrl}/?search=${encodeURIComponent(query)}`;
    await fetchProbe(url);

    return [
        {
            id: 'stub:1',
            title: `Result for ${query}`,
            url: '/stub/1',
            cover: 'https://via.placeholder.com/150',
            source: 'mangapark'
        }
    ];
  },

  async getMangaDetails(idOrUrl: string): Promise<MangaDetails | null> {
    // PROBE
    let url = idOrUrl;
    if (!idOrUrl.startsWith('http')) {
        url = `${this.baseUrl}/manga/${idOrUrl.replace('mangapark:', '')}`;
    }
    await fetchProbe(url);

    return {
        id: idOrUrl,
        title: 'Stubbed Manga Details',
        url: idOrUrl,
        cover: 'https://via.placeholder.com/300',
        description: 'This is a safe mode stub to prove the UI works.',
        chapters: [
            { id: 'ch:1', title: 'Chapter 1', url: 'stb:1', source: 'mangapark', uploadDate: 'Now' },
            { id: 'ch:2', title: 'Chapter 2', url: 'stb:2', source: 'mangapark', uploadDate: 'Yesterday' }
        ],
        source: 'mangapark',
        authors: ['Debug Author'],
        genres: ['Safety', 'Testing']
    };
  },

  async getChapterPages(chapterIdOrUrl: string): Promise<string[]> {
    // PROBE
    let url = chapterIdOrUrl;
    if (!url.startsWith('http')) {
        url = `${this.baseUrl}${chapterIdOrUrl}`;
    }
    await fetchProbe(url);

    return [
        'https://via.placeholder.com/400x600.png?text=Page1',
        'https://via.placeholder.com/400x600.png?text=Page2'
    ];
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    // PROBE
    await fetchProbe(BASE_URL);

    return { 
        popular: [
            { id: 'pop:1', title: 'Popular Stub 1', url: '/p/1', cover: '', source: 'mangapark' },
            { id: 'pop:2', title: 'Popular Stub 2', url: '/p/2', cover: '', source: 'mangapark' }
        ], 
        latest: [
            { id: 'lat:1', title: 'Latest Stub 1', url: '/l/1', cover: '', source: 'mangapark' },
            { id: 'lat:2', title: 'Latest Stub 2', url: '/l/2', cover: '', source: 'mangapark' }
        ] 
    };
  },

  async getPopular(): Promise<Manga[]> { return []; },
  async getLatest(): Promise<Manga[]> { return []; },
};
