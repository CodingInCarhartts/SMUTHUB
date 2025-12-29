import type { Manga, SearchFilters } from '../services/batoto';
import { MangaCard } from './MangaCard';
import { Search } from './Search';

interface SearchViewContainerProps {
  mangas: Manga[];
  loading: boolean;
  searchQuery: string;
  currentFilters: SearchFilters | undefined;
  onSearch: (query: string) => void;
  onFilterClick: () => void;
  onSelectManga: (manga: Manga) => void;
}

export function SearchViewContainer({
  mangas,
  loading,
  searchQuery,
  currentFilters,
  onSearch,
  onFilterClick,
  onSelectManga,
}: SearchViewContainerProps) {
  return (
    <view className="SearchView">
      <Search
        onSearch={onSearch}
        onFilterClick={onFilterClick}
        value={searchQuery}
      />
      <scroll-view className="MangaList" scroll-y>
        {loading ? (
          <view className="LoadingContainer">
            <view className="LoadingSpinner" />
            <text className="StatusText">Searching the library...</text>
          </view>
        ) : mangas.length > 0 ? (
          mangas.map((m) => (
            <MangaCard key={m.id} manga={m} onSelect={onSelectManga} />
          ))
        ) : (
          <view className="EmptyState">
            <text className="EmptyIcon">{searchQuery ? '😞' : '🔍'}</text>
            <text className="EmptyTitle">
              {searchQuery ? 'No Results Found' : 'Start Your Search'}
            </text>
            <text className="EmptySubtitle">
              {searchQuery
                ? `We couldn't find anything for "${searchQuery}". Try different keywords.`
                : 'Discover your next favorite manga by typing above.'}
            </text>
            {currentFilters && (
              <text className="FilterStatus">
                Filters active: {currentFilters.genres.length} genres
              </text>
            )}
          </view>
        )}
      </scroll-view>
    </view>
  );
}
