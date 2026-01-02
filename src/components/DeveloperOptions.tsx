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
  const [debugOutlines, setDebugOutlines] = useState(SettingsStore.getDebugOutlines());
  const [mockUpdates, setMockUpdates] = useState(SettingsStore.get().mockUpdates || false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');

  const handleSubmitTicket = () => {
    if (!ticketSubject || !ticketBody) {
      setCopyStatus('❌ Fill all fields');
      setTimeout(() => setCopyStatus(''), 2000);
      return;
    }

    const email = 'Yumlabs.team@gmail.com';
    const subject = encodeURIComponent(`[Supa Support] ${ticketSubject}`);
    const body = encodeURIComponent(`Description:\n${ticketBody}\n\n---\nDevice ID: ${deviceId}\nVersion: ${BUNDLE_VERSION}`);
    
    // Construct mailto link
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
    
    // Check for Lynx runtime vs Web
    const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime && runtime.openURL) {
      runtime.openURL(mailtoUrl);
    } else {
      console.log('[DeveloperOptions] Opening mailto:', mailtoUrl);
      // Fallback for web preview
      if (typeof window !== 'undefined') {
        window.open(mailtoUrl, '_blank');
      }
    }
    
    setShowTicketModal(false);
    setTicketSubject('');
    setTicketBody('');
  };

  const handleToggleDebugOutlines = () => {
    const newVal = !debugOutlines;
    setDebugOutlines(newVal);
    SettingsStore.setDebugOutlines(newVal);
  };
  
  const handleToggleMockUpdates = () => {
    const newVal = !mockUpdates;
    setMockUpdates(newVal);
    SettingsStore.setMockUpdates(newVal);
  };


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
      const settings = SettingsStore.get();

      // Fetch storage for context
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

      const structuredReport = DebugLogService.getStructuredReport({
        settings,
        deviceId,
        version: BUNDLE_VERSION,
        storageValues,
        supabaseStatus: {
           status: 'Captured via DeveloperOptions'
        }
      });

      const success = await SupabaseService.upsert('debug_logs', {
        device_id: deviceId,
        // Legacy support (optional, can be removed)
        report: debugReport, 
        // New Structured Data
        app_version: structuredReport.app_version,
        environment_info: structuredReport.environment_info,
        settings: structuredReport.settings,
        supabase_status: structuredReport.supabase_status,
        storage_state: structuredReport.storage_state,
        console_logs: structuredReport.console_logs,
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


        <view className="Settings-card">
          {/* Persona Override - Icon + Input Row */}
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🤖</text>
            <view className="Settings-item-text">
              <input
                className="Settings-input-inline"
                // @ts-ignore
                value={deviceIdOverrideInput}
                bindinput={(e: any) => setDeviceIdOverrideInput(e.detail.value)}
                placeholder="Device ID / UUID"
                placeholder-style="color: var(--text-secondary); opacity: 0.5;"
              />
              <text className="Settings-item-description">
                Override user persona for testing
              </text>
            </view>
          </view>

          {/* Action Buttons Row */}
          <view className="Settings-button-row">
            <view
              className="Settings-button danger"
              bindtap={handleClearDeviceOverride}
            >
              <text className="Settings-button-text">CLEAR</text>
            </view>
            <view
              className={deviceIdOverrideInput ? 'Settings-button primary' : 'Settings-button primary disabled'}
              bindtap={handleSetDeviceOverride}
            >
              <text className="Settings-button-text">APPLY</text>
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
          <view
            className={debugOutlines ? 'Settings-toggle active' : 'Settings-toggle'}
            bindtap={handleToggleDebugOutlines}
          >
            <view className="Settings-toggle-knob" />
          </view>
        </view>

        <view className="Settings-item">
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🎭</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Mock Updates</text>
              <text className="Settings-item-description">
                Force "NEW" badge on all history
              </text>
            </view>
          </view>
          <view
            className={mockUpdates ? 'Settings-toggle active' : 'Settings-toggle'}
            bindtap={handleToggleMockUpdates}
          >
            <view className="Settings-toggle-knob" />
          </view>
        </view>

        <view className="Settings-item" bindtap={() => setShowTicketModal(true)}>
          <view className="Settings-item-left">
            <text className="Settings-item-icon">🎫</text>
            <view className="Settings-item-text">
              <text className="Settings-item-label">Submit Ticket</text>
              <text className="Settings-item-description">
                Report a bug or feature request
              </text>
            </view>
          </view>
          <text className="Settings-item-chevron">›</text>
        </view>

      </view>

      {/* Ticket Modal */}
      {showTicketModal && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowTicketModal(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }} style={{ padding: '20px' }}>
            <view className="DebugConsole-header">
              <text className="DebugConsole-title">🎫 Submit Ticket</text>
              <view
                className="DebugConsole-button"
                bindtap={() => setShowTicketModal(false)}
              >
                <text className="DebugConsole-button-text">✕</text>
              </view>
            </view>
            
              <view className="Settings-card" style={{ marginTop: '20px' }}>
              <text className="Settings-input-label">Subject</text>
              <input
                className="Settings-input"
                // @ts-ignore
                value={ticketSubject}
                bindinput={(e: any) => setTicketSubject(e.detail.value)}
                placeholder="Brief summary..."
                placeholder-style="color: #666666;"
              />
              
              <text className="Settings-input-label" style={{ marginTop: '16px' }}>Description</text>
              <textarea
                className="Settings-input"
                style={{ height: '120px', paddingTop: '10px' }}
                // @ts-ignore
                value={ticketBody}
                bindinput={(e: any) => setTicketBody(e.detail.value)}
                placeholder="Describe the issue or request..."
                placeholder-style="color: #666666;"
              />

              <view
                className="Settings-button primary"
                style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}
                bindtap={handleSubmitTicket}
              >
                <text className="Settings-button-text">Submit via Email</text>
              </view>
            </view>
          </view>
        </view>
      )}

      {/* Debug Console Modal */}
      {showDebugConsole && (
        <view
          className="DebugConsole-overlay"
          bindtap={() => setShowDebugConsole(false)}
        >
          <view className="DebugConsole-modal" catchtap={() => { }}>
            <view className="DebugConsole-header">
              <text className="DebugConsole-title">🐛 Debug Console</text>
              <view
                className="DebugConsole-button"
                bindtap={() => setShowDebugConsole(false)}
              >
                <text className="DebugConsole-button-text">✕</text>
              </view>
            </view>
            <view className="DebugConsole-toolbar">
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
                <text className="DebugConsole-button-text">🆙</text>
              </view>
              <view
                className="DebugConsole-button primary"
                bindtap={handleSaveToDb}
              >
                <text className="DebugConsole-button-text">💾 Save</text>
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
