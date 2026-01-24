import { useCallback, useState } from '@lynx-js/react';
import type { SearchFilters } from '../services/types';
import './SearchFilters.css';

interface Props {
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
  onReset?: () => void; // Optional callback to reset search query
  initialFilters?: SearchFilters; // Pre-populate with saved filters
}

// Complete genre list from Batoto
const GENRES = [
  '4-Koma', 'Action', 'Adult', 'Adventure', 'Artbook', 'Award Winning',
  'Comedy', 'Cooking', 'Doujinshi', 'Drama', 'Ecchi', 'Fantasy',
  'Gender Bender', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei',
  'Loli', 'Manhua', 'Manhwa', 'Martial Arts', 'Mecha', 'Medical',
  'Music', 'Mystery', 'One Shot', 'Overpowered MC', 'Psychological',
  'Reincarnation', 'Romance', 'School Life', 'Sci-fi', 'Seinen',
  'Shota', 'Shoujo', 'Shoujo Ai', 'Shounen', 'Shounen Ai', 'Slice of Life',
  'Sports', 'Super Power', 'Supernatural', 'Survival', 'Time Travel',
  'Tragedy', 'Webtoon', 'Yaoi', 'Yuri'
];

export const GENRE_MAP: Record<string, string> = {
    '4-Koma': '4-koma',
    'Action': 'action',
    'Adult': 'adult',
    'Adventure': 'adventure',
    'Artbook': 'artbook',
    'Award Winning': 'award-winning',
    'Comedy': 'comedy',
    'Cooking': 'cooking',
    'Doujinshi': 'doujinshi',
    'Drama': 'drama',
    'Ecchi': 'ecchi',
    'Fantasy': 'fantasy',
    'Gender Bender': 'gender-bender',
    'Harem': 'harem',
    'Historical': 'historical',
    'Horror': 'horror',
    'Isekai': 'isekai',
    'Josei': 'josei',
    'Loli': 'loli',
    'Manhua': 'manhua',
    'Manhwa': 'manhwa',
    'Martial Arts': 'martial-arts',
    'Mecha': 'mecha',
    'Medical': 'medical',
    'Music': 'music',
    'Mystery': 'mystery',
    'One Shot': 'one-shot',
    'Overpowered MC': 'overpowered-mc',
    'Psychological': 'psychological',
    'Reincarnation': 'reincarnation',
    'Romance': 'romance',
    'School Life': 'school-life',
    'Sci-fi': 'sci-fi',
    'Seinen': 'seinen',
    'Shota': 'shota',
    'Shoujo': 'shoujo',
    'Shoujo Ai': 'shoujo-ai',
    'Shounen': 'shounen',
    'Shounen Ai': 'shounen-ai',
    'Slice of Life': 'slice-of-life',
    'Sports': 'sports',
    'Super Power': 'super-power',
    'Supernatural': 'supernatural',
    'Survival': 'survival',
    'Time Travel': 'time-travel',
    'Tragedy': 'tragedy',
    'Webtoon': 'webtoon',
    'Yaoi': 'yaoi',
    'Yuri': 'yuri'
};

export function SearchFiltersModal({
  onApply,
  onClose,
  onReset,
  initialFilters,
}: Props) {
  const [filters, setFilters] = useState<SearchFilters>(
    initialFilters || {
      genres: [],
      status: 'all',
      sort: 'views_d030',
      nsfw: false,
    },
  );

  const toggleGenre = (genre: string) => {
    setFilters((prev: SearchFilters) => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter((g: string) => g !== genre)
        : [...prev.genres, genre],
    }));
  };

  const handleReset = () => {
    const resetFilters: SearchFilters = {
      genres: [],
      status: 'all',
      sort: 'views_d030',
      nsfw: false,
    };
    setFilters(resetFilters);
    onReset?.(); // Clear search query
    onApply(resetFilters); // Apply reset immediately
  };

  const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest Update' },
    { value: 'new', label: 'New Manga' },
    { value: 'az', label: 'A-Z' },
    { value: 'numc', label: 'Most Chapters' },
  ];

  const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <view className="FiltersOverlay" bindtap={onClose}>
      <view className="FiltersSheet" catchtap={() => {}}>
        <view className="FiltersHeader">
          <text className="FiltersTitle">Search Filters</text>
          <text className="ResetButton" bindtap={handleReset}>
            Reset
          </text>
        </view>

        <scroll-view className="FiltersContent" scroll-y>
          <text className="SectionLabel">Sort By</text>
          <view className="ChipRow">
            {SORT_OPTIONS.map((s) => (
              <view
                key={s.value}
                className={
                  filters.sort === s.value ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() =>
                  setFilters((prev: SearchFilters) => ({ ...prev, sort: s.value as any }))
                }
              >
                <text
                  className={
                    filters.sort === s.value
                      ? 'ChipText ChipText-active'
                      : 'ChipText'
                  }
                >
                  {s.label}
                </text>
              </view>
            ))}
          </view>

          <text className="SectionLabel">Status</text>
          <view className="ChipRow">
            {STATUS_OPTIONS.map((s) => (
              <view
                key={s.value}
                className={
                  filters.status === s.value ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() =>
                  setFilters((prev: SearchFilters) => ({ ...prev, status: s.value as any }))
                }
              >
                <text
                  className={
                    filters.status === s.value
                      ? 'ChipText ChipText-active'
                      : 'ChipText'
                  }
                >
                  {s.label}
                </text>
              </view>
            ))}
          </view>

          <text className="SectionLabel">Genres</text>
          <view className="GenreGrid">
            {GENRES.map((g) => (
              <view
                key={g}
                className={
                  filters.genres.includes(g)
                    ? 'GenreChip GenreChip-active'
                    : 'GenreChip'
                }
                bindtap={() => toggleGenre(g)}
              >
                <text
                  className={
                    filters.genres.includes(g)
                      ? 'GenreChipText GenreChipText-active'
                      : 'GenreChipText'
                  }
                >
                  {g}
                </text>
              </view>
            ))}
          </view>
        </scroll-view>

        <view className="FilterActions">
          <view className="ApplyButton" bindtap={() => onApply(filters)}>
            <text className="ApplyButtonText">Apply Filters</text>
          </view>
        </view>
      </view>
    </view>
  );
}

// Minimal inline styles for now, usually goes in .css
// .FiltersOverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; justify-content: flex-end; }
// .FiltersSheet { background: #fff; border-top-left-radius: 20px; border-top-right-radius: 20px; padding: 20px; height: 70%; }
