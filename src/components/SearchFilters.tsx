import { useCallback, useState } from '@lynx-js/react';
import type { SearchFilters } from '../services/types';
import './SearchFilters.css';

interface Props {
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
  onReset?: () => void;
  initialFilters?: SearchFilters;
}

const TYPES = [
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'webtoon', label: 'Webtoon' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best Match' },
  { value: 'latest', label: 'Latest Update' },
  { value: 'new', label: 'New Manga' },
  { value: 'az', label: 'A-Z' },
  { value: 'numc', label: 'Most Chapters' },
  { value: 'views_d030', label: 'Most Popular (30 days)' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Finished' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
];

const GENRES = [
  'Action',
  'Adult',
  'Adventure',
  'Boys Love',
  'Comedy',
  'Crime',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Girls Love',
  'Hentai',
  'Historical',
  'Horror',
  'Isekai',
  'Magical Girls',
  'Mature',
  'Mecha',
  'Medical',
  'Mystery',
  'Philosophical',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Smut',
  'Sports',
  'Superhero',
  'Thriller',
  'Tragedy',
  'Wuxia',
];

const THEMES = [
  'Aliens',
  'Animals',
  'Cooking',
  'Crossdressing',
  'Delinquents',
  'Demons',
  'Genderswap',
  'Ghosts',
  'Gyaru',
  'Harem',
  'Incest',
  'Loli',
  'Mafia',
  'Magic',
  'Martial Arts',
  'Military',
  'Monster Girls',
  'Monsters',
  'Music',
  'Ninja',
  'Office Workers',
  'Police',
  'Post-Apocalyptic',
  'Reincarnation',
  'Reverse Harem',
  'Samurai',
  'School Life',
  'Shota',
  'Supernatural',
  'Survival',
  'Time Travel',
  'Traditional Games',
  'Vampires',
  'Video Games',
  'Villainess',
  'Virtual Reality',
  'Zombies',
];

const FORMATS = [
  '4-Koma',
  'Adaptation',
  'Anthology',
  'Award Winning',
  'Doujinshi',
  'Full Color',
  'Long Strip',
  'Oneshot',
  'Web Comic',
];

const DEMOGRAPHICS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];

export function SearchFiltersModal({
  onApply,
  onClose,
  onReset,
  initialFilters,
}: Props) {
  const [filters, setFilters] = useState<SearchFilters>(
    initialFilters || {
      genres: [],
      themes: [],
      formats: [],
      demographics: [],
      types: [],
      status: 'all',
      sort: 'relevance',
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

  const toggleTheme = (theme: string) => {
    setFilters((prev: SearchFilters) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t: string) => t !== theme)
        : [...prev.themes, theme],
    }));
  };

  const toggleFormat = (format: string) => {
    setFilters((prev: SearchFilters) => ({
      ...prev,
      formats: prev.formats.includes(format)
        ? prev.formats.filter((f: string) => f !== format)
        : [...prev.formats, format],
    }));
  };

  const toggleDemographic = (demographic: string) => {
    setFilters((prev: SearchFilters) => ({
      ...prev,
      demographics: prev.demographics.includes(demographic)
        ? prev.demographics.filter((d: string) => d !== demographic)
        : [...prev.demographics, demographic],
    }));
  };

  const toggleType = (type: string) => {
    setFilters((prev: SearchFilters) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t: string) => t !== type)
        : [...prev.types, type],
    }));
  };

  const handleReset = () => {
    const resetFilters: SearchFilters = {
      genres: [],
      themes: [],
      formats: [],
      demographics: [],
      types: [],
      status: 'all',
      sort: 'relevance',
      nsfw: false,
    };
    setFilters(resetFilters);
    onReset?.();
    onApply(resetFilters);
  };

  return (
    <view className="FiltersOverlay" bindtap={onClose}>
      <view className="FiltersSheet" catchtap={() => {}}>
        <view className="FiltersHeader">
          <text className="FiltersTitle">Filters</text>
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
                  setFilters((prev: SearchFilters) => ({
                    ...prev,
                    sort: s.value as any,
                  }))
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

          <text className="SectionLabel">Types</text>
          <view className="ChipRow">
            {TYPES.map((t) => (
              <view
                key={t.value}
                className={
                  filters.types.includes(t.value) ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() => toggleType(t.value)}
              >
                <text
                  className={
                    filters.types.includes(t.value)
                      ? 'ChipText ChipText-active'
                      : 'ChipText'
                  }
                >
                  {t.label}
                </text>
              </view>
            ))}
          </view>

          <text className="SectionLabel">Release Status</text>
          <view className="ChipRow">
            {STATUS_OPTIONS.map((s) => (
              <view
                key={s.value}
                className={
                  filters.status === s.value ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() =>
                  setFilters((prev: SearchFilters) => ({
                    ...prev,
                    status: s.value as any,
                  }))
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

          <text className="SectionLabel">Demographics</text>
          <view className="ChipRow">
            {DEMOGRAPHICS.map((d) => (
              <view
                key={d}
                className={
                  filters.demographics.includes(d) ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() => toggleDemographic(d)}
              >
                <text
                  className={
                    filters.demographics.includes(d)
                      ? 'ChipText ChipText-active'
                      : 'ChipText'
                  }
                >
                  {d}
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

          <text className="SectionLabel">Themes</text>
          <view className="GenreGrid">
            {THEMES.map((t) => (
              <view
                key={t}
                className={
                  filters.themes.includes(t)
                    ? 'GenreChip GenreChip-active'
                    : 'GenreChip'
                }
                bindtap={() => toggleTheme(t)}
              >
                <text
                  className={
                    filters.themes.includes(t)
                      ? 'GenreChipText GenreChipText-active'
                      : 'GenreChipText'
                  }
                >
                  {t}
                </text>
              </view>
            ))}
          </view>

          <text className="SectionLabel">Formats</text>
          <view className="ChipRow">
            {FORMATS.map((f) => (
              <view
                key={f}
                className={
                  filters.formats.includes(f) ? 'Chip Chip-active' : 'Chip'
                }
                bindtap={() => toggleFormat(f)}
              >
                <text
                  className={
                    filters.formats.includes(f)
                      ? 'ChipText ChipText-active'
                      : 'ChipText'
                  }
                >
                  {f}
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
