import { useEffect, useState } from '@lynx-js/react';
import { type ReadingMode, SettingsStore } from '../services/settings';
import { BUNDLE_VERSION } from '../services/update';
import { StorageService } from '../services/storage';
import { DeveloperOptions } from './DeveloperOptions';
import './Settings.css';

interface Props {
  onBack?: () => void;
  onNavigate?: (view: 'favorites' | 'history') => void;
}

export function Settings({ onBack, onNavigate }: Props) {
  const [readingMode, setReadingMode] = useState<ReadingMode>(
    SettingsStore.getReadingMode(),
  );
  const [darkMode, setDarkMode] = useState(SettingsStore.getDarkMode());
  const [devMode, setDevMode] = useState(SettingsStore.getDevMode());
  const [remoteMode, setRemoteMode] = useState(SettingsStore.getRemoteMode());
  const [scrollSpeed, setScrollSpeed] = useState(SettingsStore.getScrollSpeed());
  const [historyCount, setHistoryCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState<
    'history' | 'all' | null
  >(null);

  // Developer mode tap counter
  const [aboutTaps, setAboutTaps] = useState(0);

  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      setReadingMode(SettingsStore.getReadingMode());
      setDarkMode(SettingsStore.getDarkMode());
      setDevMode(SettingsStore.getDevMode());
      setRemoteMode(SettingsStore.getRemoteMode());
      setScrollSpeed(SettingsStore.getScrollSpeed());
    });

    // Load counts
    StorageService.getHistory().then((h) => setHistoryCount(h.length));
    StorageService.getFavorites().then((f) => setFavoritesCount(f.length));

    return unsubscribe;
  }, []);

  // Version info
  const [nativeVersion, setNativeVersion] = useState<string>('Loading...');

  useEffect(() => {
    // Fetch native version from module
    try {
      if (typeof NativeModules !== 'undefined' && NativeModules.NativeUpdaterModule) {
        const v = NativeModules.NativeUpdaterModule.getNativeVersion();
        setNativeVersion(v);
      } else {
        setNativeVersion('N/A (Web)');
      }
    } catch (e) {
      setNativeVersion('Error');
    }
  }, []);

  const handleReadingModeToggle = () => {
    const newMode: ReadingMode =
      readingMode === 'vertical' ? 'horizontal' : 'vertical';
    SettingsStore.setReadingMode(newMode);
  };

  const handleDarkModeToggle = () => {
    SettingsStore.setDarkMode(!darkMode);
  };

  const handleRemoteModeToggle = () => {
    SettingsStore.setRemoteMode(!remoteMode);
  };

  const handleScrollSpeedChange = (speed: number) => {
    SettingsStore.setScrollSpeed(speed);
  };

  const handleAboutTap = () => {
    const newTaps = aboutTaps + 1;
    if (newTaps >= 5) {
      const newState = !devMode;
      SettingsStore.setDevMode(newState);
      setAboutTaps(0);
      console.log(
        `[Settings] Developer mode ${newState ? 'activated' : 'deactivated'}!`,
      );
    } else {
      setAboutTaps(newTaps);
    }
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
              <text className="Settings-item-icon">
                {readingMode === 'vertical' ? '📜' : '📖'}
              </text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Reading Mode</text>
                <text className="Settings-item-description">
                  {readingMode === 'vertical'
                    ? 'Webtoon (Vertical Scroll)'
                    : 'Manga (Horizontal Swipe)'}
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>

          <view className="Settings-item" bindtap={handleRemoteModeToggle}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">🎮</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Remote Mode</text>
                <text className="Settings-item-description">
                  Tap zones for page turners
                </text>
              </view>
            </view>
            <view
              className={
                remoteMode ? 'Settings-toggle active' : 'Settings-toggle'
              }
            >
              <view className="Settings-toggle-knob" />
            </view>
          </view>

          <view className="Settings-item">
            <view className="Settings-item-left">
              <text className="Settings-item-icon">⚡</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Scroll Speed</text>
                <text className="Settings-item-description">
                  {scrollSpeed <= 0.1 ? 'Slow' : scrollSpeed <= 0.2 ? 'Normal' : scrollSpeed <= 0.3 ? 'Fast' : 'Very Fast'} ({Math.round(scrollSpeed * 100)}%)
                </text>
              </view>
            </view>
            <view className="Settings-speed-buttons">
              <view 
                className={scrollSpeed === 0.1 ? 'Settings-speed-btn active' : 'Settings-speed-btn'}
                bindtap={() => handleScrollSpeedChange(0.1)}
              >
                <text>S</text>
              </view>
              <view 
                className={scrollSpeed === 0.15 ? 'Settings-speed-btn active' : 'Settings-speed-btn'}
                bindtap={() => handleScrollSpeedChange(0.15)}
              >
                <text>N</text>
              </view>
              <view 
                className={scrollSpeed === 0.25 ? 'Settings-speed-btn active' : 'Settings-speed-btn'}
                bindtap={() => handleScrollSpeedChange(0.25)}
              >
                <text>F</text>
              </view>
              <view 
                className={scrollSpeed === 0.4 ? 'Settings-speed-btn active' : 'Settings-speed-btn'}
                bindtap={() => handleScrollSpeedChange(0.4)}
              >
                <text>VF</text>
              </view>
            </view>
          </view>
        </view>

        {/* Appearance Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">APPEARANCE</text>

          <view className="Settings-item" bindtap={handleDarkModeToggle}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">
                {darkMode ? '🌙' : '☀️'}
              </text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Dark Mode</text>
                <text className="Settings-item-description">
                  {darkMode ? 'Enabled' : 'Disabled'}
                </text>
              </view>
            </view>
            <view
              className={
                darkMode ? 'Settings-toggle active' : 'Settings-toggle'
              }
            >
              <view className="Settings-toggle-knob" />
            </view>
          </view>
        </view>

        {/* Library Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">LIBRARY</text>

          <view
            className="Settings-item"
            bindtap={() => onNavigate?.('favorites')}
          >
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

          <view
            className="Settings-item"
            bindtap={() => onNavigate?.('history')}
          >
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

          <view
            className="Settings-item"
            bindtap={() => setShowClearConfirm('history')}
          >
            <view className="Settings-item-left">
              <text className="Settings-item-icon">🗑️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Clear History</text>
                <text className="Settings-item-description">
                  Remove all reading history
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>

          <view
            className="Settings-item danger"
            bindtap={() => setShowClearConfirm('all')}
          >
            <view className="Settings-item-left">
              <text className="Settings-item-icon">⚠️</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Clear All Data</text>
                <text className="Settings-item-description">
                  Remove favorites, history, and settings
                </text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        {/* About Section */}
        <view className="Settings-section">
          <text className="Settings-section-title">ABOUT</text>

          <view className="Settings-item" bindtap={handleAboutTap}>
            <view className="Settings-item-left">
              <text className="Settings-item-icon">💜</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">SMUTHUB</text>
                <text className="Settings-item-description">APK: v{nativeVersion}</text>
                <text className="Settings-item-description">JS: v{BUNDLE_VERSION}</text>
                <text className="Settings-item-description">🖤 Daddy..</text>
              </view>
            </view>
          </view>
          {/* Developer Section */}
          {devMode && <DeveloperOptions />}
        </view>
      </scroll-view>

      {/* Confirmation Dialog */}
      {showClearConfirm && (
        <view
          className="ConfirmOverlay"
          bindtap={() => setShowClearConfirm(null)}
        >
          <view className="ConfirmDialog" catchtap={() => {}}>
            <text className="ConfirmTitle">
              {showClearConfirm === 'history'
                ? 'Clear History?'
                : 'Clear All Data?'}
            </text>
            <text className="ConfirmMessage">
              {showClearConfirm === 'history'
                ? 'This will remove all your reading history. This cannot be undone.'
                : 'This will remove all favorites, history, and settings. This cannot be undone.'}
            </text>
            <view className="ConfirmActions">
              <view
                className="ConfirmButton cancel"
                bindtap={() => setShowClearConfirm(null)}
              >
                <text className="ConfirmButtonText">Cancel</text>
              </view>
              <view
                className="ConfirmButton danger"
                bindtap={
                  showClearConfirm === 'history'
                    ? handleClearHistory
                    : handleClearAll
                }
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
