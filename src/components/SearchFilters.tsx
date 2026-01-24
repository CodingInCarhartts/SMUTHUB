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
  // Main Types
  'Manga',
  'Oneshot',
  'Shoujo(G)',
  'Shoujo ai',
  'Manhua',
  'Artbook',
  'Shounen(B)',
  'Shounen ai',
  'Manhwa',
  'Imageset',
  'Josei(W)',
  'Non-human',
  'Webtoon',
  'Seinen(M)',
  'Yuri(GL)',
  'Yaoi(BL)',
  'Bara(ML)',
  'Kodomo(Kid)',
  'Comic',
  'Cartoon',
  'Western',
  'Doujinshi',
  '4-Koma',
  'Silver & Golden',
  // Content
  'Gore',
  'Bloody',
  'Violence',
  'Ecchi',
  'Adult',
  'Mature',
  'Smut',
  // Genres
  'Action',
  'Adaptation',
  'Adventure',
  'Age Gap',
  'Aliens',
  'Animals',
  'Anthology',
  'Boys',
  'Cars',
  'Cheating/Infidelity',
  'Childhood Friends',
  'College life',
  'Comedy',
  'Contest winning',
  'Crossdressing',
  'Delinquents',
  'Dementia',
  'Demons',
  'Drama',
  'Dungeons',
  "Emperor's daughter",
  'Fetish',
  'Full Color',
  'Game',
  'Gender Bender',
  'Genderswap',
  'Ghosts',
  'Girls',
  'Harlequin',
  'Historical',
  'Horror',
  'Incest',
  'Isekai',
  'Kids',
  'Magic',
  'Mecha',
  'Medical',
  'Military',
  'Monster Girls',
  'Monsters',
  'Music',
  'Mystery',
  'Ninja',
  'Office Workers',
  'Omegaverse',
  'Parody',
  'Philosophical',
  'Police',
  'Post-Apocalyptic',
  'Reincarnation',
  'Reverse Harem',
  'Revenge',
  'Reverse Isekai',
  'Romance',
  'Royal family',
  'Royalty',
  'Sci-Fi',
  'Showbiz',
  'Slice of Life',
  'SM/BDSM/SUB-DOM',
  'Space',
  'Sports',
  'Tragedy',
  'Survival',
  'Thriller',
  'Time Travel',
  'Tower Climbing',
  'Traditional Games',
  'Yakuzas',
  'Transmigration',
  'Video Games',
  'Virtual Reality',
  'Wuxia',
  'Xianxia',
  'Xuanhuan',
  'Zombies',
  // Content style
  'Beasts',
  'Cooking',
  'Bodyswap',
  'Crime',
  'Fantasy',
  'Fan-Colored',
  'Harem',
  'Gyaru',
  'Magical Girls',
  'Martial Arts',
  'Netori',
  'Netorare/NTR',
  'Psychological',
  'Regression',
  'Samurai',
  'School Life',
  'Superhero',
  'Supernatural',
  'Vampires',
  'Villainess',
];

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
    { value: 'views_d030', label: 'Popular (30 days)' },
    { value: 'views_d007', label: 'Popular (7 days)' },
    { value: 'update', label: 'Recently Updated' },
    { value: 'create', label: 'Newest' },
  ];

  const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'hiatus', label: 'Hiatus' },
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
