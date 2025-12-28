import { useState, useEffect } from '@lynx-js/react';
import { SettingsStore, type ReadingMode } from '../services/settings';
import './Settings.css';

interface Props {
  onBack?: () => void;
}

export function Settings({ onBack }: Props) {
  const [readingMode, setReadingMode] = useState<ReadingMode>(SettingsStore.getReadingMode());

  useEffect(() => {
    // Subscribe to settings changes
    const unsubscribe = SettingsStore.subscribe(() => {
      setReadingMode(SettingsStore.getReadingMode());
    });
    return unsubscribe;
  }, []);

  const handleReadingModeToggle = () => {
    const newMode: ReadingMode = readingMode === 'vertical' ? 'horizontal' : 'vertical';
    SettingsStore.setReadingMode(newMode);
  };

  const handleClearCache = () => {
    console.log('[Settings] Clear cache requested');
    // Future: Implement cache clearing
  };

  return (
    <view className="Settings">
      <view className="Settings-header">
        <text className="Settings-title">Settings</text>
      </view>
      
      <scroll-view className="Settings-content" scroll-y>
        <view className="Settings-section">
          <text className="Settings-section-title">READING</text>
          
          <view className="Settings-item" bindtap={handleReadingModeToggle}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">{readingMode === 'vertical' ? '📜' : '📖'}</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Reading Mode</text>
                <text className="Settings-item-description">
                  {readingMode === 'vertical' ? 'Webtoon (Vertical Scroll)' : 'Manga (Horizontal Swipe)'}
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        <view className="Settings-section">
          <text className="Settings-section-title">DATA</text>
          
          <view className="Settings-item" bindtap={handleClearCache}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">🗑️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Clear Cache</text>
                <text className="Settings-item-description">Remove cached images and data</text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        <view className="Settings-section">
          <text className="Settings-section-title">ABOUT</text>
          
          <view className="Settings-item">
            <view className="Settings-item-left">
              <text className="Settings-item-icon">ℹ️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Version</text>
                <text className="Settings-item-description">1.0.0</text>
              </view>
            </view>
          </view>

          <view className="Settings-item">
            <view className="Settings-item-left">
              <text className="Settings-item-icon">💜</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Batoto UwU</text>
                <text className="Settings-item-description">A Lynx-powered manga reader</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  );
}
