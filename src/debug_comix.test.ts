
import { describe, test, expect } from 'vitest';
import { ComixService } from './services/comix/index.js';

describe('ComixService Debug', () => {
  test('Fetch Popular, Search, and Details', { timeout: 30000 }, async () => {
    console.log('--- Testing ComixService ---');

    // 1. Popular Feed
    console.log('\n[1] Fetching Popular Manga...');
    const popular = await ComixService.getPopularManga(1);
    console.log(`Found ${popular.length} items.`);
    if (popular.length > 0) {
      console.log('Sample:', popular[0]);
    }
    // expect(popular.length).toBeGreaterThan(0);

    // 2. Search
    console.log('\n[2] Searching for "duke"...');
    const searchResults = await ComixService.searchManga('duke');
    console.log(`Found ${searchResults.length} items.`);
    if (searchResults.length > 0) {
      console.log('Sample:', searchResults[0]);
    }
    // expect(searchResults.length).toBeGreaterThan(0);

    // 3. Details
    const target = popular[0] || searchResults[0];
    if (target) {
        console.log(`\n[3] Fetching details for ${target.id} (${target.title})...`);
        const details = await ComixService.getMangaDetails(target.id);
        console.log('Title:', details.title);
        console.log('Details Cover:', details.cover);
        console.log('Chapters:', details.chapters.length);
        if (details.chapters.length > 0) {
            console.log('First Chapter:', details.chapters[0]);
            
            // 4. Chapter Pages
             console.log(`\n[4] Fetching pages for ${details.chapters[0].id}...`);
             const pages = await ComixService.getChapterPages(target.id, details.chapters[0].id);
             console.log(`Found ${pages.length} pages.`);
        } else {
            console.log('WARNING: No chapters found (logic needs fix?)');
        }
    }
  });
});
