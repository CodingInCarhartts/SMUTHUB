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
  sort: 'views' | 'rating' | 'new' | 'update';
  nsfw: boolean;
}
