import { describe, it, expect } from 'vitest';
import { BatotoParsers } from './parsers';

describe('BatotoParsers', () => {
  const baseUrl = 'https://bato.to';

  describe('parseSearch', () => {
    it('should parse search results correctly', () => {
      const html = `
        <div class="flex border-b">
          <a class="link-pri" href="/title/12345-manga-title">Manga Title</a>
          <img src="/cover.jpg" />
        </div>
        <div class="group relative w-full">
          <a class="link-hover" href="/title/67890-manga-two">Manga Two</a>
          <img data-src="/cover2.jpg" />
        </div>
      `;
      const results = BatotoParsers.parseSearch(html, baseUrl);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: '12345',
        title: 'Manga Title',
        url: 'https://bato.to/title/12345-manga-title',
        cover: 'https://bato.to/cover.jpg'
      });
      expect(results[1].id).toBe('67890');
    });

    it('should return empty array for empty html', () => {
      expect(BatotoParsers.parseSearch('', baseUrl)).toEqual([]);
    });

    it('should filter out invalid items', () => {
      const html = `
        <div class="flex border-b">
          <a class="link-pri" href="/not-a-title/123">Invalid</a>
        </div>
      `;
      expect(BatotoParsers.parseSearch(html, baseUrl)).toHaveLength(0);
    });
  });

  describe('parseMangaDetails', () => {
    it('should parse manga details correctly', () => {
      const html = `
        <h3 class="font-bold">Manga Title</h3>
        <img src="/cover.jpg" />
        <div class="limit-html">Description here</div>
        <div class="flex flex-col gap-1">
          <div>Status: Ongoing</div>
          <div>Author: <a>Author Name</a></div>
          <div>Genres: <span>Genre 1</span> <a>Genre 2</a></div>
          <div>Views: 1000</div>
          <div>Vote: 4.5</div>
        </div>
        <div class="scrollable-bar">
          <div>
            <a class="link-hover" href="/chapter/111">Chapter 1</a>
            <time>1 day ago</time>
          </div>
        </div>
      `;
      const details = BatotoParsers.parseMangaDetails(html, baseUrl);
      expect(details).not.toBeNull();
      expect(details?.title).toBe('Manga Title');
      expect(details?.status).toBe('Ongoing');
      expect(details?.authors).toEqual(['Author Name']);
      expect(details?.genres).toEqual(['Genre 1', 'Genre 2']);
      expect(details?.views).toBe('1000');
      expect(details?.rating).toBe('4.5');
      expect(details?.chapters).toHaveLength(1);
      expect(details?.chapters[0].id).toBe('111');
    });
  });

  describe('parseChapterPanels', () => {
    it('should parse chapter panels and apply the //k -> //n fix', () => {
      const html = `
        <div class="item-list">
          <img src="https://cdnt.com/image1.jpg" />
          <img data-src="https://k.bato.to/image2.mb.jpg" />
        </div>
      `;
      const panels = BatotoParsers.parseChapterPanels(html);
      expect(panels).toEqual([
        'https://cdnt.com/image1.jpg',
        'https://n.bato.to/image2.mb.jpg'
      ]);
    });
  });

  describe('parsePopularManga', () => {
    it('should parse popular and latest manga', () => {
      const html = `
        <div class="relative w-full group">
          <a class="link-hover" href="/title/1-top-manga">Top Manga</a>
          <img src="/top.jpg" />
          <a href="/ch_1">Ch. 1</a>
        </div>
        <div class="flex border-b">
          <a class="link-pri" href="/title/2-latest-manga">Latest Manga</a>
          <img src="/latest.jpg" />
          <a href="/ch_5">Ch. 5</a>
        </div>
      `;
      const results = BatotoParsers.parsePopularManga(html, baseUrl);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[0].genres).toEqual(['Popular']);
      expect(results[1].id).toBe('2');
      expect(results[1].genres).toEqual([]);
    });
  });
});
