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
import { logCapture } from './services/debugLog';
import { SettingsStore } from './services/settings';
import { sourceManager } from './services/sourceManager';
import { normalizeUrl, StorageService } from './services/storage';
import type {
  Chapter,
  Manga,
  MangaDetails,
  SearchFilters,
} from './services/types';
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
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<ViewState>('browse');
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [popularMangas, setPopularMangas] = useState<Manga[]>([]);
  const [latestMangas, setLatestMangas] = useState<Manga[]>([]);
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [mangaDetails, setMangaDetails] = useState<MangaDetails | null>(null);
  const [selectedChapterUrl, setSelectedChapterUrl] = useState<string>('');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  // Search & Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<
    SearchFilters | undefined
  >(undefined);

  // Settings subviews
  const [settingsSubview, setSettingsSubview] =
    useState<SettingsSubview>('main');

  // Dark mode
  const [darkMode, setDarkMode] = useState(SettingsStore.getDarkMode());
  // Debug outlines
  const [debugOutlines, setDebugOutlines] = useState(
    SettingsStore.getDebugOutlines(),
  );

  // OTA Update state
  const [pendingUpdate, setPendingUpdate] = useState<AppUpdate | null>(null);

  // Native APK Update state
  const [pendingNativeUpdate, setPendingNativeUpdate] =
    useState<NativeAppUpdate | null>(null);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      const newMode = SettingsStore.getDarkMode();
      const newOutlines = SettingsStore.getDebugOutlines();
      log(
        '[App] Settings update received. Dark:',
        newMode,
        'Outlines:',
        newOutlines,
      );
      setDarkMode(newMode);
      setDebugOutlines(newOutlines);
    });
    return unsubscribe;
  }, []);

  const triggerUpdateCheck = useCallback(async () => {
    log('[App] Checking for OTA updates...');
    try {
      const update = await UpdateService.checkUpdate();
      if (update) {
        log('[App] OTA Update found:', update.version);
        setPendingUpdate(update);
      }
      log('[App] Checking for Native updates...');
      const nativeUpdate = await UpdateService.checkNativeUpdate();
      if (nativeUpdate) {
        log('[App] Native Update found:', nativeUpdate.version);
        setPendingNativeUpdate(nativeUpdate);
      }
    } catch (e) {
      logError('[App] Update check error:', e);
    }
  }, []);

  const fetchHomeFeed = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      log('[App] fetchHomeFeed started');

      const source = sourceManager.getSource('mangapark');
      if (!source) {
        throw new Error('MangaPark source not registered');
      }

      const feed = await source.getHomeFeed();
      setPopularMangas(feed.popular);
      setLatestMangas(feed.latest);

      if (feed.popular.length === 0 && feed.latest.length === 0) {
        setHomeError('Connected but found no content.');
      }
    } catch (e: any) {
      logError('[App] fetchHomeFeed failed:', e);
      setHomeError(
        e.message ||
          'Failed to connect to MangaPark. Site might be down or protected.',
      );
    } finally {
      setHomeLoading(false);
    }
  }, []);

  // Fetch popular/latest manga on mount
  useEffect(() => {
    fetchHomeFeed();

    // Load saved filters
    const savedFilters = StorageService.getLastFilters();
    if (savedFilters) {
      setCurrentFilters(savedFilters);
      log('[App] Loaded saved filters:', savedFilters);
    }

    // Check for updates shortly after boot
    const timer = setTimeout(triggerUpdateCheck, 3000);
    return () => clearTimeout(timer);
  }, []);

  const loadBrowse = useCallback(async (filters?: SearchFilters) => {
    log('[App] Loading browse with filters:', JSON.stringify(filters));
    setLoading(true);
    try {
      const browseParams = {
        sort: filters?.sort || 'views_d030',
        genres: filters?.genres,
        status: filters?.status,
        word: (filters as any)?.word, // Search query
      };
      log('[App] Browse params:', JSON.stringify(browseParams));
      const results = await sourceManager.search(browseParams.word || '', {
        ...filters,
        sort: filters?.sort || 'views_d030',
        genres: filters?.genres || [],
        status: filters?.status || 'all',
        nsfw: false, // App default
      });
      log(`[App] Browse loaded: ${results.length} items`);
      setMangas(results);
    } catch (error) {
      logError('[App] Browse error:', error as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Preload browse when search tab is selected
  useEffect(() => {
    if (tab === 'search' && mangas.length === 0 && !loading) {
      log('[App] Search tab selected, preloading browse...');
      loadBrowse();
    }
  }, [tab, loadBrowse]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    log('[App] Refreshing home feed...');
    await fetchHomeFeed();
  }, [fetchHomeFeed]);

  const handleSearch = useCallback(
    async (q: string) => {
      log(`[App] handleSearch called with: "${q}"`);
      setSearchQuery(q);
      await loadBrowse({
        ...currentFilters,
        word: q,
      } as any);
    },
    [currentFilters, loadBrowse],
  );

  const handleApplyFilters = useCallback(
    async (filters: SearchFilters) => {
      log('[App] Applying filters:', filters);
      setCurrentFilters(filters);
      setShowFilters(false);
      StorageService.saveFilters(filters);
      await loadBrowse({
        ...filters,
        word: searchQuery,
      } as any);
    },
    [loadBrowse, searchQuery],
  );

  const handleSelectManga = useCallback(async (manga: Manga) => {
    log(`[App] Selected manga: ${manga.title}`);
    setSelectedManga(manga);
    setView('details');
    setSettingsSubview('main');
    setLoading(true);
    const source = sourceManager.resolveSource(
      manga.source || manga.url || manga.id,
    );
    if (!source) {
      logError('[App] No source found for manga:', manga);
      setLoading(false);
      return;
    }
    const details = await source.getMangaDetails(manga.url || manga.id);
    setMangaDetails(details);
    setLoading(false);
  }, []);

  const handleHistorySelect = useCallback(
    async (manga: Manga, chapterUrl?: string, chapterTitle?: string) => {
      log(`[App] History resume: ${manga.title}`);
      setSelectedManga(manga);
      setSettingsSubview('main');

      if (chapterUrl) {
        setSelectedChapterUrl(chapterUrl);
        setSelectedChapterTitle(chapterTitle || '');
        setView('reader');

        try {
          const source = sourceManager.resolveSource(
            manga.source || manga.url || manga.id,
          );
          if (source) {
            const details = await source.getMangaDetails(manga.url || manga.id);
            if (details) {
              setMangaDetails(details);
              setSelectedManga(details);
              StorageService.addToHistory(details, chapterUrl, chapterTitle);
              log('[App] Refreshed history metadata for:', details.title);
            }
          }
        } catch (e) {
          logError(
            '[App] Failed to load details for history resume',
            e as Error,
          );
        }
      } else {
        handleSelectManga(manga);
      }
    },
    [handleSelectManga],
  );

  const handleSelectChapter = useCallback(
    (chapterUrl: string, chapterTitle?: string) => {
      setSelectedChapterUrl(chapterUrl);
      setSelectedChapterTitle(chapterTitle || '');
      setView('reader');

      if (selectedManga) {
        StorageService.addToHistory(selectedManga, chapterUrl, chapterTitle);
      }
    },
    [selectedManga],
  );

  const handleBack = useCallback(() => {
    if (view === 'reader') {
      setView('details');
      triggerUpdateCheck();
    } else if (view === 'details') {
      setView('browse');
    }
  }, [view, triggerUpdateCheck]);

  const handleNextChapter = useCallback(() => {
    if (!mangaDetails || !selectedChapterUrl) {
      logWarn('[App] handleNextChapter failed: No details or selected chapter');
      return;
    }

    const chapters = mangaDetails.chapters;
    const normalizedSelected = normalizeUrl(selectedChapterUrl);

    const currentIndex = chapters.findIndex(
      (c: Chapter) => normalizeUrl(c.url) === normalizedSelected,
    );

    if (currentIndex !== -1 && currentIndex > 0) {
      const nextChapter = chapters[currentIndex - 1];
      handleSelectChapter(nextChapter.url, nextChapter.title);
    } else {
      logWarn(
        `[App] Next chapter not found. Index: ${currentIndex}, Total: ${chapters.length}`,
      );
    }
  }, [mangaDetails, selectedChapterUrl, handleSelectChapter]);

  const hasNextChapter = useMemo(() => {
    if (!mangaDetails || !selectedChapterUrl) return false;
    const chapters = mangaDetails.chapters;
    const normalizedSelected = normalizeUrl(selectedChapterUrl);
    const currentIndex = chapters.findIndex(
      (c: Chapter) => normalizeUrl(c.url) === normalizedSelected,
    );
    return currentIndex !== -1 && currentIndex > 0;
  }, [mangaDetails, selectedChapterUrl]);

  const handleTabChange = useCallback(
    (newTab: Tab) => {
      setTab(newTab);
      setView('browse');
      if (newTab === 'home') {
        triggerUpdateCheck();
      }
    },
    [triggerUpdateCheck],
  );

  const handleGenreClick = useCallback(
    (genre: string) => {
      if (genre === 'For You') {
        setTab('search');
        handleApplyFilters({
          genres: [],
          sort: 'views_d030',
          status: 'all',
          nsfw: false,
        });
      } else {
        setTab('search');
        handleApplyFilters({
          genres: [genre.toLowerCase()],
          sort: 'views_d030',
          status: 'all',
          nsfw: false,
        });
      }
    },
    [handleApplyFilters],
  );

  const handleSeeAllNew = useCallback(() => {
    setTab('search');
    handleApplyFilters({
      genres: [],
      sort: 'latest',
      status: 'all',
      nsfw: false,
    });
  }, [handleApplyFilters]);

  if (view === 'reader') {
    return (
      <Reader
        chapterUrl={selectedChapterUrl}
        chapterTitle={selectedChapterTitle}
        manga={selectedManga ?? undefined}
        onBack={handleBack}
        hasNextChapter={hasNextChapter}
        onNextChapter={handleNextChapter}
      />
    );
  }

  const randomHeaderTitle = useMemo(() => {
    const headerTitleRandom = ['I love you', 'Discover', 'Explore'];
    return headerTitleRandom[
      Math.floor(Math.random() * headerTitleRandom.length)
    ];
  }, []);

  const searchLoadingText =
    searchQuery.trim() && currentFilters?.genres?.length
      ? 'Filtering results...'
      : 'Searching the library...';

  return (
    <ErrorBoundary>
      <view
        className={`${darkMode ? 'Main dark-mode' : 'Main'}${debugOutlines ? ' debug-outlines' : ''}`}
      >
        <view
          className={view === 'browse' ? 'Content Content-with-nav' : 'Content'}
        >
          {view === 'details' && selectedManga && mangaDetails ? (
            <MangaDetailsUi
              details={mangaDetails}
              onBack={handleBack}
              onRead={handleSelectChapter}
            />
          ) : view === 'details' && selectedManga ? (
            <view className="LoadingContainer">
              <view className="LoadingPulse">
                <text className="LoadingIcon">📖</text>
              </view>
              <text className="StatusText">Opening the story...</text>
            </view>
          ) : null}

          {view === 'browse' && (
            <>
              {tab === 'home' && (
                <view className="Home">
                  <view className="HomeHeader">
                    <Sparkles>
                      <text className="HomeTitle">
                        Release v1.0.212 (Filters Fixed)
                      </text>
                    </Sparkles>
                  </view>
                  <scroll-view
                    className="MangaList"
                    scroll-y
                    bindscrolltoupper={handleRefresh}
                    upper-threshold={50}
                  >
                    {homeLoading ? (
                      <view className="LoadingContainer">
                        <view className="LoadingSpinner" />
                        <text className="StatusText">
                          Fetching latest updates...
                        </text>
                        <text className="SubStatusText">
                          Checking mirrors and resolving connection...
                        </text>
                      </view>
                    ) : homeError ? (
                      <view className="ErrorContainer">
                        <text className="ErrorIcon">📡</text>
                        <text className="ErrorTitle">Connection Issue</text>
                        <text className="StatusText">{homeError}</text>
                        <view className="RetryButton" bindtap={handleRefresh}>
                          <text className="RetryText">Try Again</text>
                        </view>
                      </view>
                    ) : (
                      <>
                        {popularMangas.length > 0 && (
                          <view
                            className="EditorialHero"
                            bindtap={() => handleSelectManga(popularMangas[0])}
                          >
                            <image
                              className="HeroImage"
                              src={popularMangas[0].cover}
                              mode="aspectFill"
                            />
                            <view className="HeroOverlay">
                              <text className="HeroTag">Trending Now</text>
                              <text className="HeroTitle">
                                {popularMangas[0].title}
                              </text>
                              <view className="HeroActions">
                                <view className="HeroReadButton">
                                  <text className="HeroReadText">Read Now</text>
                                </view>
                              </view>
                            </view>
                          </view>
                        )}

                        <view className="CategoryScrollContainer">
                          <scroll-view className="CategoryScroll" scroll-x>
                            {[
                              'For You',
                              'Romance',
                              'Action',
                              'Fantasy',
                              'Comedy',
                              'Isekai',
                              'Drama',
                            ].map((genre) => (
                              <view
                                key={genre}
                                className="CatPill"
                                bindtap={() => handleGenreClick(genre)}
                              >
                                <text className="CatText">{genre}</text>
                              </view>
                            ))}
                          </scroll-view>
                        </view>

                        <view className="SectionHeader">
                          <text className="SectionTitle">New Releases</text>
                          <text className="ViewAll" bindtap={handleSeeAllNew}>
                            See All
                          </text>
                        </view>

                        <view className="MangaGrid">
                          {latestMangas.length > 0 ? (
                            latestMangas.map((m) => (
                              <view key={m.id} className="GridItem">
                                <MangaCard
                                  manga={m}
                                  onSelect={handleSelectManga}
                                />
                              </view>
                            ))
                          ) : (
                            <text className="StatusText">
                              No updates found.
                            </text>
                          )}
                        </view>
                      </>
                    )}
                  </scroll-view>
                </view>
              )}

              {tab === 'search' && (
                <view className="SearchView">
                  <Search
                    onSearch={handleSearch}
                    onFilterClick={() => setShowFilters(true)}
                    value={searchQuery}
                  />
                  <scroll-view className="MangaList" scroll-y>
                    {loading ? (
                      <view className="LoadingContainer">
                        <view className="LoadingSpinner" />
                        <text className="StatusText">{searchLoadingText}</text>
                      </view>
                    ) : mangas.length > 0 ? (
                      mangas.map((m) => (
                        <MangaCard
                          key={m.id}
                          manga={m}
                          onSelect={handleSelectManga}
                        />
                      ))
                    ) : (
                      <view className="EmptyState">
                        <text className="EmptyIcon">
                          {searchQuery ? '😞' : '🔍'}
                        </text>
                        <text className="EmptyTitle">
                          {searchQuery
                            ? 'No Results Found'
                            : 'Start Your Search'}
                        </text>
                        <text className="EmptySubtitle">
                          {searchQuery
                            ? `We couldn't find anything for "${searchQuery}". Try different keywords.`
                            : 'Discover your next favorite manga by typing above.'}
                        </text>
                        {currentFilters && (
                          <text className="FilterStatus">
                            Filters active: {currentFilters.genres.length}{' '}
                            genres
                          </text>
                        )}
                      </view>
                    )}
                  </scroll-view>
                </view>
              )}

              {tab === 'settings' && (
                <>
                  {settingsSubview === 'main' && (
                    <Settings
                      onNavigate={(subview) => setSettingsSubview(subview)}
                    />
                  )}
                  {settingsSubview === 'favorites' && (
                    <FavoritesView
                      onBack={() => setSettingsSubview('main')}
                      onSelectManga={handleSelectManga}
                    />
                  )}
                  {settingsSubview === 'history' && (
                    <HistoryView
                      onBack={() => setSettingsSubview('main')}
                      onSelectHistoryItem={handleHistorySelect}
                    />
                  )}
                </>
              )}
            </>
          )}
        </view>

        {showFilters && (
          <SearchFiltersModal
            onApply={handleApplyFilters}
            onClose={() => setShowFilters(false)}
            onReset={() => setSearchQuery('')}
            initialFilters={currentFilters}
          />
        )}

        {view === 'browse' && (
          <BottomNav activeTab={tab} onTabChange={handleTabChange} />
        )}

        {pendingNativeUpdate && (
          <UpdateModal
            update={pendingNativeUpdate}
            nativeUrl={pendingNativeUpdate.url}
            onDismiss={() => {
              UpdateService.skipVersion(pendingNativeUpdate.version);
              setPendingNativeUpdate(null);
            }}
          />
        )}

        {!pendingNativeUpdate && pendingUpdate && (
          <UpdateModal
            update={pendingUpdate}
            onDismiss={() => {
              UpdateService.skipVersion(pendingUpdate.version);
              setPendingUpdate(null);
            }}
          />
        )}
      </view>
    </ErrorBoundary>
  );
}
