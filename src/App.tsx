// Initialize debug log capture FIRST so all logs are captured

import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FavoritesView } from './components/FavoritesView';
import { HistoryView } from './components/HistoryView';
import { MangaCard } from './components/MangaCard';
// import { MangaDetailsUi } from './components/MangaDetailsUi'; // ISOLATION: Commented out
import { Reader } from './components/Reader';
import { Search } from './components/Search';
import { SearchFiltersModal } from './components/SearchFilters';
import { Settings } from './components/Settings';
import { Sparkles } from './components/Sparkles';
import { UpdateModal } from './components/UpdateModal';
import {
  type Chapter,
  type Manga,
  type MangaDetails,
  type SearchFilters,
} from './services/types';
import { logCapture } from './services/debugLog';
import { SettingsStore } from './services/settings';
import { sourceManager } from './services/sourceManager';
import { normalizeUrl, StorageService } from './services/storage';
import {
  type AppUpdate,
  type NativeAppUpdate,
  UpdateService,
} from './services/update';
import './App.css';

// Helper for debug logging
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);
const logWarn = (...args: any[]) => logCapture('warn', ...args);

type Tab = 'home' | 'search' | 'settings';
type ViewState = 'browse' | 'details' | 'reader';
type SettingsSubview = 'main' | 'favorites' | 'history';

export function App() {
  const [status, setStatus] = useState('Idle');
  const [data, setData] = useState<string>('');

  const runFetch = async () => {
    setStatus('Fetching...');
    try {
      const source = sourceManager.getSource('mangapark');
      if (!source) throw new Error('No source');
      const feed = await source.getHomeFeed();
      setData(`Success! Popular: ${feed.popular.length}, Latest: ${feed.latest.length}`);
      setStatus('Done');
    } catch (e: any) {
      setData('Error: ' + e.message);
      setStatus('Error');
    }
  };

  return (
    <view className="Main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a', padding: '20px' }}>
      <text style={{ fontSize: '20px', color: '#ff4d4f', marginBottom: '20px' }}>DIAGNOSTIC 1.0.195</text>
      
      <text style={{ color: 'white', marginBottom: '20px' }}>Status: {status}</text>
      
      <view 
        bindtap={runFetch}
        style={{ padding: '15px', backgroundColor: '#ee5566', borderRadius: '8px', marginBottom: '20px' }}
      >
        <text style={{ color: 'white', fontWeight: 'bold' }}>TEST NETWORK FETCH</text>
      </view>

      <scroll-view scroll-y style={{ height: '200px', width: '100%', backgroundColor: '#333' }}>
        <text style={{ color: '#ccc', fontSize: '12px' }}>{data || 'No data yet'}</text>
      </scroll-view>

      <text style={{ marginTop: '20px', color: '#666', fontSize: '10px' }}>Sparkles: DISABLED</text>
      <text style={{ color: '#666', fontSize: '10px' }}>BottomNav: DISABLED</text>
      <text style={{ color: '#666', fontSize: '10px' }}>Auto-Fetch: DISABLED</text>
    </view>
  );
}
