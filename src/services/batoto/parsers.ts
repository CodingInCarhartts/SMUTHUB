import { parse, HTMLElement } from "node-html-parser";
import type { Manga, Chapter, MangaDetails } from "./types";

export class BatotoParsers {
  /**
   * Parse search results from bato.si /v4x-search
   * Selectors confirmed via browser inspection:
   * - Item: div.group.relative.w-full
   * - Title: a.link-pri
   * - Image: img (first in item)
   */
  static parseSearch(html: string, baseUrl: string): Manga[] {
    console.log(`[Parser] parseSearch() started. HTML length: ${html.length}`);
    const root = parse(html);
    
    // Select all potential search result items
    // New Batoto structure uses flex rows with border-b. 
    // We check for items that actually contain a manga title link to avoid headers/footers.
    const potentialItems = root.querySelectorAll("div.flex.border-b, div.group.relative.w-full, div.item");
    
    console.log(`[Parser] parseSearch() found ${potentialItems.length} potential items`);

    const results = potentialItems.map((item) => {
      const titleAnchor = item.querySelector("a.link-pri") || 
                          item.querySelector("a.link-hover") ||
                          item.querySelector("a[href^='/title/']");
      const url = titleAnchor?.getAttribute("href") || "";
      if (!url || !url.includes("/title/")) return null;
      
      const cover = this.extractImageUrl(item, baseUrl);

      return {
        id: url.split("/").pop()?.split("-")[0] || "", // Extract numeric ID
        title: titleAnchor?.textContent?.trim() || "Unknown Title",
        url: url.startsWith("http") ? url : `${baseUrl}${url}`,
        cover: cover || "",
      };
    })
    .filter((m): m is Manga => m !== null && m.id !== "" && m.title !== "Unknown Title");

    console.log(`[Parser] parseSearch() returning ${results.length} valid results`);
    return results;
  }

  static parseMangaDetails(html: string, baseUrl: string): MangaDetails | null {
      const root = parse(html);
      
      // Title: h3 that is bold
      const title = root.querySelector("h3.font-bold")?.textContent?.trim() || 
                    root.querySelector("h3")?.textContent?.trim() || 
                    "Unknown Title";
                    
      const cover = this.extractImageUrl(root, baseUrl);
      const description = root.querySelector(".limit-html")?.textContent?.trim() || "";
      
      // Extract badges/meta from the new flex-col info area
      const infoItems = root.querySelectorAll(".flex.flex-col.gap-1 div");
      
      let status = "";
      let rating = "";
      let views = "";
      let authors: string[] = [];
      let genres: string[] = [];

      infoItems.forEach(item => {
          const text = item.textContent?.trim() || "";
          if (text.includes("Status:")) {
              status = text.replace("Status:", "").trim();
          } else if (text.includes("Author:")) {
              authors = item.querySelectorAll("a").map(a => a.textContent?.trim() || "").filter(Boolean);
          } else if (text.includes("Genres:")) {
              genres = item.querySelectorAll("span, a").map(s => s.textContent?.trim() || "").filter(Boolean);
          } else if (text.includes("Views:")) {
              views = text.replace("Views:", "").trim();
          } else if (text.includes("Vote:")) {
              rating = text.replace("Vote:", "").trim();
          }
      });

      // Chapter List: .scrollable-bar contains divs
      const chapters = root.querySelectorAll(".scrollable-bar > div").map((item) => {
        const anchor = item.querySelector("a.link-hover[href*='/chapter/']") || 
                      item.querySelector("a[href*='/chapter/']");
        const chapterUrl = anchor?.getAttribute("href") || "";
        const timeEl = item.querySelector("time");
        
        return {
          id: chapterUrl.split("/").pop() || "",
          title: anchor?.textContent?.trim() || "Unknown Chapter",
          url: chapterUrl.startsWith("http") ? chapterUrl : `${baseUrl}${chapterUrl}`,
          language: "English", 
          uploadDate: timeEl?.textContent?.trim() || ""
        };
      }).filter(c => c.url !== `${baseUrl}`);

      return {
          id: "", 
          title,
          url: "",
          cover,
          description,
          status: status || "Unknown",
          rating: rating || "N/A",
          views: views || "0",
          authors: authors.length > 0 ? authors : ["Unknown"],
          genres: genres.length > 0 ? genres : [],
          chapters
      };
  }

  static parseChapterPanels(html: string): string[] {
      const root = parse(html);
      const imgs = root.querySelectorAll(".item-list img, .page-img img");

      return imgs.map((img) => {
          let src = img.getAttribute("src") ||
                    img.getAttribute("data-src") ||
                    img.getAttribute("data-original") ||
                    "";

          // APPLY THE FIX: //k -> //n
          if (src.includes("//k") && src.includes(".mb")) {
            src = src.replace(/\/\/k/g, "//n");
          }
          return src;
      }).filter(src => src !== "");
  }

