import { StorageService } from '../services/storage';
import './Settings.css';

export function DeveloperOptions() {
  const deviceId = StorageService.getDeviceId();

  return (
    <view className="Settings-section">
      <text className="Settings-section-title">DEVELOPER</text>
      
      <view className="Settings-item">
        <view className="Settings-item-left">
          <text className="Settings-item-icon">🆔</text>
          <view className="Settings-item-text">
            <text className="Settings-item-label">Stable Device ID</text>
            <text className="Settings-item-description select-all">{deviceId}</text>
          </view>
        </view>
      </view>

      <view className="Settings-item">
        <view className="Settings-item-left">
          <text className="Settings-item-icon">🛠️</text>
          <view className="Settings-item-text">
            <text className="Settings-item-label">Environment</text>
            <text className="Settings-item-description">Lynx Runtime</text>
          </view>
        </view>
      </view>
    </view>
  );
}
