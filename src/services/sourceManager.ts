import { MangagoService } from './mangago';
import { MangaparkService } from './mangapark';
import type { Manga, MangaDetails, MangaSource, SearchFilters } from './types';

class SourceManager {
  private sources: Map<string, MangaSource> = new Map();
  private defaultSource: string = 'mangapark';

  constructor() {
    // console.log('[SourceManager] Initializing...');
    // We will register sources here
    // this.registerSource(MangagoService); // KEEP DISABLED
    this.registerSource(MangaparkService);
    // console.log(`[SourceManager] Registry size: ${this.sources.size}`);
    // console.log(`[SourceManager] Keys: ${Array.from(this.sources.keys()).join(', ')}`);
  }

  registerSource(source: MangaSource) {
    if (!source || !source.id) {
      console.error(
        '[SourceManager] Invalid source registration attempt',
        source,
      );
      return;
    }
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
    if (idOrUrl.startsWith('mangago:') || idOrUrl.includes('mangago.me')) {
      return this.sources.get('mangago');
    }

    if (
      idOrUrl.startsWith('mangapark:') ||
      idOrUrl.includes('mangapark.net') ||
      idOrUrl.includes('mangakatana.com')
    ) {
      return this.sources.get('mangapark');
    }

    // Fallback based on known prefixes if we implement namespacing
    const prefix = idOrUrl.split(':')[0];
    if (this.sources.has(prefix)) {
      return this.sources.get(prefix);
    }

    return this.sources.get(this.defaultSource);
  }

  async search(query: string, filters?: SearchFilters): Promise<Manga[]> {
    // Try default source first
    const source = this.sources.get(this.defaultSource);
    if (source) {
      try {
        const results = await source.search(query, filters);
        // We return the results even if empty, as long as the search succeeded
        return results;
      } catch (e) {
        console.error(
          `[SourceManager] Default source (${this.defaultSource}) failed:`,
          e,
        );
      }
    }

    // Fallback to other available sources
    console.log('[SourceManager] Attempting fallback sources...');
    for (const [id, src] of this.sources.entries()) {
      if (id === this.defaultSource) continue;
      try {
        const results = await src.search(query, filters);
        if (results.length > 0) {
          console.log(`[SourceManager] Success using fallback: ${id}`);
          return results;
        }
      } catch (e) {
        console.error(`[SourceManager] Fallback source (${id}) failed:`, e);
      }
    }

    return [];
  }
}

export const sourceManager = new SourceManager();