  /**
   * Helper to extract best possible image URL from an element
   */
  private static extractImageUrl(item: HTMLElement | null, baseUrl: string): string {
      if (!item) return "";
      const img = item.querySelector("img");
      if (!img) return "";

      const attrs = ["data-src", "data-original", "data-lazy-src", "src", "srcset"];
      let cover = "";

      for (const attr of attrs) {
          let val = img.getAttribute(attr);
          if (val) {
              if (attr === "srcset") {
                  // Standard srcset: "url 1x, url2 2x"
                  val = val.split(",")[0].trim().split(" ")[0];
              }
              // Skip obvious placeholders
              if (val.length > 5 && !val.includes("base64") && !val.includes("blank.gif")) {
                  cover = val;
                  break;
              }
          }
      }

      if (cover && !cover.startsWith("http") && !cover.startsWith("data:")) {
          cover = `${baseUrl}${cover.startsWith("/") ? "" : "/"}${cover}`;
      }
      return cover;
  }

  /**
   * Parse homepage manga from bato.si
   * Homepage has two main content areas:
   * 1. Trending Grid (top cards)
   * 2. Latest Updates List (flex rows below)
   */
  static parsePopularManga(html: string, baseUrl: string): Manga[] {
      console.log(`[Parser] Starting parsePopularManga, HTML length: ${html.length}`);
      const root = parse(html);
      const allManga: Manga[] = [];
      const seenIds = new Set<string>();

      // SECTION 1: Trending Grid
      // Selector: div.relative.w-full.group (usually the first 30+ items)
      const cards = root.querySelectorAll("div.relative.w-full.group") || 
                    root.querySelectorAll("div.group.relative.w-full");
      
      console.log(`[Parser] Found ${cards.length} trending grid cards`);

      cards.forEach((card, index) => {
          const titleAnchor = card.querySelector("a.link-hover") || 
                             card.querySelector("a.link") ||
                             card.querySelector("a[href^='/title/']");
          
          const url = titleAnchor?.getAttribute("href") || "";
          if (!url || !url.includes("/title/")) return;
          
          const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
          let title = titleAnchor?.textContent?.trim() || "";
          
          if (!title) {
              const slug = url.split("/").pop() || "";
              title = slug.split("-").slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          }
          
          const cover = this.extractImageUrl(card, baseUrl);
          const chapterLink = card.querySelector("a[href*='/ch_']");
          const mangaId = url.split("/").pop()?.split("-")[0] || "";

          // TRENDING LIMIT: Only take first 14 as "Popular" (for the slider)
          // The rest are just more popular items on homepage
          if (mangaId && !seenIds.has(mangaId)) {
              seenIds.add(mangaId);
              allManga.push({
                  id: mangaId,
                  title,
                  url: fullUrl,
                  cover,
                  latestChapter: chapterLink?.textContent?.trim(),
                  genres: index < 14 ? ["Popular"] : []
              });
          }
      });

      // SECTION 2: Latest Updates List (the flex rows)
      // These are usually further down and have more items
      const latestItems = root.querySelectorAll("div.flex.border-b");
      console.log(`[Parser] Found ${latestItems.length} latest update rows`);

      latestItems.forEach((item) => {
          const titleAnchor = item.querySelector("h3 a") || 
                              item.querySelector("a.link-pri") ||
                              item.querySelector("a[href^='/title/']");
          
          const url = titleAnchor?.getAttribute("href") || "";
          if (!url || !url.includes("/title/")) return;
          
          const mangaId = url.split("/").pop()?.split("-")[0] || "";
          // If we saw it in trending grid, we might skip or update.
          // For now, let's allow it if it wasn't in the FIRST 14 (Popular group)
          // to ensure the scroll list has "real" latest items from this section.
          if (mangaId && !seenIds.has(mangaId)) {
              seenIds.add(mangaId);
              
              const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
              const title = titleAnchor?.textContent?.trim() || "Unknown";
              const cover = this.extractImageUrl(item, baseUrl);
              const chapterLink = item.querySelector("a[href*='/ch_']");

              allManga.push({
                  id: mangaId,
                  title,
                  url: fullUrl,
                  cover,
                  latestChapter: chapterLink?.textContent?.trim(),
                  genres: [] // These definitely aren't in the Popular slider
              });
          }
      });

      console.log(`[Parser] Finished parsePopularManga. Total items: ${allManga.length}`);
      return allManga;
  }
}
