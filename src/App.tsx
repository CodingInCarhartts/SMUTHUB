import { useCallback, useState, useEffect } from '@lynx-js/react';
import { BatotoService, type Manga, type Chapter, type MangaDetails, type SearchFilters } from './services/batoto';
import { MangaCard } from './components/MangaCard';
import { Reader } from './components/Reader';
import { Search } from './components/Search';
import { SearchFiltersModal } from './components/SearchFilters';
import { MangaDetailsUi } from './components/MangaDetailsUi';
import { BottomNav } from './components/BottomNav';
import { Settings } from './components/Settings';
import './App.css';

type Tab = 'home' | 'search' | 'settings';
type ViewState = 'browse' | 'details' | 'reader';

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<ViewState>('browse');
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [popularMangas, setPopularMangas] = useState<Manga[]>([]);
  const [latestMangas, setLatestMangas] = useState<Manga[]>([]);
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [mangaDetails, setMangaDetails] = useState<MangaDetails | null>(null);
  const [selectedChapterUrl, setSelectedChapterUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  
  // Search & Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters | undefined>(undefined);

  // Fetch popular/latest manga on mount
  useEffect(() => {
    fetchHomeFeed();
  }, []);

  const loadBrowse = useCallback(async (filters?: SearchFilters) => {
    console.log('[App] Loading browse with filters:', JSON.stringify(filters));
    setLoading(true);
    try {
      const browseParams = {
        sort: filters?.sort || 'views_d030',
        genres: filters?.genres,
        status: filters?.status,
        word: (filters as any)?.word  // Search query
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
    const feed = await BatotoService.getHomeFeed();
    setPopularMangas(feed.popular);
    setLatestMangas(feed.latest);
    setHomeLoading(false);
  }, []);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    console.log("[App] Refreshing home feed...");
    await fetchHomeFeed();
  }, [fetchHomeFeed]);

  const handleSearch = useCallback(async (q: string) => {
    console.log(`[App] handleSearch called with: "${q}"`);
    setSearchQuery(q);
    
    // Use browse API with search word + current filters
    await loadBrowse({
      ...currentFilters,
      word: q
    } as any);
  }, [currentFilters, loadBrowse]);

  const handleApplyFilters = useCallback(async (filters: SearchFilters) => {
      console.log("[App] Applying filters:", filters);
      setCurrentFilters(filters);
      setShowFilters(false);
      
      // Reload browse with new filters
      await loadBrowse(filters);
  }, [loadBrowse]);

  const handleSelectManga = useCallback(async (manga: Manga) => {
    console.log(`[App] Selected manga: ${manga.title}`);
    setSelectedManga(manga);
    setView('details');
    setLoading(true);
    const details = await BatotoService.getMangaDetails(manga.url);
    setMangaDetails(details);
    setLoading(false);
  }, []);

  const handleSelectChapter = useCallback((chapterUrl: string) => {
    setSelectedChapterUrl(chapterUrl);
    setView('reader');
  }, []);

  const handleBack = useCallback(() => {
    if (view === 'reader') {
      setView('details');
    } else if (view === 'details') {
      setView('browse');
    }
  }, [view]);

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
    setView('browse');
  }, []);

  // Reader view (fullscreen, no bottom nav)
  if (view === 'reader') {
    return <Reader chapterUrl={selectedChapterUrl} onBack={handleBack} />;
  }

  return (
    <view className="Main">
      <view className="Content">
        {/* Details view */}
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
                  <text className="HomeTitle">Discover</text>
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
                        <text className="StatusText">Fetching latest updates...</text>
                    </view>
                  ) : (
                    <>
                      {/* Editorial Hero Section */}
                      {popularMangas.length > 0 && (
                        <view className="EditorialHero" bindtap={() => handleSelectManga(popularMangas[0])}>
                           <image className="HeroImage" src={popularMangas[0].cover} mode="aspectFill" />
                           <view className="HeroOverlay">
                             <text className="HeroTag">Trending Now</text>
                             <text className="HeroTitle">{popularMangas[0].title}</text>
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
                          <view className="CatPill active"><text className="CatText">For You</text></view>
                          <view className="CatPill"><text className="CatText">Romance</text></view>
                          <view className="CatPill"><text className="CatText">Action</text></view>
                          <view className="CatPill"><text className="CatText">Fantasy</text></view>
                          <view className="CatPill"><text className="CatText">Comedy</text></view>
                        </scroll-view>
                      </view>

                      <view className="SectionHeader">
                        <text className="SectionTitle">New Releases</text>
                        <text className="ViewAll">See All</text>
                      </view>

                      {/* Latest Updates Grid */}
                      <view className="MangaGrid">
                        {latestMangas.length > 0 ? (
                          latestMangas.map(m => (
                            <view key={m.id} className="GridItem">
                              <MangaCard manga={m} onSelect={handleSelectManga} />
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
                <Search onSearch={handleSearch} onFilterClick={() => setShowFilters(true)} />
                <scroll-view className="MangaList" scroll-y>
                  {loading ? (
                    <view className="LoadingContainer">
                        <view className="LoadingSpinner" />
                        <text className="StatusText">Searching the library...</text>
                    </view>
                  ) : mangas.length > 0 ? (
                    mangas.map(m => (
                      <MangaCard key={m.id} manga={m} onSelect={handleSelectManga} />
                    ))
                  ) : (
                   <view className="EmptyState">
                      <text className="EmptyIcon">{searchQuery ? '😞' : '🔍'}</text>
                      <text className="EmptyTitle">
                        {searchQuery ? 'No Results Found' : 'Start Your Search'}
                      </text>
                      <text className="EmptySubtitle">
                        {searchQuery 
                          ? `We couldn't find anything for "${searchQuery}". Try different keywords.` 
                          : 'Discover your next favorite manga by typing above.'}
                      </text>
                      {currentFilters && (
                          <text className="FilterStatus">Filters active: {currentFilters.genres.length} genres</text>
                      )}
                   </view>
                  )}
                </scroll-view>
              </view>
            )}

            {tab === 'settings' && (
              <Settings />
            )}
          </>
        )}
      </view>

      {/* Filter Modal */}
      {showFilters && (
          <SearchFiltersModal 
            onApply={handleApplyFilters} 
            onClose={() => setShowFilters(false)} 
          />
      )}

      {/* Bottom Navigation */}
      {view === 'browse' && (
        <BottomNav activeTab={tab} onTabChange={handleTabChange} />
      )}
    </view>
  );
}
