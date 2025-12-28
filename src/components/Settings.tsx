import './Settings.css';

interface Props {
  onBack?: () => void;
}

export function Settings({ onBack }: Props) {
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
          <text className="Settings-section-title">General</text>
          
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
          <text className="Settings-section-title">Reading</text>
          
          <view className="Settings-item">
            <view className="Settings-item-left">
              <text className="Settings-item-icon">📖</text>
              <view className="Settings-item-text">
                <text className="Settings-item-label">Reading Mode</text>
                <text className="Settings-item-description">Webtoon (vertical scroll)</text>
              </view>
            </view>
            <text className="Settings-item-chevron">›</text>
          </view>
        </view>

        <view className="Settings-section">
          <text className="Settings-section-title">About</text>
          
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
