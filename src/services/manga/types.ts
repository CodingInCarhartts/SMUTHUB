export interface IMangaClient {
  search(query: string, filters?: SearchFilters): Promise<Manga[]>;
  getMangaDetails(id: string): Promise<MangaDetails | null>;
  getChapterImages(chapterId: string): Promise<string[]>;
  getLatestReleases(): Promise<Manga[]>;
  getSourceName(): string;
}

export interface ISourceConfig {
  name: string;
  priority: number;
  enabled: boolean;
  mirrors: string[];
  apiType: 'graphql' | 'rest' | 'hybrid';
  endpoint: string;
  timeout: number;
  displayName: string;
}

export const SOURCE_CONFIG: Record<string, ISourceConfig> = {
  batoto: {
    name: 'batoto',
    priority: 1,
    enabled: true,
    mirrors: [],
    apiType: 'graphql',
    endpoint: '/ap2/',
    timeout: 5000,
    displayName: 'Bato',
  },
  mangadex: {
    name: 'mangadex',
    priority: 2,
    enabled: true,
    mirrors: ['https://api.mangadex.org'],
    apiType: 'rest',
    endpoint: '/',
    timeout: 7000,
    displayName: 'MangaDex',
  },
  comick: {
    name: 'comick',
    priority: 3,
    enabled: true,
    mirrors: ['https://api.comick.ink', 'https://api.comick.top'],
    apiType: 'graphql',
    endpoint: '/',
    timeout: 6000,
    displayName: 'Comick',
  },
  weebcentral: {
    name: 'weebcentral',
    priority: 4,
    enabled: true,
    mirrors: ['https://weebcentral.com'],
    apiType: 'hybrid',
    endpoint: '/api/',
    timeout: 8000,
    displayName: 'WeebCentral',
  },
};

export const SOURCE_UI_CONFIG: Record<string, { color: string; icon: string }> =
  {
    batoto: { color: '#3B82F6', icon: '📖' },
    mangadex: { color: '#10B981', icon: '📚' },
    comick: { color: '#F59E0B', icon: '🎭' },
    weebcentral: { color: '#8B5CF6', icon: '🌐' },
  };

export interface SearchFilters {
  genres?: string[];
  status?: 'all' | 'ongoing' | 'completed' | 'hiatus';
  sort?: string;
  word?: string;
  nsfw?: boolean;
}

export interface Manga {
  id: string;
  title: string;
  url: string;
  cover: string;
  genres?: string[];
  latestChapter?: string;
  latestChapterUrl?: string;
  latestChapterId?: string;
  description?: string;
  authors?: string[];
  status?: string;
  rating?: string;
  views?: string;
  source: string;
}

export interface Chapter {
  id: string;
  title: string;
  url: string;
  chapterNum?: string;
  volNum?: string;
  language?: string;
  group?: string;
  uploadDate?: string;
  source?: string;
}

export interface MangaDetails extends Manga {
  chapters: Chapter[];
  relatedSeries?: Manga[];
}

export interface SourceHealth {
  source: string;
  healthy: boolean;
  successRate: number;
  lastSuccessTime?: Date;
  errorCount: number;
  requestCount: number;
}

export interface FallbackStatus {
  activeSource: string;
  availableSources: string[];
  sourceHealth: Record<string, SourceHealth>;
}
