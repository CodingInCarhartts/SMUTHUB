import { useState } from '@lynx-js/react';
import { DebugLogService } from '../services/debugLog';
import { StorageService } from '../services/storage';
import './Settings.css';

export function DeveloperOptions() {
  const deviceId = StorageService.getDeviceId();
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [debugReport, setDebugReport] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [restoreId, setRestoreId] = useState('');

  const handleOpenDebugConsole = () => {
    // Generate fresh report
    const report = DebugLogService.getDebugReport();
    setDebugReport(report);
    setShowDebugConsole(true);
    setCopyStatus('');
  };

  const handleCopyReport = async () => {
    try {
      const nativeUtils =
        typeof NativeModules !== 'undefined'
          ? NativeModules.NativeUtilsModule
          : null;

      if (nativeUtils && nativeUtils.copyToClipboard) {
        nativeUtils.copyToClipboard(debugReport);
        setCopyStatus('✅ Copied to clipboard (Native)!');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
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

        <view className="Settings-item">
          <view className="Settings-item-text" style={{ padding: '12px 0', width: '100%' }}>
            <text className="Settings-item-label">Restore Session</text>
            <view className="RestoreRow">
              <input
                className="RestoreInput"
                placeholder="Enter previous Device ID"
                // @ts-expect-error - Lynx input supports value for programmatic updates
                value={restoreId}
                bindinput={(e) => setRestoreId(e.detail.value)}
              />
              <view
                className="RestoreButton secondary"
                bindtap={async () => {
                   try {
                     const nativeModule = typeof NativeModules !== 'undefined' ? NativeModules.NativeUtilsModule : null;
                     // @ts-expect-error - Custom native module method
                     if (nativeModule && nativeModule.getClipboardData) {
                       // @ts-expect-error - Custom native module method
                       nativeModule.getClipboardData((data: string) => {
                         if (data) setRestoreId(data);
                       });
                     } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                       const text = await navigator.clipboard.readText();
                       if (text) setRestoreId(text);
                     }
                   } catch (e) {
                     // ignore
                   }
                }}
              >
                <text className="RestoreButtonText" style={{ color: 'var(--text-primary)', fontSize: '20px' }}>📋</text>
              </view>
              <view
                className="RestoreButton"
                bindtap={() => {
                  if (!restoreId || restoreId.length < 5) return;
                  
                  StorageService.setDeviceId(restoreId);
                  setCopyStatus('✅ Restoring...');
                  
                  setTimeout(() => {
                    const runtime =
                      typeof lynx !== 'undefined'
                        ? lynx
                        : (globalThis as any).lynx;
                    if (runtime && runtime.reload) {
                      runtime.reload();
                    }
                  }, 500);
                }}
              >
                <text className="RestoreButtonText">Restore</text>
              </view>
            </view>
            <text
              className="Settings-item-description"
              style={{ marginTop: '8px' }}
            >
              Paste your old ID to recover favorites and history.
            </text>
          </view>
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
                  className="DebugConsole-button primary"
                  bindtap={handleCopyReport}
                >
                  <text className="DebugConsole-button-text">📋 Copy All</text>
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
              <text className="DebugConsole-text">{debugReport}</text>
            </scroll-view>
          </view>
        </view>
      )}
    </>
  );
}
