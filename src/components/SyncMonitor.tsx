import { useEffect, useState } from '@lynx-js/react';
import { StorageService } from '../services/storage';
import { type Operation, SyncEngine } from '../services/sync';
import './SyncMonitor.css';

export function SyncMonitor() {
  const [queue, setQueue] = useState<Operation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  const refresh = async () => {
    const q = await SyncEngine.getQueue();
    setQueue(q);
    setIsSyncing(SyncEngine.isSyncing());
  };

  useEffect(() => {
    setDeviceId(StorageService.getDeviceId());
    refresh();

    // Subscribe to SyncEngine updates
    return SyncEngine.subscribe(() => {
      refresh();
    });
  }, []);

  const handleProcess = () => {
    SyncEngine.processQueue();
  };

  const handleClearQueue = async () => {
    // Only for dev debugging - might be dangerous
    await SyncEngine.saveQueue([]);
    refresh();
  };

  return (
    <view className="SyncMonitor">
      <view className="SyncMonitor-header">
        <view className="SyncMonitor-status-row">
          <text className="SyncMonitor-title">Queue: {queue.length}</text>
          <view
            className={`SyncMonitor-badge ${isSyncing ? 'syncing' : 'idle'}`}
          >
            <text className="SyncMonitor-badge-text">
              {isSyncing ? 'SYNCING...' : 'IDLE'}
            </text>
          </view>
        </view>

        <view className="SyncMonitor-actions">
          <view className="SyncMonitor-btn danger" bindtap={handleClearQueue}>
            <text className="SyncMonitor-btn-text">Clear</text>
          </view>
          <view className="SyncMonitor-btn primary" bindtap={handleProcess}>
            <text className="SyncMonitor-btn-text">Process Now</text>
          </view>
        </view>
      </view>

      <scroll-view className="SyncMonitor-list" scroll-y>
        {queue.map((op, i) => (
          <view key={i} className="SyncMonitor-item">
            <view className="SyncMonitor-item-header">
              <text className={`SyncMonitor-op-type ${op.type}`}>
                {op.type}
              </text>
              <text className="SyncMonitor-op-table">{op.table}</text>
            </view>
            <text className="SyncMonitor-op-payload">
              {JSON.stringify(op.payload || {}, null, 2)}
            </text>
            <text className="SyncMonitor-op-time">
              {new Date(op.timestamp).toLocaleTimeString()}
            </text>
          </view>
        ))}
        {queue.length === 0 && (
          <text className="SyncMonitor-empty">
            Queue is empty. Local changes synced.
          </text>
        )}
      </scroll-view>

      <view className="SyncMonitor-footer">
        <text className="SyncMonitor-footer-text">Device ID: {deviceId}</text>
      </view>
    </view>
  );
}
