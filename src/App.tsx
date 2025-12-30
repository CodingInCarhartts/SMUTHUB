// Initialize debug log capture FIRST so all logs are captured
import './services/debugLog';
import { Sparkles } from './components/Sparkles';
import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';
import { BottomNav } from './components/BottomNav';
import { FavoritesView } from './components/FavoritesView';
import { HistoryView } from './components/HistoryView';
import { MangaCard } from './components/MangaCard';
import { MangaDetailsUi } from './components/MangaDetailsUi';
import { Reader } from './components/Reader';
import { Search } from './components/Search';
import { SearchFiltersModal } from './components/SearchFilters';
import { Settings } from './components/Settings';
import { UpdateModal } from './components/UpdateModal';
import {
  BatotoService,
  type Chapter,
  type Manga,
  type MangaDetails,
  type SearchFilters,
} from './services/batoto';
import { SettingsStore } from './services/settings';
import { StorageService } from './services/storage';
import {
  type AppUpdate,
  type NativeAppUpdate,
  UpdateService,
} from './services/update';
import './App.css';

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

  // OTA Update state
  const [pendingUpdate, setPendingUpdate] = useState<AppUpdate | null>(null);

  // Native APK Update state
  const [pendingNativeUpdate, setPendingNativeUpdate] =
    useState<NativeAppUpdate | null>(null);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      const newMode = SettingsStore.getDarkMode();
      console.log('[App] Settings update received. Dark mode:', newMode);
      setDarkMode(newMode);
    });
    return unsubscribe;
  }, []);

  // Fetch popular/latest manga on mount
  useEffect(() => {
    fetchHomeFeed();

    // Load saved filters
    const savedFilters = StorageService.getLastFilters();
    if (savedFilters) {
      setCurrentFilters(savedFilters);
      console.log('[App] Loaded saved filters:', savedFilters);
    }
  }, []);

  // Check for updates on mount, app resume, and navigation events
  // Cooldown is handled by UpdateService internally
  const triggerUpdateCheck = useCallback(async () => {
    console.log('[App] Checking for OTA updates...');
    const update = await UpdateService.checkUpdate();
    if (update) {
      console.log('[App] OTA Update found:', update.version);
      setPendingUpdate(update);
    }
    console.log('[App] Checking for Native updates...');
    const nativeUpdate = await UpdateService.checkNativeUpdate();
    if (nativeUpdate) {
      console.log('[App] Native Update found:', nativeUpdate.version);
      setPendingNativeUpdate(nativeUpdate);
    }
  }, []);

  useEffect(() => {
    // 1. Check on mount (with small delay)
    const initialTimeout = setTimeout(() => {
      triggerUpdateCheck();
    }, 3000);

    // 2. Check on app resume/foreground
    const handleAppShow = () => {
      console.log('[App] App resumed, checking for updates...');
      triggerUpdateCheck();
    };

    const runtime =
      typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime && runtime.on) {
      runtime.on('appshow', handleAppShow);
    }

    return () => {
      clearTimeout(initialTimeout);
      if (runtime && runtime.off) {
        runtime.off('appshow', handleAppShow);
      }
    };
  }, [triggerUpdateCheck]);

  const loadBrowse = useCallback(async (filters?: SearchFilters) => {
    console.log('[App] Loading browse with filters:', JSON.stringify(filters));
    setLoading(true);
    try {
      const browseParams = {
        sort: filters?.sort || 'views_d030',
        genres: filters?.genres,
        status: filters?.status,
        word: (filters as any)?.word, // Search query
      };
      console.log('[App] Browse params:', JSON.stringify(browseParams));
      const results = await BatotoService.browse(browseParams);
      console.log(`[App] Browse loaded: ${results.length} items`);
      setMangas(results);
    } catch (error) {
      console.error('[App] Browse error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Preload browse when search tab is selected
  useEffect(() => {
    if (tab === 'search' && mangas.length === 0 && !loading) {
      console.log('[App] Search tab selected, preloading browse...');
      loadBrowse();
    }
  }, [tab, loadBrowse]);

  const fetchHomeFeed = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      console.log('[App] fetchHomeFeed started');
      const feed = await BatotoService.getHomeFeed();
      setPopularMangas(feed.popular);
      setLatestMangas(feed.latest);
      if (feed.popular.length === 0 && feed.latest.length === 0) {
        setHomeError(
          'Connected but found no content. Batoto might be blocking the request.',
        );
      }
    } catch (e: any) {
      console.error('[App] fetchHomeFeed failed:', e);
      setHomeError(
        e.message ||
          'Failed to connect to Batoto. Site might be down or protected.',
      );
    } finally {
      setHomeLoading(false);
    }
  }, []);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    console.log('[App] Refreshing home feed...');
    await fetchHomeFeed();
  }, [fetchHomeFeed]);

  const handleSearch = useCallback(
    async (q: string) => {
      console.log(`[App] handleSearch called with: "${q}"`);
      setSearchQuery(q);

      // Use browse API with search word + current filters
      await loadBrowse({
        ...currentFilters,
        word: q,
      } as any);
    },
    [currentFilters, loadBrowse],
  );

  const handleApplyFilters = useCallback(
    async (filters: SearchFilters) => {
      console.log('[App] Applying filters:', filters);
      setCurrentFilters(filters);
      setShowFilters(false);

      // Save filters for persistence
      StorageService.saveFilters(filters);

      // Reload browse with new filters
      await loadBrowse(filters);
    },
    [loadBrowse],
  );

  const handleSelectManga = useCallback(async (manga: Manga) => {
    console.log(`[App] Selected manga: ${manga.title}`);
    setSelectedManga(manga);
    setView('details');
    setSettingsSubview('main'); // Reset settings subview when viewing manga
    setLoading(true);
    const details = await BatotoService.getMangaDetails(manga.url);
    setMangaDetails(details);
    setLoading(false);
  }, []);

  const handleSelectChapter = useCallback(
    (chapterUrl: string, chapterTitle?: string) => {
      setSelectedChapterUrl(chapterUrl);
      setSelectedChapterTitle(chapterTitle || '');
      setView('reader');

      // Track history with chapter info
      if (selectedManga) {
        StorageService.addToHistory(selectedManga, chapterUrl, chapterTitle);
      }
    },
    [selectedManga],
  );

  const handleBack = useCallback(() => {
    if (view === 'reader') {
      setView('details');
      // Check for updates when exiting reader (natural break point)
      triggerUpdateCheck();
    } else if (view === 'details') {
      setView('browse');
    }
  }, [view, triggerUpdateCheck]);

  const handleNextChapter = useCallback(() => {
    if (!mangaDetails || !selectedChapterUrl) return;

    // Chapters are oldest to newest (0 to length-1)
    const chapters = mangaDetails.chapters;
    const currentIndex = chapters.findIndex(
      (c: Chapter) => c.url === selectedChapterUrl,
    );

    if (currentIndex !== -1 && currentIndex < chapters.length - 1) {
      const nextChapter = chapters[currentIndex + 1];
      console.log(`[App] Navigating to next chapter: ${nextChapter.title}`);
      handleSelectChapter(nextChapter.url, nextChapter.title);
    }
  }, [mangaDetails, selectedChapterUrl, handleSelectChapter]);

  const hasNextChapter = useMemo(() => {
    if (!mangaDetails || !selectedChapterUrl) return false;
    const chapters = mangaDetails.chapters;
    const currentIndex = chapters.findIndex(
      (c: Chapter) => c.url === selectedChapterUrl,
    );
    return currentIndex !== -1 && currentIndex < chapters.length - 1;
  }, [mangaDetails, selectedChapterUrl]);

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
    setView('browse');
    // Check for updates when navigating to home tab
    if (newTab === 'home') {
      triggerUpdateCheck();
    }
  }, [triggerUpdateCheck]);

  const handleGenreClick = useCallback(
    (genre: string) => {
      if (genre === 'For You') {
        // Reset to default (Trending)
        setTab('search');
        handleApplyFilters({
          genres: [],
          sort: 'views_d030',
          status: 'all',
          nsfw: false,
        });
      } else {
        setTab('search'); // Switch to browse/search tab
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
      sort: 'update',
      status: 'all',
      nsfw: false,
    });
  }, [handleApplyFilters]);

  // Reader view (fullscreen, no bottom nav)
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

  const headerTitleRandom = ['I love you', 'Discover', 'Explore'];

  const randomHeaderTitle =
    headerTitleRandom[Math.floor(Math.random() * headerTitleRandom.length)];

  return (
    <view className={darkMode ? 'Main dark-mode' : 'Main'}>
      <view
        className={view === 'browse' ? 'Content Content-with-nav' : 'Content'}
      >
        {/* Details view */}
        {view === 'details' && selectedManga && mangaDetails && (
          <MangaDetailsUi
            details={mangaDetails}
            onBack={handleBack}
            onRead={handleSelectChapter}
          />
        )}
        {view === 'details' && selectedManga && !mangaDetails && (
          <view className="LoadingContainer">
            <view className="LoadingPulse">
              <text className="LoadingIcon">📖</text>
            </view>
            <text className="StatusText">Opening the story...</text>
          </view>
        )}

        {/* Browse view with tabs */}
        {view === 'browse' && (
          <>
            {tab === 'home' && (
              <view className="Home">
                <view className="HomeHeader">
                  <Sparkles>
                    <text className="HomeTitle">{randomHeaderTitle}</text>
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
                      {/* Editorial Hero Section */}
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

                      {/* Category Scroll */}
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

                      {/* Latest Updates Grid */}
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
                          <text className="StatusText">No updates found.</text>
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
                      <text className="StatusText">
                        Searching the library...
                      </text>
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
                        {searchQuery ? 'No Results Found' : 'Start Your Search'}
                      </text>
                      <text className="EmptySubtitle">
                        {searchQuery
                          ? `We couldn't find anything for "${searchQuery}". Try different keywords.`
                          : 'Discover your next favorite manga by typing above.'}
                      </text>
                      {currentFilters && (
                        <text className="FilterStatus">
                          Filters active: {currentFilters.genres.length} genres
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
                    onSelectManga={handleSelectManga}
                  />
                )}
              </>
            )}
          </>
        )}
      </view>

      {/* Filter Modal */}
      {showFilters && (
        <SearchFiltersModal
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
          onReset={() => setSearchQuery('')}
          initialFilters={currentFilters}
        />
      )}

      {/* Bottom Navigation */}
      {view === 'browse' && (
        <BottomNav activeTab={tab} onTabChange={handleTabChange} />
      )}

      {/* Update Notification */}
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
  );
}
