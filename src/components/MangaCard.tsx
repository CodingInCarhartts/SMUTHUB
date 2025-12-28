import type { Manga } from '../services/batoto';
import './MangaCard.css';

interface Props {
  manga: Manga;
  onSelect: (manga: Manga) => void;
}

export function MangaCard({ manga, onSelect }: Props) {
  return (
    <view className="MangaCard" bindtap={() => onSelect(manga)}>
      <image src={manga.cover} className="MangaCard-cover" mode="aspectFill" />
      <view className="MangaCard-info">
        <text className="MangaCard-title">{manga.title}</text>
        {manga.latestChapter && (
           <text className="MangaCard-chapter">{manga.latestChapter}</text>
        )}
        {manga.genres && manga.genres.length > 0 && (
           <text className="MangaCard-genres">{manga.genres.join(", ")}</text>
        )}
      </view>
    </view>
  );
}
