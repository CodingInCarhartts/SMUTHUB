import { useState, useCallback } from '@lynx-js/react';
import type { SearchFilters } from '../services/batoto/types';
import './SearchFilters.css';

interface Props {
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
}

const GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Harem", "Horror", "Isekai", 
    "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Seinen", 
    "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy", "Yaoi", "Yuri"
];

export function SearchFiltersModal({ onApply, onClose }: Props) {
    const [filters, setFilters] = useState<SearchFilters>({
        genres: [],
        status: 'all',
        sort: 'views',
        nsfw: false
    });

    const toggleGenre = (genre: string) => {
        setFilters(prev => ({
            ...prev,
            genres: prev.genres.includes(genre) 
                ? prev.genres.filter(g => g !== genre)
                : [...prev.genres, genre]
        }));
    };

    const handleReset = () => {
        setFilters({
            genres: [],
            status: 'all',
            sort: 'views',
            nsfw: false
        });
    };

    return (
        <view className="FiltersOverlay" bindtap={onClose}>
            <view className="FiltersSheet" catchtap={(e: any) => e.stopPropagation()}>
                <view className="FiltersHeader">
                    <text className="FiltersTitle">Search Filters</text>
                    <text className="ResetButton" bindtap={handleReset}>Reset</text>
                </view>
                
                <scroll-view className="FiltersContent" scroll-y>
                    <text className="SectionLabel">Status</text>
                    <view className="ChipRow">
                        {['all', 'ongoing', 'completed', 'hiatus'].map(s => (
                            <view 
                                key={s} 
                                className={filters.status === s ? "Chip Chip-active" : "Chip"}
                                bindtap={() => setFilters(prev => ({...prev, status: s as any}))}
                            >
                                <text className={filters.status === s ? "ChipText ChipText-active" : "ChipText"}>
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                </text>
                            </view>
                        ))}
                    </view>

                    <text className="SectionLabel">Genres</text>
                    <view className="GenreGrid">
                        {GENRES.map(g => (
                            <view 
                                key={g}
                                className={filters.genres.includes(g) ? "GenreChip GenreChip-active" : "GenreChip"}
                                bindtap={() => toggleGenre(g)}
                            >
                                <text className={filters.genres.includes(g) ? "GenreChipText GenreChipText-active" : "GenreChipText"}>
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
