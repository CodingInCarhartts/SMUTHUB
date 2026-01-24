import type { Manga, MangaDetails, MangaSource, SearchFilters } from '../types';

export const MangaparkService: MangaSource = {
  id: 'mangapark',
  name: 'MangaPark (STUB)',
  baseUrl: 'https://mangakatana.com',
  isNsfwSource: false,
  headers: {},

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
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
    return [
        'https://via.placeholder.com/400x600.png?text=Page1',
        'https://via.placeholder.com/400x600.png?text=Page2'
    ];
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
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
