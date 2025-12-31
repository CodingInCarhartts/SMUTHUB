import { useEffect, useState } from '@lynx-js/react';
import type { Manga } from '../services/batoto';
import { StorageService, type ViewedManga } from '../services/storage';
import './HistoryView.css';

interface Props {
  onBack: () => void;
  onSelectHistoryItem: (manga: Manga, chapterUrl?: string, chapterTitle?: string) => void;
}

// Helper to format relative time
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function HistoryView({ onBack, onSelectHistoryItem }: Props) {
  const [history, setHistory] = useState<ViewedManga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
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
            {history.map((item) => (
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
                  {item.lastChapterTitle && (
                    <text className="HistoryView-item-chapter">
                      📖 {item.lastChapterTitle}
                    </text>
                  )}
                  <text className="HistoryView-item-time">
                    {timeAgo(item.viewedAt)}
                  </text>
                </view>
                <text className="HistoryView-item-chevron">›</text>
              </view>
            ))}
          </view>
        )}
      </scroll-view>
    </view>
  );
}
