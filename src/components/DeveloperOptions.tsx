import { useState } from '@lynx-js/react';
import { DebugLogService } from '../services/debugLog';
import { StorageService } from '../services/storage';
import { SettingsStore } from '../services/settings';
import { UpdateService, APP_VERSION } from '../services/update';
import './Settings.css';

export function DeveloperOptions() {
  const deviceId = StorageService.getDeviceId();
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [debugReport, setDebugReport] = useState('');
  const [copyStatus, setCopyStatus] = useState('');


  const handleOpenDebugConsole = async () => {
    // Gather context for the report
    const settings = SettingsStore.get();
    const deviceId = StorageService.getDeviceId();
    
    // Fetch all known native storage keys
    const storageValues: Record<string, string | null> = {};
    const keys = [
      'batoto:favorites',
      'batoto:history',
      'batoto:settings',
      'batoto:filters',
      'batoto:device_id',
      'batoto:reader_position',
    ];
    
    for (const key of keys) {
      storageValues[key] = await StorageService.getNativeItemSync(key);
    }

    const report = DebugLogService.getDebugReport({
      settings,
      deviceId,
      version: APP_VERSION,
      storageValues,
      supabaseStatus: {
        lastSync: 'See console logs',
        note: 'Supabase sync runs in background via SyncEngine'
      }
    });

    setDebugReport(report);
    setShowDebugConsole(true);
    setCopyStatus('');
  };

  const handleSendReport = async () => {
    try {
      const nativeUtils =
        typeof NativeModules !== 'undefined'
          ? NativeModules.NativeUtilsModule
          : null;

      if (nativeUtils && nativeUtils.shareText) {
        // Use shareText to send to email
        nativeUtils.shareText(debugReport, 'SMUTHUB Debug Report');
        setCopyStatus('✅ Share sheet opened!');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(debugReport);
        setCopyStatus('✅ Copied to clipboard (Fallback)!');
      } else {
        setCopyStatus('⚠️ Sharing not available');
      }
    } catch (e) {
      console.error('[DeveloperOptions] Send failed:', e);
      setCopyStatus('❌ Send failed');
    }

    // Clear status after 3s
    setTimeout(() => setCopyStatus(''), 3000);
  };

  const handleForceUpdateCheck = async () => {
    setCopyStatus('🔍 Checking for updates...');
    try {
      const update = await UpdateService.checkUpdate();
      if (update) {
        setCopyStatus(`🚀 Update v${update.version} found! Check Home page.`);
      } else {
        setCopyStatus('✅ App is up to date.');
      }
      // Refresh report to show new logs
      const report = DebugLogService.getDebugReport({
        settings: SettingsStore.get(),
        deviceId: StorageService.getDeviceId(),
        version: APP_VERSION,
        storageValues: {
          skippedVersion: StorageService.getSkippedVersion() || 'None',
        },
      });
      setDebugReport(report);
    } catch (e: any) {
      setCopyStatus(`❌ Check failed: ${e.message}`);
    }
  };

  const handleRefreshReport = async () => {
    const settings = SettingsStore.get();
    const deviceId = StorageService.getDeviceId();
    const storageValues: Record<string, string | null> = {};
    const keys = ['batoto:favorites', 'batoto:history', 'batoto:settings', 'batoto:filters', 'batoto:device_id', 'batoto:reader_position'];
    for (const key of keys) {
      storageValues[key] = await StorageService.getNativeItemSync(key);
    }

    const report = DebugLogService.getDebugReport({
      settings,
      deviceId,
      version: APP_VERSION,
      storageValues
    });
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
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowDebugConsole(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => {}}>
            <view className="DebugConsole-header">
              <text className="DebugConsole-title">🐛 Debug Console</text>
              <view className="DebugConsole-actions">
                <view
                  className="DebugConsole-button"
                  bindtap={handleRefreshReport}
                >
                  <text className="DebugConsole-button-text">🔄</text>
                </view>
                <view
                  className="DebugConsole-button"
                  bindtap={handleForceUpdateCheck}
                >
                  <text className="DebugConsole-button-text">🆙 Check Update</text>
                </view>
                <view
                  className="DebugConsole-button primary"
                  bindtap={handleSendReport}
                >
                  <text className="DebugConsole-button-text">📧 Send Logs</text>
                </view>
                <view
                  className="DebugConsole-button"
                  bindtap={() => setShowDebugConsole(false)}
                >
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
              {debugReport.split('\n').map((line, i) => {
                let color = '#ccc'; // Default text color
                if (line.startsWith('=')) color = '#666';
                else if (line.startsWith('---')) color = '#00e676';
                else if (line.includes('[ERROR]')) color = '#ff5252';
                else if (line.includes('[WARN]')) color = '#ffab40';
                else if (line.includes('[INFO]')) color = '#40c4ff';
                else if (line.includes('[DEBUG]')) color = '#b0bec5';
                else if (line.startsWith('[UpdateService]')) color = '#e040fb'; // Special color for update service

                return (
                  <text
                    key={i}
                    className="DebugConsole-line"
                    style={{ color, fontSize: '10px', fontFamily: 'monospace' }}
                  >
                    {line}
                  </text>
                );
              })}
            </scroll-view>
          </view>
        </view>
      )}
    </>
  );
}
