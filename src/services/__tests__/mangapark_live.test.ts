import { describe, expect, it } from 'vitest';
import { MangaparkService } from '../mangapark';

describe('MangaparkService (MangaKatana Mirror)', () => {
  it('should search for manga', async () => {
    const results = await MangaparkService.search('Solo Leveling');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Solo Leveling');
    expect(results[0].id).toContain('mangapark:');
    expect(results[0].url).toContain('mangakatana.com');
  }, 15000);

  it('should get manga details', async () => {
    const details = await MangaparkService.getMangaDetails(
      'https://mangakatana.com/manga/solo-leveling.21708',
    );
    expect(details).not.toBeNull();
    expect(details?.title).toBe('Solo Leveling');
    expect(details?.chapters.length).toBeGreaterThan(0);
  }, 15000);

  it('should get chapter pages', async () => {
    const pages = await MangaparkService.getChapterPages(
      'https://mangakatana.com/manga/solo-leveling.21708/c200',
    );
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]).toContain('http');
  }, 15000);

  it('should get home feed', async () => {
    const feed = await MangaparkService.getHomeFeed();
    expect(feed.popular.length).toBeGreaterThan(0);
    expect(feed.latest.length).toBeGreaterThan(0);
  }, 15000);
});
