import { useEffect, useState } from '@lynx-js/react';
import { NetworkLogService, type NetworkRequest } from '../services/networkLog';
import './NetworkInspector.css';

export function NetworkInspector() {
  const [logs, setLogs] = useState<NetworkRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLogs(NetworkLogService.getLogs());
    const unsubscribe = NetworkLogService.subscribe(() => {
      setLogs(NetworkLogService.getLogs());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleClear = () => {
    NetworkLogService.clear();
    setSelectedId(null);
  };

  const selectedLog = logs.find((l) => l.id === selectedId);

  return (
    <view className="NetworkInspector">
      <view className="NetworkInspector-header">
        <text className="NetworkInspector-title">Network Traffic</text>
        <view className="NetworkInspector-actions">
          <view className="NetworkInspector-btn" bindtap={handleClear}>
            <text className="NetworkInspector-btn-text">Clear</text>
          </view>
        </view>
      </view>

      <view className="NetworkInspector-split">
        {/* Left: List */}
        <scroll-view className="NetworkInspector-list" scroll-y>
          {logs.map((log) => (
            <view
              key={log.id}
              className={`NetworkInspector-item ${selectedId === log.id ? 'selected' : ''}`}
              bindtap={() => setSelectedId(log.id)}
            >
              <view className="NetworkInspector-item-row">
                <text className={`NetworkInspector-method ${log.method}`}>
                  {log.method}
                </text>
                <text
                  className="NetworkInspector-status"
                  style={{
                    color:
                      log.status && log.status >= 400 ? '#ff5252' : '#4caf50',
                  }}
                >
                  {log.status || '...'}
                </text>
                <text className="NetworkInspector-duration">
                  {log.duration ? `${log.duration}ms` : ''}
                </text>
              </view>
              <text
                className="NetworkInspector-url"
                style={{
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {log.url}
              </text>
            </view>
          ))}
          {logs.length === 0 && (
            <text className="NetworkInspector-empty">No requests recorded</text>
          )}
        </scroll-view>

        {/* Right: Details (Inline for simple expansion or conditional) */}
        {/* For small screens, maybe just a modal? using split for now assuming dev mode often on tablet/desktop simulator or just scrollable */}
      </view>

      {selectedLog && (
        <view
          className="NetworkInspector-details-overlay"
          bindtap={() => setSelectedId(null)}
        >
          <scroll-view
            className="NetworkInspector-details"
            scroll-y
            catchtap={() => {}}
          >
            <view className="NetworkInspector-details-header">
              <text className="NetworkInspector-details-title">
                Request Details
              </text>
              <text
                className="NetworkInspector-close"
                bindtap={() => setSelectedId(null)}
              >
                ✕
              </text>
            </view>

            <text className="NetworkInspector-section">General</text>
            <text className="NetworkInspector-kv">URL: {selectedLog.url}</text>
            <text className="NetworkInspector-kv">
              Method: {selectedLog.method}
            </text>
            <text className="NetworkInspector-kv">
              Status: {selectedLog.status} {selectedLog.statusText}
            </text>
            <text className="NetworkInspector-kv">
              Duration: {selectedLog.duration}ms
            </text>

            <text className="NetworkInspector-section">Request Headers</text>
            {selectedLog.requestHeaders &&
              Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                <text key={k} className="NetworkInspector-kv">
                  {k}: {v}
                </text>
              ))}

            <text className="NetworkInspector-section">Response Headers</text>
            {selectedLog.responseHeaders &&
              Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                <text key={k} className="NetworkInspector-kv">
                  {k}: {v}
                </text>
              ))}

            {selectedLog.error && (
              <>
                <text className="NetworkInspector-section error">Error</text>
                <text className="NetworkInspector-kv error">
                  {selectedLog.error}
                </text>
              </>
            )}
          </scroll-view>
        </view>
      )}
    </view>
  );
}
