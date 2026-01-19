import { BatotoService } from './batoto';
import { MangagoService } from './mangago';
import { MangaparkService } from './mangapark';
import {
  type Manga,
  MangaDetails,
  type MangaSource,
  type SearchFilters,
} from './types';

class SourceManager {
  private sources: Map<string, MangaSource> = new Map();
  private defaultSource: string = 'batoto';

  constructor() {
    // We will register sources here
    this.registerSource(BatotoService);
    this.registerSource(MangagoService);
    this.registerSource(MangaparkService);
  }

  registerSource(source: MangaSource) {
    this.sources.set(source.id, source);
    console.log(`[SourceManager] Registered source: ${source.id}`);
  }

  getAvailableSources(): MangaSource[] {
    return Array.from(this.sources.values());
  }

  getSource(id: string): MangaSource | undefined {
    return this.sources.get(id);
  }

  // Helper to determine source from ID or URL
  resolveSource(idOrUrl: string): MangaSource | undefined {
    if (idOrUrl.includes('batoto') || /^\d+$/.test(idOrUrl)) {
      return this.sources.get('batoto');
    }
    // Add logic for other sources as they are added
    // e.g. if (idOrUrl.startsWith('mangago:')) return this.sources.get('mangago');

    // Fallback based on known prefixes if we implement namespacing
    const prefix = idOrUrl.split(':')[0];
    if (this.sources.has(prefix)) {
      return this.sources.get(prefix);
    }

    return this.sources.get(this.defaultSource);
  }

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    // For now, search across all sources or just default?
    // Let's search default for now, or allow specifying source in filters
    // Ideally we aggregate, but pagination makes that hard.

    // Simple implementation: Search default source
    const source = this.sources.get(this.defaultSource);
    if (source) {
      return source.search(query, filters);
    }
    return [];
  }
}

export const sourceManager = new SourceManager();
