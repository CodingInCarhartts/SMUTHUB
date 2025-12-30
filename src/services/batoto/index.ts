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
                      data {
                        dname
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
        }));

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

      console.log(
        `[Service] Final panels: ${urls.length}. First final: ${urls[0]?.substring(0, 60)}`,
      );
      return urls;
    } catch (e) {
      console.error('[Service] Panels failed', e);
      return [];
    }
  },

  async getHomeFeed(): Promise<{ popular: Manga[]; latest: Manga[] }> {
    const client = BatotoClient.getInstance();
    try {
      console.log('[Service] getHomeFeed started (GraphQL)');
      
      // We'll fetch Popular and Latest using the browse logic but optimized
      const [popularResponse, latestResponse] = await Promise.all([
        this.browse({ sort: 'views_d030', page: 1 }), // Trending/Popular
        this.browse({ sort: 'update', page: 1 })      // Latest Updates
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
                      data {
                        dname
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
          description: data.summary?.substring(0, 150) || '',
        };
      });
    } catch (e) {
      console.error('[Service] Browse failed', e);
      return [];
    }
  },
};
