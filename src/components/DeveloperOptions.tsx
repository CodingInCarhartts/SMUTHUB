import { useState } from '@lynx-js/react';
import { StorageService } from '../services/storage';
import { DebugLogService } from '../services/debugLog';
import './Settings.css';

export function DeveloperOptions() {
  const deviceId = StorageService.getDeviceId();
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [debugReport, setDebugReport] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const handleOpenDebugConsole = () => {
    // Generate fresh report
    const report = DebugLogService.getDebugReport();
    setDebugReport(report);
    setShowDebugConsole(true);
    setCopyStatus('');
  };

  const handleCopyReport = async () => {
    try {
      // For Lynx runtime, try multiple copy methods
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(debugReport);
        setCopyStatus('✅ Copied to clipboard!');
      } else {
        // Fallback: show "select all" instruction
        setCopyStatus('⚠️ Manual copy needed - text is selected');
      }
    } catch (e) {
      console.error('[DeveloperOptions] Copy failed:', e);
      setCopyStatus('❌ Copy failed');
    }
    
    // Clear status after 3s
    setTimeout(() => setCopyStatus(''), 3000);
  };

  const handleRefreshReport = () => {
    const report = DebugLogService.getDebugReport();
    setDebugReport(report);
    setCopyStatus('🔄 Refreshed');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <>
      <view className="Settings-section">
        <text className="Settings-section-title">DEVELOPER</text>
        
        <view className="Settings-item">
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🆔</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Stable Device ID</text>
              <text className="Settings-item-description">{deviceId}</text>
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

        <view className="Settings-item" bindtap={handleOpenDebugConsole}>
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🐛</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Debug Console</text>
              <text className="Settings-item-description">
                View logs & system info ({DebugLogService.count()} entries)
              </text>
            </view>
          </view>
          <text className="Settings-item-chevron">›</text>
        </view>
      </view>

      {/* Debug Console Modal */}
      {showDebugConsole && (
        <view className="DebugConsole-overlay" bindtap={() => setShowDebugConsole(false)}>
          <view className="DebugConsole-modal" catchtap={() => {}}>
            <view className="DebugConsole-header">
              <text className="DebugConsole-title">🐛 Debug Console</text>
              <view className="DebugConsole-actions">
                <view className="DebugConsole-button" bindtap={handleRefreshReport}>
                  <text className="DebugConsole-button-text">🔄</text>
                </view>
                <view className="DebugConsole-button primary" bindtap={handleCopyReport}>
                  <text className="DebugConsole-button-text">📋 Copy All</text>
                </view>
                <view className="DebugConsole-button" bindtap={() => setShowDebugConsole(false)}>
                  <text className="DebugConsole-button-text">✕</text>
                </view>
              </view>
            </view>
            
            {copyStatus && (
              <view className="DebugConsole-status">
                <text className="DebugConsole-status-text">{copyStatus}</text>
              </view>
            )}
            
            <scroll-view className="DebugConsole-content" scroll-y>
              <text className="DebugConsole-text">{debugReport}</text>
            </scroll-view>
          </view>
        </view>
      )}
    </>
  );
}
