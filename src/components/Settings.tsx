import { useState, useEffect } from '@lynx-js/react';
import { SettingsStore, type ReadingMode } from '../services/settings';
import { StorageService } from '../services/storage';
import './Settings.css';

interface Props {
  onBack?: () => void;
  onNavigate?: (view: 'favorites' | 'history') => void;
}

export function Settings({ onBack, onNavigate }: Props) {
  const [readingMode, setReadingMode] = useState<ReadingMode>(SettingsStore.getReadingMode());
  const [darkMode, setDarkMode] = useState(SettingsStore.getDarkMode());
  const [historyCount, setHistoryCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState<'history' | 'all' | null>(null);

  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      setReadingMode(SettingsStore.getReadingMode());
      setDarkMode(SettingsStore.getDarkMode());
    });

    // Load counts
    StorageService.getHistory().then(h => setHistoryCount(h.length));
    StorageService.getFavorites().then(f => setFavoritesCount(f.length));

    return unsubscribe;
  }, []);

  const handleReadingModeToggle = () => {
    const newMode: ReadingMode = readingMode === 'vertical' ? 'horizontal' : 'vertical';
    SettingsStore.setReadingMode(newMode);
  };

  const handleDarkModeToggle = () => {
    SettingsStore.setDarkMode(!darkMode);
  };

  const handleClearHistory = async () => {
    await StorageService.clearHistory();
    setHistoryCount(0);
    setShowClearConfirm(null);
  };

  const handleClearAll = async () => {
    await StorageService.clearAllData();
    setHistoryCount(0);
    setFavoritesCount(0);
    setShowClearConfirm(null);
  };

  return (
    <view className="Settings">
      <view className="Settings-header">
        <text className="Settings-title">Settings</text>
      </view>
      
      <scroll-view className="Settings-content" scroll-y>
        {/* Reading Section */}
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

        {/* Appearance Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">APPEARANCE</text>
          
          <view className="Settings-item" bindtap={handleDarkModeToggle}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">{darkMode ? '🌙' : '☀️'}</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Dark Mode</text>
                <text className="Settings-item-description">
                  {darkMode ? 'Enabled' : 'Disabled'}
                </text>
              </view>
            </view>
            <view className={darkMode ? "Settings-toggle active" : "Settings-toggle"}>
              <view className="Settings-toggle-knob" />
            </view>
          </view>
        </view>

        {/* Library Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">LIBRARY</text>
          
          <view className="Settings-item" bindtap={() => onNavigate?.('favorites')}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">❤️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Favorites</text>
                <text className="Settings-item-description">
                  {favoritesCount} manga saved
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>

          <view className="Settings-item" bindtap={() => onNavigate?.('history')}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">📚</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Reading History</text>
                <text className="Settings-item-description">
                  {historyCount} manga viewed
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        {/* Data Management */}
        <view className="Settings-section">
          <text className="Settings-section-title">DATA</text>
          
          <view className="Settings-item" bindtap={() => setShowClearConfirm('history')}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">🗑️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Clear History</text>
                <text className="Settings-item-description">Remove all reading history</text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>

          <view className="Settings-item danger" bindtap={() => setShowClearConfirm('all')}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">⚠️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Clear All Data</text>
                <text className="Settings-item-description">Remove favorites, history, and settings</text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        {/* About Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">ABOUT</text>
          
          <view className="Settings-item">
            <view className="Settings-item-left">
              <text className="Settings-item-icon">💜</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Batoto UwU</text>
                <text className="Settings-item-description">Version 1.0.0</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      {/* Confirmation Dialog */}
      {showClearConfirm && (
        <view className="ConfirmOverlay" bindtap={() => setShowClearConfirm(null)}>
          <view className="ConfirmDialog" catchtap={() => {}}>
            <text className="ConfirmTitle">
              {showClearConfirm === 'history' ? 'Clear History?' : 'Clear All Data?'}
            </text>
            <text className="ConfirmMessage">
              {showClearConfirm === 'history' 
                ? 'This will remove all your reading history. This cannot be undone.'
                : 'This will remove all favorites, history, and settings. This cannot be undone.'}
            </text>
            <view className="ConfirmActions">
              <view className="ConfirmButton cancel" bindtap={() => setShowClearConfirm(null)}>
                <text className="ConfirmButtonText">Cancel</text>
              </view>
              <view 
                className="ConfirmButton danger" 
                bindtap={showClearConfirm === 'history' ? handleClearHistory : handleClearAll}
              >
                <text className="ConfirmButtonText">Clear</text>
              </view>
            </view>
          </view>
        </view>
      )}
    </view>
  );
}
