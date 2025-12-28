import { BatotoClient } from "./client";
import { BatotoParsers } from "./parsers";
import type { Manga, MangaDetails, Chapter, SearchFilters } from "./types";

export * from "./types";

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
                  incTLangs: ["en"]
                }
              }
            })
          });

          if (!response.ok) {
            const text = await response.text();
            console.error(`[Service] GraphQL request failed with status ${response.status}: ${text.substring(0, 100)}...`);
            return [];
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error(`[Service] Expected JSON but got ${contentType}. Body start: ${text.substring(0, 100)}...`);
            return [];
          }

          const json = await response.json();
          const items = json?.data?.get_comic_browse?.items || [];
          console.log(`[Service] GraphQL returned ${items.length} items`);

          const results = items.map((item: any) => {
            const data = item.data;
            const baseUrl = client.getBaseUrl();
            return {
              id: item.id || data.id || "",
              title: data.name || "Unknown Title",
              url: data.urlPath.startsWith("http") ? data.urlPath : `${baseUrl}${data.urlPath}`,
              cover: data.urlCover600.startsWith("http") ? data.urlCover600 : `${baseUrl}${data.urlCover600}`,
              author: data.authors?.[0] || "",
              latestChapter: data.chapterNode_up_to?.data?.dname || "",
            };
          });

          return results;
      } catch (e) {
          console.error("[Service] Search failed", e);
          return [];
      }
  },

  async getMangaDetails(mangaPath: string): Promise<MangaDetails | null> {
      const client = BatotoClient.getInstance();
      try {
          const path = mangaPath.replace(/^https?:\/\/[^\/]+/, "");
          const idMatch = path.match(/\/title\/(\d+)/);
          const id = idMatch ? idMatch[1] : "";
          
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
                                    views { field count }
                                }
                            }
                        }
                    `,
                    variables: { id }
                })
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
                                    userNode { data { name } }
                                }
                            }
                        }
                    `,
                    variables: { comicId: id }
                })
            })
          ]);

          const [detailsJson, chaptersJson] = await Promise.all([
              detailsResponse.json(),
              chaptersResponse.json()
          ]);

          const comic = detailsJson?.data?.get_comicNode;
          if (!comic) {
              console.error("[Service] Comic not found in GraphQL response. Headers:", detailsJson?.errors);
              return null;
          }

          const data = comic.data;
          const baseUrl = client.getBaseUrl();
          const chapters = (chaptersJson?.data?.get_comic_chapterList || []).map((c: any) => ({
              id: c.id,
              title: c.data?.dname || "Unknown Chapter",
              url: c.data?.urlPath.startsWith("http") ? c.data.urlPath : `${baseUrl}${c.data.urlPath}`,
              uploadDate: c.data?.dateCreate ? new Date(c.data.dateCreate).toLocaleDateString() : "",
              group: c.data?.userNode?.data?.name || "Scanlator"
          })).reverse(); 

          // Extract total views (usually field 'd000')
          const totalViews = data.views?.find((v: any) => v.field === 'd000')?.count || 
                             data.views?.[0]?.count || 0;

          return {
              id: comic.id,
              title: data.name || "Unknown Title",
              url: data.urlPath.startsWith("http") ? data.urlPath : `${baseUrl}${data.urlPath}`,
              cover: data.urlCover600.startsWith("http") ? data.urlCover600 : `${baseUrl}${data.urlCover600}`,
              description: data.summary || "",
              authors: data.authors || [],
              genres: data.genres || [],
              rating: data.score_avg?.toFixed(1) || "N/A",
              views: totalViews.toLocaleString(),
              chapters
          };
      } catch (e) {
          console.error("[Service] getMangaDetails failed", e);
          return null;
      }
  },

  async getChapterPanels(chapterPath: string): Promise<string[]> {
      const client = BatotoClient.getInstance();
      try {
          // Extract chapter ID from path - handles formats like:
          // /title/191724-en-.../3405881-ch_1
          // /title/187470-en-.../4017163-vol_1-ch_34
          const path = chapterPath.replace(/^https?:\/\/[^\/]+/, "");
          // Match the last path segment's numeric ID (before the first hyphen in that segment)
          const segments = path.split('/');
          const lastSegment = segments[segments.length - 1] || "";
          const idMatch = lastSegment.match(/^(\d+)/);
          const chapterId = idMatch ? idMatch[1] : "";
          
          if (!chapterId) {
              console.warn(`[Service] Could not extract chapter ID from path: ${path}`);
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
                  variables: { id: chapterId }
              })
          });

          const json = await response.json();
          const chapterData = json?.data?.get_chapterNode?.data;
          
          if (!chapterData) {
              console.error("[Service] Chapter not found in GraphQL response", json?.errors);
              return [];
          }

          const urls = chapterData.imageFile?.urlList || [];
          console.log(`[Service] Found ${urls.length} panels for chapter`);
          return urls;
      } catch (e) {
          console.error("[Service] Panels failed", e);
          return [];
      }
  },

  async getHomeFeed(): Promise<{ popular: Manga[], latest: Manga[] }> {
      const client = BatotoClient.getInstance();
      try {
          const response = await client.fetch("/");
          const html = await response.text();
          
          if (html.includes("HANG ON") || html.includes("trust this link")) {
              console.warn("[Service] Encountered Batoto authorization page on homepage. Session might be restricted.");
          }

          const allManga = BatotoParsers.parsePopularManga(html, client.getBaseUrl());
          console.log(`[Service] Parsed ${allManga.length} manga items total`);
          
          // Split loosely based on logic: Popular usually come first and marked with "Popular" genre in our parser
          const popular = allManga.filter(m => m.genres?.includes("Popular"));
          const latest = allManga.filter(m => !m.genres?.includes("Popular"));
          
          return { popular, latest };
      } catch (e) {
          console.error("Home feed failed", e);
          return { popular: [], latest: [] };
      }
  },
  
  // Keep back-compat for now if needed, or remove
  async getPopularManga(): Promise<Manga[]> {
      const feed = await this.getHomeFeed();
      return [...feed.popular, ...feed.latest];
  }
};
