import type { Manga } from '../services/batoto';
import { MangaCard } from './MangaCard';

interface HomeViewProps {
  popularMangas: Manga[];
  latestMangas: Manga[];
  homeLoading: boolean;
  homeError: string | null;
  onRefresh: () => void;
  onSelectManga: (manga: Manga) => void;
  onGenreClick: (genre: string) => void;
  onSeeAllNew: () => void;
}

const GENRE_PILLS = [
  'For You',
  'Romance',
  'Action',
  'Fantasy',
  'Comedy',
  'Isekai',
  'Drama',
];

const HEADER_TITLES = ['I love you', 'Discover', 'Explore'];

export function HomeView({
  popularMangas,
  latestMangas,
  homeLoading,
  homeError,
  onRefresh,
  onSelectManga,
  onGenreClick,
  onSeeAllNew,
}: HomeViewProps) {
  const randomHeaderTitle =
    HEADER_TITLES[Math.floor(Math.random() * HEADER_TITLES.length)];

  if (homeLoading) {
    return (
      <view className="Home">
        <view className="HomeHeader">
          <text className="HomeTitle">{randomHeaderTitle}</text>
        </view>
        <view className="LoadingContainer">
          <view className="LoadingSpinner" />
          <text className="StatusText">Fetching latest updates...</text>
          <text className="SubStatusText">
            Checking mirrors and resolving connection...
          </text>
        </view>
      </view>
    );
  }

  if (homeError) {
    return (
      <view className="Home">
        <view className="HomeHeader">
          <text className="HomeTitle">{randomHeaderTitle}</text>
        </view>
        <view className="ErrorContainer">
          <text className="ErrorIcon">📡</text>
          <text className="ErrorTitle">Connection Issue</text>
          <text className="StatusText">{homeError}</text>
          <view className="RetryButton" bindtap={onRefresh}>
            <text className="RetryText">Try Again</text>
          </view>
        </view>
      </view>
    );
  }

  return (
    <view className="Home">
      <view className="HomeHeader">
        <text className="HomeTitle">{randomHeaderTitle}</text>
      </view>
      <scroll-view
        className="MangaList"
        scroll-y
        bindscrolltoupper={onRefresh}
        upper-threshold={50}
      >
        {/* Editorial Hero Section */}
        {popularMangas.length > 0 && (
          <view
            className="EditorialHero"
            bindtap={() => onSelectManga(popularMangas[0])}
          >
            <image
              className="HeroImage"
              src={popularMangas[0].cover}
              mode="aspectFill"
            />
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
            {GENRE_PILLS.map((genre) => (
              <view
                key={genre}
                className="CatPill"
                bindtap={() => onGenreClick(genre)}
              >
                <text className="CatText">{genre}</text>
              </view>
            ))}
          </scroll-view>
        </view>

        <view className="SectionHeader">
          <text className="SectionTitle">New Releases</text>
          <text className="ViewAll" bindtap={onSeeAllNew}>
            See All
          </text>
        </view>

        {/* Latest Updates Grid */}
        <view className="MangaGrid">
          {latestMangas.length > 0 ? (
            latestMangas.map((m) => (
              <view key={m.id} className="GridItem">
                <MangaCard manga={m} onSelect={onSelectManga} />
              </view>
            ))
          ) : (
            <text className="StatusText">No updates found.</text>
          )}
        </view>
      </scroll-view>
    </view>
  );
}
