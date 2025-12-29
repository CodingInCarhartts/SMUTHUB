import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatotoService } from './index';
import { BatotoClient } from './client';

vi.mock('./client', () => {
  const mockClient = {
    fetch: vi.fn(),
    getBaseUrl: vi.fn(() => 'https://bato.to'),
  };
  return {
    BatotoClient: {
      getInstance: vi.fn(() => mockClient),
    },
  };
});

describe('BatotoService', () => {
  const client = BatotoClient.getInstance();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search for manga and format results', async () => {
      vi.mocked(client.fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({
          data: {
            get_comic_browse: {
              items: [{
                id: '123',
                data: {
                  name: 'Manga X',
                  urlPath: '/title/123-manga-x',
                  urlCover600: '/cover.jpg',
                  authors: ['Author A'],
                  chapterNode_up_to: { data: { dname: 'Ch. 10' } }
                }
              }]
            }
          }
        }),
      } as any);

      const results = await BatotoService.search('test');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('123');
      expect(results[0].title).toBe('Manga X');
      expect(results[0].latestChapter).toBe('Ch. 10');
    });
  });

  describe('getMangaDetails', () => {
    it('should fetch manga details and chapters', async () => {
      vi.mocked(client.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            get_comicNode: {
              id: '123',
              data: {
                name: 'Manga Details',
                urlPath: '/path',
                urlCover600: '/cover',
                authors: ['A'],
                genres: ['G'],
                summary: 'Sum',
                score_avg: 4.5
              }
            },
            get_comic_chapterList: [
              { id: 'c1', data: { dname: 'Chapter 1', urlPath: '/c1', lang: 'en' } }
            ]
          }
        }),
      } as any);

      const details = await BatotoService.getMangaDetails('/title/123-slug');
      expect(details?.title).toBe('Manga Details');
      expect(details?.chapters).toHaveLength(1);
      expect(details?.chapters[0].id).toBe('c1');
    });
  });

  describe('getChapterPanels', () => {
    it('should parse chapter panels correctly', async () => {
      vi.mocked(client.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            get_chapterNode: {
              data: {
                imageFile: {
                  urlList: ['https://cdn.com', 'page1.jpg', 'page2.jpg']
                }
              }
            }
          }
        }),
      } as any);

      const panels = await BatotoService.getChapterPanels('/title/123/456-ch_1');
      expect(panels).toEqual([
        'https://cdn.com/page1.jpg',
        'https://cdn.com/page2.jpg'
      ]);
    });
  });

  describe('browse', () => {
    it('should browse with filters', async () => {
      vi.mocked(client.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            get_comic_browse: {
              items: [{ id: 'b1', data: { name: 'Browsed Manga', urlPath: '/b1', urlCover600: '/c1' } }]
            }
          }
        }),
      } as any);

      const results = await BatotoService.browse({ sort: 'update', genres: ['Action'] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Browsed Manga');
      expect(vi.mocked(client.fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"sortby":"update"')
        })
      );
    });
  });

  describe('getHomeFeed', () => {
    it('should parse home feed from HTML', async () => {
      vi.mocked(client.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Trending...</body></html>'),
      } as any);

      const feed = await BatotoService.getHomeFeed();
      expect(feed.popular).toBeDefined();
      expect(feed.latest).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return empty results on failure', async () => {
      vi.mocked(client.fetch).mockRejectedValue(new Error('Network fail'));
      const results = await BatotoService.search('test');
      expect(results).toEqual([]);
    });

    it('should return null on details failure', async () => {
      vi.mocked(client.fetch).mockRejectedValue(new Error('Network fail'));
      const details = await BatotoService.getMangaDetails('path');
      expect(details).toBeNull();
    });
  });
});
