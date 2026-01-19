import { useEffect, useState } from '@lynx-js/react';
import { STORAGE_KEYS, StorageService } from '../services/storage';
import './StateInspector.css';

export function StateInspector() {
  const [state, setState] = useState<Record<string, any>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const refresh = () => {
    setState(StorageService.getMemoryState());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleClearKey = async (key: string) => {
    // eslint-disable-next-line no-restricted-globals
    // confirm or just do it? Dev tool implies power user.
    await StorageService.clearKey(key);
    refresh();
    if (selectedKey === key) setSelectedKey(null);
  };

  const handleClearAll = async () => {
    await StorageService.clearAllData();
    refresh();
    setSelectedKey(null);
  };

  const getKeyLabel = (key: string) => {
    const entry = Object.entries(STORAGE_KEYS).find(([_, v]) => v === key);
    return entry ? entry[0] : key.replace('batoto:', '');
  };

  const selectedValue = selectedKey ? state[selectedKey] : null;

  return (
    <view className="StateInspector">
      <view className="StateInspector-header">
        <text className="StateInspector-title">Local Storage</text>
        <view className="StateInspector-actions">
          <view className="StateInspector-btn danger" bindtap={handleClearAll}>
            <text className="StateInspector-btn-text">Reset All Data</text>
          </view>
          <view className="StateInspector-btn primary" bindtap={refresh}>
            <text className="StateInspector-btn-text">Refresh</text>
          </view>
        </view>
      </view>

      <view className="StateInspector-split">
        <scroll-view className="StateInspector-list" scroll-y>
          {Object.keys(STORAGE_KEYS).map((k) => {
            const key = STORAGE_KEYS[k as keyof typeof STORAGE_KEYS];
            const hasValue = state[key] !== undefined;
            const size = hasValue ? JSON.stringify(state[key]).length : 0;

            return (
              <view
                key={key}
                className={`StateInspector-item ${selectedKey === key ? 'selected' : ''}`}
                bindtap={() => setSelectedKey(key)}
              >
                <view className="StateInspector-item-row">
                  <text className="StateInspector-key">{k}</text>
                  {hasValue ? (
                    <text className="StateInspector-size">{size}b</text>
                  ) : (
                    <text className="StateInspector-empty-label">Empty</text>
                  )}
                </view>
                <text className="StateInspector-raw-key">{key}</text>
              </view>
            );
          })}
        </scroll-view>

        {selectedKey && (
          <view
            className="StateInspector-detail-overlay"
            bindtap={() => setSelectedKey(null)}
          >
            <view className="StateInspector-detail-modal" catchtap={() => {}}>
              <view className="StateInspector-detail-header">
                <text className="StateInspector-detail-title">
                  {getKeyLabel(selectedKey)}
                </text>
                <view
                  className="StateInspector-btn danger small"
                  bindtap={() => handleClearKey(selectedKey)}
                >
                  <text className="StateInspector-btn-text">Delete</text>
                </view>
              </view>
              <scroll-view className="StateInspector-detail-content" scroll-y>
                <text className="StateInspector-json">
                  {JSON.stringify(selectedValue, null, 2) || 'null'}
                </text>
              </scroll-view>
            </view>
          </view>
        )}
      </view>
    </view>
  );
}
