// Initialize debug log capture FIRST so all logs are captured

import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FavoritesView } from './components/FavoritesView';
import { HistoryView } from './components/HistoryView';
import { MangaCard } from './components/MangaCard';
import { MangaDetailsUi } from './components/MangaDetailsUi';
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
  const [count, setCount] = useState(0);

  return (
    <view className="Main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a' }}>
      <text style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '10px' }}>IMPORT TEST 1.0.191</text>
      <text style={{ fontSize: '14px', color: '#ccc' }}>If this works, imports are SAFE.</text>
      <text style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>If it crashes, one of the imports is the KILLER.</text>
      
      <view 
        style={{ marginTop: '30px', padding: '20px', backgroundColor: '#ee5566', borderRadius: '10px' }}
        bindtap={() => setCount(count + 1)}
      >
        <text style={{ color: 'white', fontWeight: 'bold' }}>Active Counter: {count}</text>
      </view>

      <text style={{ marginTop: '20px', fontSize: '10px', color: '#555' }}>Monitoring logs for publishEvent error...</text>
    </view>
  );
}
