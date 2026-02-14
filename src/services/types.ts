export interface Manga {
  id: string;
  title: string;
  url: string;
  cover: string;
  latestChapter?: string;
  latestChapterId?: string;
  latestChapterUrl?: string;
  status?: string;
  authors?: string[];
  genres?: string[];
  genreIds?: number[];
  rating?: string;
  description?: string;
  source: string;
}

export interface MangaDetails extends Manga {
  chapters: Chapter[];
  summary?: string;
  views?: number;
}

export interface Chapter {
  id: string;
  title: string;
  number: number;
  url: string;
  group?: string;
  uploadDate?: string;
  releasedAt?: string;
}

export interface SearchFilters {
  genres: string[];
  themes: string[];
  formats: string[];
  demographics: string[];
  types: string[];
  status: 'all' | 'ongoing' | 'completed' | 'cancelled' | 'hiatus';
  sort: 'relevance' | 'latest' | 'new' | 'az' | 'numc' | 'views_d030';
  nsfw: boolean;
  page?: number;
}

export interface MangaSource {
  name: string;
  id: string; // unique identifier e.g. 'batoto', 'mangago'
  baseUrl: string;
  isNsfwSource?: boolean;

  search(query: string, filters?: SearchFilters): Promise<Manga[]>;
  getMangaDetails(idOrUrl: string): Promise<MangaDetails | null>;
  getChapterPages(chapterIdOrUrl: string): Promise<string[]>;
  getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }>;
  getPopular?: () => Promise<Manga[]>;
  getLatest?: () => Promise<Manga[]>;
  headers?: Record<string, string>;
}

export const GENRE_API_MAPPING: Record<string, string> = {
  '4-Koma': '4-koma',
  Action: 'action',
  Adult: 'adult',
  Adventure: 'adventure',
  Artbook: 'artbook',
  'Award Winning': 'award-winning',
  Comedy: 'comedy',
  Cooking: 'cooking',
  Doujinshi: 'doujinshi',
  Drama: 'drama',
  Ecchi: 'ecchi',
  Fantasy: 'fantasy',
  'Gender Bender': 'gender-bender',
  Harem: 'harem',
  Historical: 'historical',
  Horror: 'horror',
  Isekai: 'isekai',
  Josei: 'josei',
  Loli: 'loli',
  Manhua: 'manhua',
  Manhwa: 'manhwa',
  'Martial Arts': 'martial-arts',
  Mecha: 'mecha',
  Medical: 'medical',
  Music: 'music',
  Mystery: 'mystery',
  'One Shot': 'one-shot',
  'Overpowered MC': 'overpowered-mc',
  Psychological: 'psychological',
  Reincarnation: 'reincarnation',
  Romance: 'romance',
  'School Life': 'school-life',
  'Sci-fi': 'sci-fi',
  Seinen: 'seinen',
  Shota: 'shota',
  Shoujo: 'shoujo',
  'Shoujo Ai': 'shoujo-ai',
  Shounen: 'shounen',
  'Shounen Ai': 'shounen-ai',
  'Slice of Life': 'slice-of-life',
  Sports: 'sports',
  'Super Power': 'super-power',
  Supernatural: 'supernatural',
  Survival: 'survival',
  'Time Travel': 'time-travel',
  Tragedy: 'tragedy',
  Webtoon: 'webtoon',
  Yaoi: 'yaoi',
  Yuri: 'yuri',
};
