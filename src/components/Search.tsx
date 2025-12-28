import { useState, useEffect } from '@lynx-js/react';
import './Search.css';

interface Props {
  onSearch: (query: string) => void;
  onFilterClick?: () => void;
  value?: string;  // Controlled value from parent
}

export function Search({ onSearch, onFilterClick, value = '' }: Props) {
  const [query, setQuery] = useState(value);

  // Sync with parent value when it changes (e.g., on reset)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleSearch = () => {
    console.log(`[Search] Search triggered: "${query}"`);
    onSearch(query);
  };

  return (
    <view className="Search">
      <view className="Search-header">
        <text className="Search-title">Search</text>
      </view>
      <view className="Search-input-container">
        <view className="Search-box">
          <text className="Search-icon">🔍</text>
          <input 
            key={value}
            type="text"
            className="Search-input" 
            placeholder="Search manga..." 
            placeholder-style="color: #8E8E93"
            show-soft-input-on-focus={true}
            bindinput={(e: any) => setQuery(e.detail.value)}
            bindconfirm={handleSearch}
          />
          <view className="Search-action" bindtap={handleSearch}>
            <text className="Search-action-text">Search</text>
          </view>
        </view>
        {onFilterClick && (
            <view className="FilterButton" bindtap={onFilterClick}>
                <text className="FilterIcon">⚙️</text> 
            </view>
        )}
      </view>
    </view>
  );
}
