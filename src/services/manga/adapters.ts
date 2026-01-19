import { logCapture } from '../debugLog';
import type { Chapter, Manga } from './types';

const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

export function normalizeManga(data: any, source: string): Manga {
  const fallbackManga: Manga = {
    id: data.id || '',
    title: 'Unknown Title',
    url: '',
    cover: '',
    source,
  };

  try {
    if (!data) {
      logError('[Adapter] Empty manga data received');
      return fallbackManga;
    }

    return {
      id: data.id || '',
      title: data.title || data.name || 'Unknown Title',
      url: data.url || '',
      cover: data.cover || '',
      genres: data.genres || data.tags || [],
      latestChapter: data.latestChapter || data.latest_chapter || '',
      latestChapterUrl: data.latestChapterUrl || data.latest_chapter_url || '',
      latestChapterId: data.latestChapterId || data.latest_chapter_id || '',
      description: data.description || data.desc || '',
      authors:
        data.authors ||
        (Array.isArray(data.author) ? data.author : [data.author]).filter(
          Boolean,
        ),
      status: data.status || '',
      rating: data.rating || data.score || '',
      views: data.views || '',
      source,
    };
  } catch (e) {
    logError('[Adapter] Error normalizing manga:', e);
    return fallbackManga;
  }
}

export function normalizeChapter(data: any, source: string): Chapter {
  const fallbackChapter: Chapter = {
    id: data.id || '',
    title: 'Unknown Chapter',
    url: '',
    source,
  };

  try {
    if (!data) {
      logError('[Adapter] Empty chapter data received');
      return fallbackChapter;
    }

    return {
      id: data.id || data.chapter_id || '',
      title:
        data.title || data.dname || data.chapter_title || 'Unknown Chapter',
      url: data.url || data.chapter_url || '',
      chapterNum: data.chapterNum || data.chapter_num || data.chapter || '',
      volNum: data.volNum || data.vol_num || data.volume || '',
      language: data.language || data.lang || 'en',
      group:
        data.group || data.scanlation_group || data.group_name || 'Scanlator',
      uploadDate: data.uploadDate || data.upload_date || data.created_at || '',
      source,
    };
  } catch (e) {
    logError('[Adapter] Error normalizing chapter:', e);
    return fallbackChapter;
  }
}

export function normalizeMangaList(data: any[], source: string): Manga[] {
  if (!Array.isArray(data)) {
    logError('[Adapter] Expected array for manga list, got:', typeof data);
    return [];
  }

  return data
    .filter((item): item is object => item !== null && typeof item === 'object')
    .map((item) => normalizeManga(item, source))
    .filter((manga) => manga.id && manga.title);
}

export function normalizeChapterList(data: any[], source: string): Chapter[] {
  if (!Array.isArray(data)) {
    logError('[Adapter] Expected array for chapter list, got:', typeof data);
    return [];
  }

  return data
    .filter((item): item is object => item !== null && typeof item === 'object')
    .map((item) => normalizeChapter(item, source))
    .filter((chapter) => chapter.id && chapter.title)
    .sort((a, b) => {
      const aNum = parseFloat(a.chapterNum || '0');
      const bNum = parseFloat(b.chapterNum || '0');
      return bNum - aNum;
    });
}
