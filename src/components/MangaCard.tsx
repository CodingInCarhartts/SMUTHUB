import { useEffect, useState } from '@lynx-js/react';
import type { Manga } from '../services/types';
import { StorageService } from '../services/storage';
import './MangaCard.css';

interface Props {
  manga: Manga;
  onSelect: (manga: Manga) => void;
  showFavoriteButton?: boolean;
}

export function MangaCard({
  manga,
  onSelect,
  showFavoriteButton = true,
}: Props) {
  const [isFavorite, setIsFavorite] = useState(
    StorageService.isFavoriteSync(manga.id),
  );
  const [loading, setLoading] = useState(false);

  // Check actual favorite status async
  useEffect(() => {
    StorageService.isFavorite(manga.id).then(setIsFavorite);
  }, [manga.id]);

  const handleToggleFavorite = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (isFavorite) {
        await StorageService.removeFavorite(manga.id);
        setIsFavorite(false);
      } else {
        await StorageService.addFavorite(manga);
        setIsFavorite(true);
      }
    } catch (e) {
      console.error('[MangaCard] Favorite toggle failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <view className="MangaCard" bindtap={() => onSelect(manga)}>
      <view className="MangaCard-cover-container">
        <image
          src={manga.cover}
          className="MangaCard-cover"
          mode="aspectFill"
        />
        {showFavoriteButton && (
          <view
            className={
              isFavorite ? 'MangaCard-favorite active' : 'MangaCard-favorite'
            }
            catchtap={handleToggleFavorite}
          >
            <text className="MangaCard-favorite-icon">
              {loading ? '⏳' : isFavorite ? '❤️' : '🤍'}
            </text>
          </view>
        )}
      </view>
      <view className="MangaCard-info">
        <text className="MangaCard-title">{manga.title}</text>
        {manga.latestChapter && (
          <text className="MangaCard-chapter">{manga.latestChapter}</text>
        )}
        {manga.genres && manga.genres.length > 0 && (
          <text className="MangaCard-genres">{manga.genres.join(', ')}</text>
        )}
      </view>
    </view>
  );
}
