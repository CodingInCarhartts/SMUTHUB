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

  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    try {
      const url = `${this.baseUrl}/?search=${encodeURIComponent(query)}`;
      const html = await fetchSafe(url, { headers: HEADERS });

      // Regex for search results (MangaKatana structure)
      // <div class="item"> ... <a href="...">Title</a> ... <img src="..."> ... </div>
      const itemRegex = /<div class="item">([\s\S]*?)<\/div>\s*<\/div>/g;
      const titleLinkRegex = /<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/;
      const imgRegex = /<img[^>]+src="([^"]+)"/;
      const genreRegex = /<a href="[^"]+\/genre\/[^"]+">([^<]+)<\/a>/g;

      const results: Manga[] = [];
      let match;
      
      while ((match = itemRegex.exec(html)) !== null) {
        const block = match[1];
        const titleMatch = block.match(titleLinkRegex);
        if (titleMatch) {
            const href = titleMatch[1];
            const title = titleMatch[2];
            const imgMatch = block.match(imgRegex);
            const cover = imgMatch ? fixUrl(imgMatch[1]) : '';
            
            const genres: string[] = [];
            let gMatch;
            while ((gMatch = genreRegex.exec(block)) !== null) {
                genres.push(gMatch[1]);
            }

            results.push({
                id: `mangapark:${href.split('/').pop()}`,
                title: title.trim(),
                url: href,
                cover,
                genres,
                source: 'mangapark'
            });
        }
      }
      
      return results;
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

      // Extract details via Regex
      const titleMatch = html.match(/<h1 class="heading">([^<]+)<\/h1>/);
      const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

      const coverMatch = html.match(/<div class="cover">[^<]*<img[^>]+src="([^"]+)"/);
      const cover = coverMatch ? fixUrl(coverMatch[1]) : '';

      const descMatch = html.match(/<div class="summary">([\s\S]*?)<\/div>/);
      const descRaw = descMatch ? descMatch[1] : '';
      // Simple strip tags for desc
      const description = descRaw.replace(/<[^>]+>/g, '').trim();

      const statusMatch = html.match(/<div class="status [^"]+">([^<]+)<\/div>/);
      const status = statusMatch ? statusMatch[1].trim() : '';

      // Authors
      const authors: string[] = [];
      const authorBlockMatch = html.match(/<div class="authors">([\s\S]*?)<\/div>/);
      if (authorBlockMatch) {
          const aRegex = /<a[^>]+>([^<]+)<\/a>/g;
          let am;
          while ((am = aRegex.exec(authorBlockMatch[1])) !== null) {
              authors.push(am[1]);
          }
      }

      // Genres
      const genres: string[] = [];
      const genreBlockMatch = html.match(/<div class="genres">([\s\S]*?)<\/div>/);
      if (genreBlockMatch) {
          const gRegex = /<a[^>]+>([^<]+)<\/a>/g;
          let gm;
          while ((gm = gRegex.exec(genreBlockMatch[1])) !== null) {
              genres.push(gm[1]);
          }
      }

      // Chapters - Table rows
      const chapters: any[] = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      const linkRegex = /<a href="([^"]+)">([^<]+)<\/a>/;
      const timeRegex = /<div class="update_time">([^<]+)<\/div>/;

      // Find the chapters table first to limit scope
      const tableMatch = html.match(/<div class="chapters">([\s\S]*?)<\/table>/);
      if (tableMatch) {
          const tableContent = tableMatch[1];
          let rowMatch;
          while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
              const row = rowMatch[1];
              const linkM = row.match(linkRegex);
              if (linkM) {
                  const chUrl = linkM[1];
                  const chTitle = linkM[2];
                  const timeM = row.match(timeRegex);
                  const time = timeM ? timeM[1] : '';

                  chapters.push({
                      id: chUrl,
                      title: chTitle.trim(),
                      url: chUrl,
                      uploadDate: time.trim(),
                      source: 'mangapark'
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

      // MangaKatana stores images in script variables
      // var ytach = ["url1", "url2"];
      const scriptRegex = /var\s+[a-z0-9]+\s*=\s*\[(.*?)\];/gis;
      
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        const arrayStr = match[1];
        // Extract all URLs
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
    return { popular: [], latest: [] };
  },

  async getPopular(): Promise<Manga[]> {
    try {
      log('getPopular: Start');
      const html = await fetchSafe(BASE_URL, { headers: HEADERS });
      
      const results: Manga[] = [];
      
      // Target #hot_book .item
      // <div class="item"> ... <div class="wrap_img"><a href="url"><img src="img"></a></div> ... <h3 class="title"><a href="url">Title</a></h3>
      // We can iterate over class="item" blocks inside the hot_book area?
      // Or just standard regex for item blocks if distinctive.
      
      // Let's refine the regex to be safer.
      const itemRegex = /<div class="item"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
      
      // Narrow to hot_book section to avoid latest mixup
      const hotSectionMatch = html.match(/<div id="hot_book">([\s\S]*?)<div id="ugh"/); 
      // id="ugh" might not exist, usually follows hot_book. 
      // Safe bet: The hot_book div usually ends before "Latest Updates".
      
      const contentToScan = hotSectionMatch ? hotSectionMatch[1] : html;

      let match;
      while ((match = itemRegex.exec(contentToScan)) !== null) {
          const block = match[1];
          const linkMatch = block.match(/<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/);
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
      if (results.length > 0) return results;

      return this.search('');
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
      const itemRegex = /<div class="item">([\s\S]*?)<\/div>\s*<\/div>/g;
      
      let match;
      while ((match = itemRegex.exec(html)) !== null) {
          const block = match[1];
          // Title
          const linkMatch = block.match(/<h3 class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/);
          if (linkMatch) {
              const href = linkMatch[1];
              const title = linkMatch[2];
              // Image
              const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
              // Genres
              const genres: string[] = [];
              const gRegex = /<a href="[^"]+\/genre\/[^"]+">([^<]+)<\/a>/g;
              let gm;
              while ((gm = gRegex.exec(block)) !== null) {
                  genres.push(gm[1]);
              }

              results.push({
                id: `mangapark:${href.split('/').pop()}`,
                title: title.trim(),
                url: href,
                cover: imgMatch ? fixUrl(imgMatch[1]) : '',
                genres,
                source: 'mangapark',
              });
          }
      }
      
      return results;
    } catch (e) {
      logError('Latest failed', e);
      return [];
    }
  },
};
