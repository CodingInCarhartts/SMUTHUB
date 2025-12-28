import { BatotoClient } from "./client";
import { BatotoParsers } from "./parsers";
import type { Manga, MangaDetails, Chapter, SearchFilters } from "./types";

export * from "./types";

export const BatotoService = {
  async search(query: string, _filters?: SearchFilters): Promise<Manga[]> {
      const client = BatotoClient.getInstance();
      console.log(`[Service] search() called with query: "${query}"`);
      try {
          // New Batoto uses GraphQL for search results
          const gqlQuery = `
            query get_search_comic($select: Search_Comic_Select) {
              get_search_comic(select: $select) {
                items {
                  id
                  data {
                    name
                    urlPath
                    urlCover600
                    authors
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
                  word: query
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
          const items = json?.data?.get_search_comic?.items || [];
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
          const response = await client.fetch(path);
          const html = await response.text();
          return BatotoParsers.parseMangaDetails(html, client.getBaseUrl());
      } catch (e) {
          console.error("Details failed", e);
          return null;
      }
  },

  async getChapterPanels(chapterPath: string): Promise<string[]> {
      const client = BatotoClient.getInstance();
      try {
          const path = chapterPath.replace(/^https?:\/\/[^\/]+/, "");
          const response = await client.fetch(path);
          const html = await response.text();
          return BatotoParsers.parseChapterPanels(html);
      } catch (e) {
          console.error("Panels failed", e);
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
