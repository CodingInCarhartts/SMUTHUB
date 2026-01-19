import { parse } from 'node-html-parser';

// Helper for debug logging
const log = (msg: string) => console.log(`[EverythingMoe] ${msg}`);
const logError = (msg: string, e?: any) =>
  console.error(`[EverythingMoe] ${msg}`, e);

export interface DiscoveredSource {
  name: string;
  url: string;
  isNsfw: boolean;
}

export const EverythingMoeService = {
  baseUrl: 'https://everythingmoe.com',

  async discoverSources(): Promise<DiscoveredSource[]> {
    try {
      log('Fetching source list...');
      const response = await fetch(this.baseUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);

      const html = await response.text();
      const root = parse(html);

      // The user mentioned: <i class="mdil mdil-view-dashboard"></i> Manga Reading <div class="sec-count">(87)</div>
      // We need to find the specific section for Manga Reading.
      // Inspecting the HTML structure of everythingmoe (conceptually):
      // Sections are usually containers. We can look for links that look like external sources.

      // Since I can't browse the site interactively, I'll assume a structure or search for common patterns.
      // Based on the hint, we look for "Manga Reading".

      // Let's grab all links and filter? Or try to find the specific container.
      // For now, let's implement a generic scraper that looks for card-like elements with external links.

      const sources: DiscoveredSource[] = [];
      const links = root.querySelectorAll('a.item-link'); // Hypothethical class

      // Fallback: finding all external links
      const allLinks = root.querySelectorAll('a');
      for (const link of allLinks) {
        const href = link.getAttribute('href');
        const title = link.text.trim();

        if (
          href &&
          href.startsWith('http') &&
          !href.includes('everythingmoe.com')
        ) {
          // Basic heuristic
          sources.push({
            name: title || href,
            url: href,
            isNsfw: false, // Can't easily determine without more parsing
          });
        }
      }

      return sources;
    } catch (e) {
      logError('Discovery failed', e);
      return [];
    }
  },
};
