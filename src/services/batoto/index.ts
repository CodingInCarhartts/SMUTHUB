import { BatotoClient } from './client';
import type { Chapter, Manga, MangaDetails, SearchFilters } from './types';
import { GENRE_API_MAPPING, mapGenreToApi } from './types';

export * from './types';

export const BatotoService = {
  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
    const client = BatotoClient.getInstance();
    console.log(`[Service] search() called with query: "${query}"`);
    try {
      // Use get_comic_browse which supports word search + language filtering
      const gqlQuery = `
            query get_comic_browse($select: Comic_Browse_Select) {
              get_comic_browse(select: $select) {
                items {
                  id
                  data {
                    name
                    urlPath
                    urlCover600
                    authors
                    tranLang
                    chapterNode_up_to {
                      id
                      data {
                        dname
                        urlPath
                      }
                    }
                  }
                }
              }
            }
          `;

      const response = await client.fetch('/ap2/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: gqlQuery,
          variables: {
            select: {
              word: query,
              incTLangs: ['en'],
            },
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `[Service] GraphQL request failed with status ${response.status}: ${text.substring(0, 100)}...`,
        );
        return [];
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(
          `[Service] Expected JSON but got ${contentType}. Body start: ${text.substring(0, 100)}...`,
        );
        return [];
      }

      const json = await response.json();
      const items = json?.data?.get_comic_browse?.items || [];
      console.log(`[Service] GraphQL returned ${items.length} items`);

      const results = items.map((item: any) => {
        const data = item.data;
        const baseUrl = client.getBaseUrl();
        return {
          id: item.id || data.id || '',
          title: data.name || 'Unknown Title',
          url: data.urlPath.startsWith('http')
            ? data.urlPath
            : `${baseUrl}${data.urlPath}`,
          cover: data.urlCover600.startsWith('http')
            ? data.urlCover600
            : `${baseUrl}${data.urlCover600}`,
          author: data.authors?.[0] || '',
          latestChapter: data.chapterNode_up_to?.data?.dname || '',
          latestChapterUrl: data.chapterNode_up_to?.data?.urlPath?.startsWith('http')
            ? data.chapterNode_up_to.data.urlPath
            : data.chapterNode_up_to?.data?.urlPath ? `${baseUrl}${data.chapterNode_up_to.data.urlPath}` : undefined,
          latestChapterId: data.chapterNode_up_to?.id || undefined,
        };
      });

      return results;
    } catch (e) {
      console.error('[Service] Search failed', e);
      return [];
    }
  },

  async getMangaDetails(mangaPath: string): Promise<MangaDetails | null> {
    const client = BatotoClient.getInstance();
    try {
      const path = mangaPath.replace(/^https?:\/\/[^/]+/, '');
      const idMatch = path.match(/\/title\/(\d+)/);
      const id = idMatch ? idMatch[1] : '';

      if (!id) {
        console.warn(`[Service] Could not extract ID from path: ${path}`);
        return null;
      }

      console.log(`[Service] Fetching details for comic ID: ${id}`);

      // Fetch comic info and chapters in parallel
      const [detailsResponse, chaptersResponse] = await Promise.all([
        client.fetch('/ap2/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
                        query get_comicNode($id: ID!) {
                            get_comicNode(id: $id) {
                                id
                                data {
                                    name
                                    urlPath
                                    urlCover600
                                    authors
                                    genres
                                    summary
                                    score_avg
                                    chaps_normal
                                    tranLang
                                    views { field count }
                                }
                            }
                        }
                    `,
            variables: { id },
          }),
        }),
        client.fetch('/ap2/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
                        query get_comic_chapterList($comicId: ID!) {
                            get_comic_chapterList(comicId: $comicId) {
                                id
                                data {
                                    dname
                                    urlPath
                                    dateCreate
                                    lang
                                    userNode { data { name } }
                                }
                            }
                        }
                    `,
            variables: { comicId: id },
          }),
        }),
      ]);

      const [detailsJson, chaptersJson] = await Promise.all([
        detailsResponse.json(),
        chaptersResponse.json(),
      ]);

      const comic = detailsJson?.data?.get_comicNode;
      if (!comic) {
        console.error(
          '[Service] Comic not found in GraphQL response. Errors:',
          JSON.stringify(detailsJson?.errors),
        );
        return null;
      }

      const data = comic.data;
      const comicLang = data.tranLang || 'en';
      const baseUrl = client.getBaseUrl();

      const rawChapters = chaptersJson?.data?.get_comic_chapterList || [];

      const chapters = rawChapters
        .filter((c: any) => {
          const cLang = c.data?.lang?.toLowerCase();
          const comicLangNorm = comicLang?.toLowerCase();

          // Permissive filtering:
          // 1. Specifically English
          // 2. Falsy/null language (defaults to comic language or English)
          // 3. Fallback to comic's language if it's English
          return (
            !cLang ||
            cLang === 'en' ||
            cLang === 'english' ||
            comicLangNorm === 'en' ||
            comicLangNorm === 'english'
          );
        })
        .map((c: any) => ({
          id: c.id,
          title: c.data?.dname || 'Unknown Chapter',
          url: c.data?.urlPath.startsWith('http')
            ? c.data.urlPath
            : `${baseUrl}${c.data.urlPath}`,
          uploadDate: c.data?.dateCreate
            ? new Date(c.data.dateCreate).toLocaleDateString()
            : '',
          group: c.data?.userNode?.data?.name || 'Scanlator',
        }))
        .sort((a: any, b: any) => {
           // Sort by ID descending (proxy for newest first)
           return Number(b.id) - Number(a.id);
        });

      // Extract total views (usually field 'd000')
      const totalViews =
        data.views?.find((v: any) => v.field === 'd000')?.count ||
        data.views?.[0]?.count ||
        0;

      return {
        id: comic.id,
        title: data.name || 'Unknown Title',
        url: data.urlPath.startsWith('http')
          ? data.urlPath
          : `${baseUrl}${data.urlPath}`,
        cover: data.urlCover600.startsWith('http')
          ? data.urlCover600
          : `${baseUrl}${data.urlCover600}`,
        description: data.summary || '',
        authors: data.authors || [],
        genres: data.genres || [],
        rating: data.score_avg?.toFixed(1) || 'N/A',
        latestChapter: chapters[0]?.title || '', 
        latestChapterUrl: chapters[0]?.url || undefined,
        latestChapterId: chapters[0]?.id || undefined,
        views: totalViews.toLocaleString(),
        chapters,
      };
    } catch (e) {
      console.error('[Service] getMangaDetails failed', e);
      return null;
    }
  },

  async getChapterPanels(chapterPath: string): Promise<string[]> {
    const client = BatotoClient.getInstance();
    try {
      // Extract chapter ID from path - handles formats like:
      // /title/191724-en-.../3405881-ch_1
      // /title/187470-en-.../4017163-vol_1-ch_34
      const path = chapterPath.replace(/^https?:\/\/[^/]+/, '');
      // Match the last path segment's numeric ID (before the first hyphen in that segment)
      const segments = path.split('/');
      const lastSegment = segments[segments.length - 1] || '';
      const idMatch = lastSegment.match(/^(\d+)/);
      const chapterId = idMatch ? idMatch[1] : '';

      if (!chapterId) {
        console.warn(
          `[Service] Could not extract chapter ID from path: ${path}`,
        );
        return [];
      }

      console.log(`[Service] Fetching panels for chapter ID: ${chapterId}`);

      const response = await client.fetch('/ap2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
                      query get_chapterNode($id: ID!) {
                          get_chapterNode(id: $id) {
                              id
                              data {
                                  dname
                                  imageFile { urlList }
                                  count_images
                              }
                          }
                      }
                  `,
          variables: { id: chapterId },
        }),
      });

      const json = await response.json();
      const chapterData = json?.data?.get_chapterNode?.data;

      if (!chapterData) {
        console.error(
          '[Service] Chapter not found in GraphQL response',
          json?.errors,
        );
        return [];
      }

      const rawUrls: string[] = chapterData.imageFile?.urlList || [];
      console.log(
        `[Service] Raw urlList[0..2]:`,
        JSON.stringify(rawUrls.slice(0, 3)),
      );

      // Reddit workaround: Batoto's k-servers are down, replace with n-servers
      // See: https://www.reddit.com/r/Batoto/comments/1pjdr6y/
      const fixBatoUrl = (url: string): string => {
        // Replace //k with //n in image server URLs (e.g., //k02.mbwbm.org -> //n02.mbwbm.org)
        return url.replace(/\/\/k(\d+)\.mb/g, '//n$1.mb');
      };

      let urls: string[] = [];
      if (rawUrls.length > 0) {
        const first = rawUrls[0];
        const second = rawUrls[1];

        // Detect if first is a prefix (absolute URL) and second is a relative path
        const looksLikePrefix =
          first.startsWith('http') && second && !second.startsWith('http');
        // Alternative: first has no image extension but is absolute
        const isBase =
          looksLikePrefix ||
          (first.startsWith('http') &&
            !/\.(webp|jpg|jpeg|png|gif)(\?.*)?$/i.test(first));

        if (isBase && rawUrls.length > 1) {
          const prefix = first.endsWith('/') ? first : first + '/';
          urls = rawUrls.slice(1).map(function transform(item: string): string {
            if (item.startsWith('http')) return fixBatoUrl(item);
            const cleanItem = item.startsWith('/') ? item.substring(1) : item;
            return fixBatoUrl(prefix + cleanItem);
          });
        } else {
          urls = rawUrls.map(function pass(item: string): string {
            return fixBatoUrl(item);
          });
        }
      }

      // --- IMAGE SPLITTING LOGIC ---
      // Detect tall images and split them using wsrv.nl proxy
      // Max height for cached textures on most mobile GPUs is 4096, but we use 3000 for safety padding
      // We use wsrv.nl because it supports precise cropping via cx, cy, cw, ch params
      const MAX_TEXTURE_HEIGHT = 3000;
      const finalUrls: string[] = [];

      for (const url of urls) {
        // Pattern: .../filename_WIDTH_HEIGHT_SIZE.ext or .../filename_WIDTH_HEIGHT_SIZE.ext?params
        // Example: .../132518261_720_12000_1485090.webp
        const match = url.match(/_(\d+)_(\d+)_(\d+)\.(webp|jpg|jpeg|png|gif)(?:$|\?)/i);
        
        if (match) {
          const width = parseInt(match[1], 10);
          const height = parseInt(match[2], 10);
          
          if (height > MAX_TEXTURE_HEIGHT) {
            console.log(`[Service] Detected tall image (${width}x${height}), splitting: ${url}`);
            
            // Calculate slices
            const slices = Math.ceil(height / MAX_TEXTURE_HEIGHT);
            
            for (let i = 0; i < slices; i++) {
              const startY = i * MAX_TEXTURE_HEIGHT;
              const sliceHeight = Math.min(MAX_TEXTURE_HEIGHT, height - startY);
              
              // wsrv.nl parameters: 
              // cx, cy, cw, ch = Crop Rectangle
              // output=webp (force efficient format)
              const sliceUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&cx=0&cy=${startY}&cw=${width}&ch=${sliceHeight}&output=webp`;
              finalUrls.push(sliceUrl);
            }
            continue; // Skip adding the original url
          }
        }
        
        finalUrls.push(url);
      }

      console.log(
        `[Service] Final panels: ${finalUrls.length} (expanded from ${urls.length}). First final: ${finalUrls[0]?.substring(0, 60)}`,
      );
      return finalUrls;
    } catch (e) {
      console.error('[Service] Panels failed', e);
      return [];
    }
  },

  /**
   * Get the latest releases from a dedicated endpoint
   * Note: get_comic_browse(sortby: "update") returns stale popular content,
   * so we use the dedicated get_latestReleases query for fresh updates.
   */
  async getLatestReleases(): Promise<Manga[]> {
    const client = BatotoClient.getInstance();
    try {
      console.log('[Service] getLatestReleases started');
      
      const response = await client.fetch('/ap2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              get_latestReleases {
                items {
                  id
                  data {
                    name
                    urlPath
                    urlCover600
                    authors
                    tranLang
                    summary
                    score_avg
                    chapterNode_up_to {
                      id
                      data {
                        dname
                        urlPath
                      }
                    }
                  }
                }
              }
            }
          `,
        }),
      });

      if (!response.ok) {
        console.error(`[Service] getLatestReleases failed: ${response.status}`);
        return [];
      }

      const json = await response.json();
      const items = json?.data?.get_latestReleases?.items || [];
      console.log(`[Service] getLatestReleases returned ${items.length} items`);

      const baseUrl = client.getBaseUrl();
      return items
        .filter((item: any) => {
           // Filter output to only English updates
           // tranLang is on the COMIC node, not the chapter node
           const lang = item.data?.tranLang || '';
           const norm = lang.toLowerCase().trim();
           return norm === 'en' || norm === 'english' || norm === ''; 
        })
        .map((item: any) => {
        const data = item.data;
        return {
          id: item.id || '',
          title: data.name || 'Unknown',
          url: data.urlPath?.startsWith('http')
            ? data.urlPath
            : `${baseUrl}${data.urlPath}`,
          cover: data.urlCover600?.startsWith('http')
            ? data.urlCover600
            : `${baseUrl}${data.urlCover600}`,
          authors: data.authors || [],
          rating: data.score_avg?.toFixed(1) || 'N/A',
          latestChapter: data.chapterNode_up_to?.data?.dname || '',
          latestChapterUrl: data.chapterNode_up_to?.data?.urlPath?.startsWith('http')
            ? data.chapterNode_up_to.data.urlPath
            : data.chapterNode_up_to?.data?.urlPath ? `${baseUrl}${data.chapterNode_up_to.data.urlPath}` : undefined,
          latestChapterId: data.chapterNode_up_to?.id || undefined,
          description: data.summary?.substring(0, 150) || '',
        };
      });
    } catch (e) {
      console.error('[Service] getLatestReleases failed', e);
      return [];
    }
  },

  async getBatchMangaInfo(ids: string[]): Promise<Manga[]> {
    const client = BatotoClient.getInstance();
    const baseUrl = client.getBaseUrl();
    const results: Manga[] = [];
    const CHUNK_SIZE = 5; // Concurrency limit

    console.log(`[Service] Batch fetching info for ${ids.length} mangas`);

    // Helper to process a chunk
    const processChunk = async (chunkIds: string[]) => {
      const promises = chunkIds.map(async (id) => {
        try {
          const response = await client.fetch('/ap2/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `
                      query get_comicNode($id: ID!) {
                          get_comicNode(id: $id) {
                              id
                              data {
                                  name
                                  urlPath
                                  urlCover600
                                  chapterNode_up_to {
                                    id
                                    data { dname, urlPath }
                                  }
                              }
                          }
                      }
                   `,
              variables: { id },
            }),
          });
          const json = await response.json();
          const item = json?.data?.get_comicNode;
          if (!item) return null;

          const data = item.data;
          return {
            id: item.id,
            title: data.name || 'Unknown',
            url: data.urlPath?.startsWith('http')
              ? data.urlPath
              : `${baseUrl}${data.urlPath}`,
            cover: data.urlCover600?.startsWith('http')
              ? data.urlCover600
              : `${baseUrl}${data.urlCover600}`,
            latestChapter: data.chapterNode_up_to?.data?.dname || '',
            latestChapterUrl: data.chapterNode_up_to?.data?.urlPath?.startsWith(
              'http',
            )
              ? data.chapterNode_up_to.data.urlPath
              : data.chapterNode_up_to?.data?.urlPath
              ? `${baseUrl}${data.chapterNode_up_to.data.urlPath}`
              : undefined,
            latestChapterId: data.chapterNode_up_to?.id || undefined,
            // Minimal set for updates
            authors: [],
            rating: '',
            description: '',
          } as Manga;
        } catch (e) {
          console.error(`[Service] Batch fetch failed for ${id}`, e);
          return null;
        }
      });

      return Promise.all(promises);
    };

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const chunkResults = await processChunk(chunk);
      results.push(...(chunkResults.filter((r) => r !== null) as Manga[]));
      // Small delay to be polite
      if (i + CHUNK_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return results;
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    const client = BatotoClient.getInstance();
    try {
      console.log('[Service] getHomeFeed started (GraphQL)');
      
      // Fetch Popular using browse (trending) and Latest using dedicated query
      const [popularResponse, latestResponse] = await Promise.all([
        this.browse({ sort: 'views_d030', page: 1 }), // Trending/Popular
        this.getLatestReleases()                      // Latest Updates (dedicated query)
      ]);

      return { 
        popular: popularResponse.slice(0, 14), 
        latest: latestResponse 
      };
    } catch (e) {
      console.error('[Service] getHomeFeed (GraphQL) failed', e);
      return { popular: [], latest: [] };
    }
  },

  getMirror(): string {
    return BatotoClient.getInstance().getBaseUrl();
  },

  /**
   * Browse manga with filters
   * Base URL pattern: https://bato.si/comics?lang=en&chapters=1&sortby=views_d030&page=1
   */
  async browse(filters?: {
    page?: number;
    sort?: 'views_d030' | 'views_d007' | 'update' | 'create';
    genres?: string[];
    status?: 'all' | 'ongoing' | 'completed' | 'hiatus';
    word?: string; // Search query
  }): Promise<Manga[]> {
    const client = BatotoClient.getInstance();
    const page = filters?.page || 1;
    const sort = filters?.sort || 'views_d030';

    console.log(
      `[Service] browse() called with page=${page}, sort=${sort}, word=${filters?.word || ''}`,
    );

    try {
      // Map sort options to GraphQL format
      const sortMap: Record<string, string> = {
        views_d030: 'views_d030',
        views_d007: 'views_d007',
        update: 'update',
        create: 'create',
      };

      // Map status to GraphQL format
      const statusMap: Record<string, string | undefined> = {
        all: undefined,
        ongoing: 'ongoing',
        completed: 'completed',
        hiatus: 'hiatus',
      };

      const gqlQuery = `
            query get_comic_browse($select: Comic_Browse_Select) {
              get_comic_browse(select: $select) {
                items {
                  id
                  data {
                    name
                    urlPath
                    urlCover600
                    authors
                    tranLang
                    summary
                    score_avg
                    chapterNode_up_to {
                      id
                      data {
                        dname
                        urlPath
                      }
                    }
                  }
                }
              }
            }
          `;

      const selectParams: any = {
        incTLangs: ['en'],
        size: 30,
      };

      // Add sort if specified
      if (sort) {
        selectParams.sortby = sortMap[sort] || 'views_d030';
      }

      // Add genres if specified (map to API identifiers)
      if (filters?.genres && filters.genres.length > 0) {
        const mappedGenres = filters.genres.map((g: string) =>
          mapGenreToApi(g),
        );
        console.log(
          '[Service] Genre mapping:',
          filters.genres,
          '->',
          mappedGenres,
        );
        selectParams.incGenres = mappedGenres;
      }

      // Add status if not 'all'
      if (filters?.status && filters.status !== 'all') {
        selectParams.origStatus = statusMap[filters.status];
      }

      // Add search word if specified
      if (filters?.word && filters.word.trim()) {
        selectParams.word = filters.word.trim();
      }

      console.log(
        '[Service] Browse selectParams:',
        JSON.stringify(selectParams),
      );

      const response = await client.fetch('/ap2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { select: selectParams },
        }),
      });

      if (!response.ok) {
        console.error(`[Service] Browse request failed: ${response.status}`);
        return [];
      }

      const json = await response.json();
      console.log(
        '[Service] Browse response:',
        JSON.stringify(json).substring(0, 500),
      );
      const items = json?.data?.get_comic_browse?.items || [];
      console.log(`[Service] Browse returned ${items.length} items`);

      const baseUrl = client.getBaseUrl();
      return items.map((item: any) => {
        const data = item.data;
        return {
          id: item.id || '',
          title: data.name || 'Unknown',
          url: data.urlPath?.startsWith('http')
            ? data.urlPath
            : `${baseUrl}${data.urlPath}`,
          cover: data.urlCover600?.startsWith('http')
            ? data.urlCover600
            : `${baseUrl}${data.urlCover600}`,
          authors: data.authors || [],
          rating: data.score_avg?.toFixed(1) || 'N/A',
          latestChapter: data.chapterNode_up_to?.data?.dname || '',
          latestChapterUrl: data.chapterNode_up_to?.data?.urlPath?.startsWith('http')
            ? data.chapterNode_up_to.data.urlPath
            : data.chapterNode_up_to?.data?.urlPath ? `${baseUrl}${data.chapterNode_up_to.data.urlPath}` : undefined,
          latestChapterId: data.chapterNode_up_to?.id || undefined,
          description: data.summary?.substring(0, 150) || '',
        };
      });
    } catch (e) {
      console.error('[Service] Browse failed', e);
      return [];
    }
  },
};
