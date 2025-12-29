// Initialize debug log capture FIRST so all logs are captured
import './services/debugLog';
import { useCallback, useEffect, useMemo, useState } from '@lynx-js/react';
import { BottomNav } from './components/BottomNav';
import { FavoritesView } from './components/FavoritesView';
import { HistoryView } from './components/HistoryView';
import { HomeView } from './components/HomeView';
import { MangaDetailsUi } from './components/MangaDetailsUi';
import { Reader } from './components/Reader';
import { SearchFiltersModal } from './components/SearchFilters';
import { SearchViewContainer } from './components/SearchViewContainer';
import { Settings } from './components/Settings';
import { UpdateModal } from './components/UpdateModal';
import { useAppUpdates } from './hooks/useAppUpdates';
import { useMangaData } from './hooks/useMangaData';
import { type Tab, useMangaNavigation } from './hooks/useMangaNavigation';
import type { Chapter, Manga, SearchFilters } from './services/batoto';
import { SettingsStore } from './services/settings';
import { StorageService } from './services/storage';
import './App.css';

export function App() {
  // Navigation state
  const {
    tab,
    view,
    settingsSubview,
    setSettingsSubview,
    navigateToDetails,
    navigateToReader,
    navigateBack,
    changeTab,
  } = useMangaNavigation();

  // Manga data state
  const {
    mangas,
    popularMangas,
    latestMangas,
    selectedManga,
    setSelectedManga,
    mangaDetails,
    loading,
    homeLoading,
    homeError,
    fetchHomeFeed,
    loadBrowse,
    selectManga,
  } = useMangaData();

  // Update state
  const {
    pendingUpdate,
    pendingNativeUpdate,
    triggerUpdateCheck,
    dismissOtaUpdate,
    dismissNativeUpdate,
  } = useAppUpdates();

  // Search & Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<
    SearchFilters | undefined
  >(undefined);

  // Reader state
  const [selectedChapterUrl, setSelectedChapterUrl] = useState<string>('');
  const [selectedChapterTitle, setSelectedChapterTitle] = useState<string>('');

  // Dark mode
  const [darkMode, setDarkMode] = useState(SettingsStore.getDarkMode());

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
  }, [fetchHomeFeed]);

  // Preload browse when search tab is selected
  useEffect(() => {
    if (tab === 'search' && mangas.length === 0 && !loading) {
      console.log('[App] Search tab selected, preloading browse...');
      loadBrowse();
    }
  }, [tab, loadBrowse, mangas.length, loading]);

  const handleRefresh = useCallback(async () => {
    console.log('[App] Refreshing home feed...');
    await fetchHomeFeed();
  }, [fetchHomeFeed]);

  const handleSearch = useCallback(
    async (q: string) => {
      console.log(`[App] handleSearch called with: "${q}"`);
      setSearchQuery(q);
      await loadBrowse({
        ...currentFilters,
        word: q,
      } as SearchFilters & { word: string });
    },
    [currentFilters, loadBrowse],
  );

  const handleApplyFilters = useCallback(
    async (filters: SearchFilters) => {
      console.log('[App] Applying filters:', filters);
      setCurrentFilters(filters);
      setShowFilters(false);
      StorageService.saveFilters(filters);
      await loadBrowse(filters);
    },
    [loadBrowse],
  );

  const handleSelectManga = useCallback(
    async (manga: Manga) => {
      navigateToDetails();
      await selectManga(manga);
    },
    [navigateToDetails, selectManga],
  );

  const handleSelectChapter = useCallback(
    (chapterUrl: string, chapterTitle?: string) => {
      setSelectedChapterUrl(chapterUrl);
      setSelectedChapterTitle(chapterTitle || '');
      navigateToReader();

      if (selectedManga) {
        StorageService.addToHistory(selectedManga, chapterUrl, chapterTitle);
      }
    },
    [selectedManga, navigateToReader],
  );

  const handleBack = useCallback(() => {
    navigateBack(triggerUpdateCheck);
  }, [navigateBack, triggerUpdateCheck]);

  const handleNextChapter = useCallback(() => {
    if (!mangaDetails || !selectedChapterUrl) return;

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

  const handleTabChange = useCallback(
    (newTab: Tab) => {
      changeTab(newTab, triggerUpdateCheck);
    },
    [changeTab, triggerUpdateCheck],
  );

  const handleGenreClick = useCallback(
    (genre: string) => {
      if (genre === 'For You') {
        handleTabChange('search');
        handleApplyFilters({
          genres: [],
          sort: 'views_d030',
          status: 'all',
          nsfw: false,
        });
      } else {
        handleTabChange('search');
        handleApplyFilters({
          genres: [genre.toLowerCase()],
          sort: 'views_d030',
          status: 'all',
          nsfw: false,
        });
      }
    },
    [handleApplyFilters, handleTabChange],
  );

  const handleSeeAllNew = useCallback(() => {
    handleTabChange('search');
    handleApplyFilters({
      genres: [],
      sort: 'update',
      status: 'all',
      nsfw: false,
    });
  }, [handleApplyFilters, handleTabChange]);

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
              <HomeView
                popularMangas={popularMangas}
                latestMangas={latestMangas}
                homeLoading={homeLoading}
                homeError={homeError}
                onRefresh={handleRefresh}
                onSelectManga={handleSelectManga}
                onGenreClick={handleGenreClick}
                onSeeAllNew={handleSeeAllNew}
              />
            )}

            {tab === 'search' && (
              <SearchViewContainer
                mangas={mangas}
                loading={loading}
                searchQuery={searchQuery}
                currentFilters={currentFilters}
                onSearch={handleSearch}
                onFilterClick={() => setShowFilters(true)}
                onSelectManga={handleSelectManga}
              />
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
          onDismiss={dismissNativeUpdate}
        />
      )}

      {!pendingNativeUpdate && pendingUpdate && (
        <UpdateModal update={pendingUpdate} onDismiss={dismissOtaUpdate} />
      )}
    </view>
  );
}
