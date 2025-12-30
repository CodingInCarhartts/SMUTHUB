import { useState } from '@lynx-js/react';
import { DebugLogService } from '../services/debugLog';
import { StorageService } from '../services/storage';
import { SettingsStore } from '../services/settings';
import { UpdateService, BUNDLE_VERSION } from '../services/update';
import { NetworkInspector } from './NetworkInspector';
import { SyncMonitor } from './SyncMonitor';
import { StateInspector } from './StateInspector';
import './Settings.css';

export function DeveloperOptions() {
  const deviceId = StorageService.getDeviceId();
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [showNetworkInspector, setShowNetworkInspector] = useState(false);
  const [showSyncMonitor, setShowSyncMonitor] = useState(false);
  const [showStateInspector, setShowStateInspector] = useState(false);
  const [debugReport, setDebugReport] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [deviceIdOverrideInput, setDeviceIdOverrideInput] = useState('');

  const handleSetDeviceOverride = () => {
    if (!deviceIdOverrideInput) {
      setCopyStatus('❌ Enter an ID');
      setTimeout(() => setCopyStatus(''), 2000);
      return;
    }
    StorageService.setDeviceIdOverride(deviceIdOverrideInput);
    setCopyStatus('✅ Device ID Overridden!');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  const handleClearDeviceOverride = () => {
    StorageService.clearDeviceIdOverride();
    setDeviceIdOverrideInput('');
    setCopyStatus('✅ Override Cleared');
    setTimeout(() => setCopyStatus(''), 2000);
  };


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
      version: BUNDLE_VERSION,
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


  const handleSaveToDb = async () => {
    setCopyStatus('⏳ Saving to database...');
    try {
      const { SupabaseService } = await import('../services/supabase');
      const deviceId = StorageService.getDeviceId();

      const success = await SupabaseService.upsert('debug_logs', {
        device_id: deviceId,
        report: debugReport,
        created_at: new Date().toISOString(),
      }, 'device_id');

      if (success) {
        setCopyStatus('✅ Debug log saved to database!');
      } else {
        setCopyStatus('❌ Failed to save to database');
      }
    } catch (e: any) {
      console.error('[DeveloperOptions] Save to DB failed:', e);
      setCopyStatus(`❌ Save failed: ${e?.message || 'Unknown error'}`);
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
        version: BUNDLE_VERSION,
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
      version: BUNDLE_VERSION,
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


        <view className="Settings-item" style={{ height: 'auto', flexDirection: 'column', alignItems: 'stretch', paddingBottom: '12px' }}>
          <view className="Settings-item-left" style={{ marginBottom: '8px' }}>
            <text className="Settings-item-icon">🎭</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Override User Persona</text>
              <text className="Settings-item-description">Simulate a different user</text>
            </view>
          </view>

          <view style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input
              className="Settings-input"
              // @ts-ignore
              value={deviceIdOverrideInput}
              bindinput={(e: any) => setDeviceIdOverrideInput(e.detail.value)}
              placeholder="Device ID / UUID"
              placeholder-style="color: #666;"
              style={{
                flex: 1,
                backgroundColor: '#333',
                color: '#fff',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '14px',
                border: '1px solid #444'
              }}
            />
          </view>

          <view style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <view
              bindtap={handleClearDeviceOverride}
              style={{
                backgroundColor: 'rgba(255, 82, 82, 0.15)',
                borderRadius: '6px',
                padding: '8px 16px',
                border: '1px solid rgba(255, 82, 82, 0.3)'
              }}
            >
              <text style={{ color: '#ff5252', fontWeight: '600', fontSize: '13px' }}>CLEAR</text>
            </view>
            <view
              bindtap={handleSetDeviceOverride}
              style={{
                backgroundColor: '#00e676',
                borderRadius: '6px',
                padding: '8px 24px',
                opacity: deviceIdOverrideInput ? 1 : 0.5
              }}
            >
              <text style={{ color: '#000', fontWeight: '700', fontSize: '13px' }}>APPLY OVERRIDE</text>
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

        <view className="Settings-item" bindtap={() => setShowNetworkInspector(true)}>
          <view className="Settings-item-left">
            <text className="Settings-item-icon">📡</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Network Inspector</text>
              <text className="Settings-item-description">
                Monitor API traffic and headers
              </text>
            </view>
          </view>
          <text className="Settings-item-chevron">›</text>
        </view>

        <view className="Settings-item" bindtap={() => setShowSyncMonitor(true)}>
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🔄</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Sync Monitor</text>
              <text className="Settings-item-description">
                View background sync queue & status
              </text>
            </view>
          </view>
          <text className="Settings-item-chevron">›</text>
        </view>

        <view className="Settings-item" bindtap={() => setShowStateInspector(true)}>
          <view className="Settings-item-left">
            <text className="Settings-item-icon">💾</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">State Inspector</text>
              <text className="Settings-item-description">
                View & clear local storage keys
              </text>
            </view>
          </view>
          <text className="Settings-item-chevron">›</text>
        </view>

        <view className="Settings-item">
          <view className="Settings-item-left">
            <text className="Settings-item-icon">📐</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Layout Debugger</text>
              <text className="Settings-item-description">
                Show element outlines
              </text>
            </view>
          </view>
          {/* @ts-ignore */}
          <switch
            checked={SettingsStore.getDebugOutlines()}
            bindchange={(e: any) => SettingsStore.setDebugOutlines(e.detail.value)}
            color="#00e676"
          />
        </view>


      </view>

      {/* Debug Console Modal */}
      {showDebugConsole && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowDebugConsole(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }}>
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
                  bindtap={handleSaveToDb}
                >
                  <text className="DebugConsole-button-text">💾 Save to DB</text>
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

      {/* Network Inspector Modal */}
      {showNetworkInspector && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowNetworkInspector(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }} style={{ padding: 0, backgroundColor: 'transparent' }}>
            <view className="DebugConsole-header" style={{ marginBottom: 0 }}>
              <text className="DebugConsole-title">📡 Network Inspector</text>
              <view className="DebugConsole-actions">
                <view
                  className="DebugConsole-button"
                  bindtap={() => setShowNetworkInspector(false)}
                >
                  <text className="DebugConsole-button-text">✕</text>
                </view>
              </view>
            </view>
            <NetworkInspector />
          </view>
        </view>
      )}
      {/* Sync Monitor Modal */}
      {showSyncMonitor && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowSyncMonitor(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }} style={{ padding: 0, backgroundColor: 'transparent' }}>
            <view className="DebugConsole-header" style={{ marginBottom: 0 }}>
              <text className="DebugConsole-title">🔄 Sync Monitor</text>
              <view className="DebugConsole-actions">
                <view
                  className="DebugConsole-button"
                  bindtap={() => setShowSyncMonitor(false)}
                >
                  <text className="DebugConsole-button-text">✕</text>
                </view>
              </view>
            </view>
            <SyncMonitor />
          </view>
        </view>
      )}
      {/* State Inspector Modal */}
      {showStateInspector && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowStateInspector(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }} style={{ padding: 0, backgroundColor: 'transparent' }}>
            <view className="DebugConsole-header" style={{ marginBottom: 0 }}>
              <text className="DebugConsole-title">💾 State Inspector</text>
              <view className="DebugConsole-actions">
                <view
                  className="DebugConsole-button"
                  bindtap={() => setShowStateInspector(false)}
                >
                  <text className="DebugConsole-button-text">✕</text>
                </view>
              </view>
            </view>
            <StateInspector />
          </view>
        </view>
      )}
    </>
  );
}
