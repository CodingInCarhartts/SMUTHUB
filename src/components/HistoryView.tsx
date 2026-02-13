import { useEffect, useState } from '@lynx-js/react';
import { StorageService, type ViewedManga } from '../services/storage';
import type { Manga } from '../services/types';
import './HistoryView.css';

interface Props {
  onBack: () => void;
  onSelectHistoryItem: (
    manga: Manga,
    chapterUrl?: string,
    chapterTitle?: string,
  ) => void;
}

import { timeAgo } from '../utils/formatters';

export function HistoryView({ onBack, onSelectHistoryItem }: Props) {
  const [history, setHistory] = useState<ViewedManga[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestUpdates, setLatestUpdates] = useState<Map<string, Manga>>(
    new Map(),
  );

  useEffect(() => {
    loadHistory();
    checkForNewChapters();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getHistory();
      setHistory(data);
    } catch (e) {
      console.error('[HistoryView] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const checkForNewChapters = async () => {
    try {
      const updates = await StorageService.checkFavoritesForUpdates(false);
      setLatestUpdates(updates);
    } catch (e) {
      console.error('[HistoryView] Failed to check for updates:', e);
    }
  };

  const handleSelectManga = (item: ViewedManga) => {
    onSelectHistoryItem(item.manga, item.lastChapterId, item.lastChapterTitle);
  };

  return (
    <view className="HistoryView">
      <view className="HistoryView-header">
        <text className="HistoryView-back" bindtap={onBack}>
          ‹ Back
        </text>
        <text className="HistoryView-title">History</text>
        <view className="HistoryView-spacer" />
      </view>

      <scroll-view className="HistoryView-content" scroll-y>
        {loading ? (
          <view className="HistoryView-loading">
            <text className="HistoryView-loading-text">Loading history...</text>
          </view>
        ) : history.length === 0 ? (
          <view className="HistoryView-empty">
            <text className="HistoryView-empty-icon">📚</text>
            <text className="HistoryView-empty-title">No History Yet</text>
            <text className="HistoryView-empty-subtitle">
              Manga you read will appear here
            </text>
          </view>
        ) : (
          <view className="HistoryView-list">
            {history.map((item) => {
              const remoteManga = latestUpdates.get(item.manga.id);
              const hasUpdate = remoteManga
                ? StorageService.checkForUpdates(item.manga, remoteManga)
                : false;

              if (remoteManga) {
                console.log(
                  `[HistoryView] Item ${item.manga.title}: hasUpdate=${hasUpdate} (Remote: ${remoteManga.latestChapterUrl} vs Local: ${item.manga.latestChapterUrl})`,
                );
              }

              return (
                <view
                  key={item.manga.id}
                  className="HistoryView-item"
                  bindtap={() => handleSelectManga(item)}
                >
                  <image
                    src={item.manga.cover}
                    className="HistoryView-item-cover"
                    mode="aspectFill"
                  />
                  <view className="HistoryView-item-info">
                    <text className="HistoryView-item-title">
                      {item.manga.title}
                    </text>
                    <view className="HistoryView-item-meta">
                      {item.lastChapterTitle && (
                        <text className="HistoryView-item-chapter">
                          📖 {item.lastChapterTitle}
                        </text>
                      )}
                      {hasUpdate && (
                        <view className="HistoryView-item-badge-container">
                          <text className="HistoryView-item-badge">NEW</text>
                        </view>
                      )}
                    </view>
                    <text className="HistoryView-item-time">
                      {timeAgo(item.viewedAt)}
                    </text>
                  </view>
                  <text className="HistoryView-item-chevron">›</text>
                </view>
              );
            })}
          </view>
        )}
      </scroll-view>
    </view>
  );
}
