import { useEffect, useState } from '@lynx-js/react';
import { StorageService } from '../services/storage';
import type { Manga } from '../services/types';
import { MangaCard } from './MangaCard';
import './FavoritesView.css';

interface Props {
  onBack: () => void;
  onSelectManga: (manga: Manga) => void;
}

export function FavoritesView({ onBack, onSelectManga }: Props) {
  const [favorites, setFavorites] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getFavorites();
      setFavorites(data);
    } catch (e) {
      console.error('[FavoritesView] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectManga = (manga: Manga) => {
    onSelectManga(manga);
  };

  return (
    <view className="FavoritesView">
      <view className="FavoritesView-header">
        <text className="FavoritesView-back" bindtap={onBack}>
          ‹ Back
        </text>
        <text className="FavoritesView-title">Favorites</text>
        <view className="FavoritesView-spacer" />
      </view>

      <scroll-view className="FavoritesView-content" scroll-y>
        {loading ? (
          <view className="FavoritesView-loading">
            <text className="FavoritesView-loading-text">
              Loading favorites...
            </text>
          </view>
        ) : favorites.length === 0 ? (
          <view className="FavoritesView-empty">
            <text className="FavoritesView-empty-icon">💔</text>
            <text className="FavoritesView-empty-title">No Favorites Yet</text>
            <text className="FavoritesView-empty-subtitle">
              Tap the heart on any manga to add it here
            </text>
          </view>
        ) : (
          <view className="FavoritesView-grid">
            {favorites.map((manga) => (
              <view key={manga.id} className="FavoritesView-item">
                <MangaCard
                  manga={manga}
                  onSelect={handleSelectManga}
                  showFavoriteButton={true}
                />
              </view>
            ))}
          </view>
        )}
      </scroll-view>
    </view>
  );
}
