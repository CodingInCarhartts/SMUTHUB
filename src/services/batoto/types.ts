export interface Manga {
  id: string;
  title: string;
  url: string;
  cover: string;
  genres?: string[];
  latestChapter?: string;
  description?: string;
  authors?: string[];
  status?: string;
  rating?: string;
  views?: string;
}

export interface Chapter {
  id: string;
  title: string;
  url: string;
  chapterNum?: string;
  volNum?: string;
  language?: string;
  group?: string;
  uploadDate?: string; // string for now, maybe Date later
}

// Support for detailed parsing return types
export interface MangaDetails extends Manga {
  chapters: Chapter[];
  relatedSeries?: Manga[];
}

export interface Page {
  url: string;
  index: number;
}

export interface SearchFilters {
  genres: string[];
  status: 'all' | 'ongoing' | 'completed' | 'hiatus';
  sort: 'views_d030' | 'views_d007' | 'update' | 'create';
  nsfw: boolean;
}

export const GENRE_API_MAPPING: Record<string, string> = {
  'Yaoi(BL)': 'yaoi',
  'Yuri(GL)': 'yuri',
  'Seinen(M)': 'seinen',
  'Bara(ML)': 'bara',
  'Shoujo(G)': 'shoujo',
  'Shounen(B)': 'shounen',
  'Josei(W)': 'josei',
  'Kodomo(Kid)': 'kodomo',
  'Shoujo ai': 'shoujo_ai',
  'Shounen ai': 'shounen_ai',
  'Netorare/NTR': 'netorare',
  'Cheating/Infidelity': 'cheating_infidelity',
  Netori: 'netori',
  'Slice of Life': 'slice_of_life',
  'SM/BDSM/SUB-DOM': 'sm_bdsm',
  '4-Koma': '4-koma',
  'Childhood Friends': 'childhood_friends',
  'College life': 'college_life',
  'Contest winning': 'contest_winning',
  Crossdressing: 'crossdressing',
  "Emperor's daughter": 'emperors_daughter',
  'Full Color': 'full_color',
  'Gender Bender': 'gender_bender',
  Genderswap: 'genderswap',
  'Magical Girls': 'magical_girls',
  'Martial Arts': 'martial_arts',
  'Monster Girls': 'monster_girls',
  'Office Workers': 'office_workers',
  'Post-Apocalyptic': 'post_apocalyptic',
  'Read Direction': 'read_direction',
  'Royal family': 'royal_family',
  'School Life': 'school_life',
  'Silver & Golden': 'silver_golden',
  'Super Power': 'super_power',
  Supernatural: 'supernatural',
  Survival: 'survival',
  'Time Travel': 'time_travel',
  'Tower Climbing': 'tower_climbing',
  'Traditional Games': 'traditional_games',
  Transmigration: 'transmigration',
  'Virtual Reality': 'virtual_reality',
  'Video Games': 'video_games',
};

export const mapGenreToApi = (genre: string): string => {
  return (
    GENRE_API_MAPPING[genre] ||
    genre
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  );
};
