import { useEffect, useMemo, useState } from '@lynx-js/react';
import type { MangaDetails } from '../services/batoto';
import { StorageService } from '../services/storage';
import './MangaDetailsUi.css';

interface Props {
  details: MangaDetails;
  onBack: () => void;
  onRead: (chapterUrl: string, chapterTitle?: string) => void;
}

export function MangaDetailsUi({ details, onBack, onRead }: Props) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [reverseOrder, setReverseOrder] = useState(true);

  // Favorite state
  const [isFavorite, setIsFavorite] = useState(
    StorageService.isFavoriteSync(details.id),
  );
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    StorageService.isFavorite(details.id).then(setIsFavorite);
  }, [details.id]);

  const handleToggleFavorite = async () => {
    if (favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorite) {
        await StorageService.removeFavorite(details.id);
        setIsFavorite(false);
      } else {
        await StorageService.addFavorite({
          id: details.id,
          title: details.title,
          cover: details.cover,
          url: '', // Will be set by caller context
        });
        setIsFavorite(true);
      }
    } catch (e) {
      console.error('[MangaDetailsUi] Favorite toggle failed:', e);
    } finally {
      setFavLoading(false);
    }
  };

  // My wife can only read english, so we should only show english chapters.
  // For now, simple list with sort toggle.
  const displayChapters = useMemo(() => {
    const chapters = [...details.chapters];
    if (reverseOrder) {
      chapters.reverse();
    }
    return chapters;
  }, [details.chapters, reverseOrder]);

  return (
    <view className="DetailsContainer">
      {/* Header with blurred background? Or simple layout.. USER: We should do a header with blurred background */}
      <view className="DetailsHeader">
        <image
          className="DetailsBackdrop"
          src={details.cover}
          mode="aspectFill"
        />
        <view className="DetailsHeaderOverlay">
          <view className="HeaderNav">
            <text className="BackButton" bindtap={onBack}>
              ← Back
            </text>
            <view
              className={
                isFavorite ? 'DetailsFavorite active' : 'DetailsFavorite'
              }
              bindtap={handleToggleFavorite}
            >
              <text className="DetailsFavorite-icon">
                {favLoading ? '⏳' : isFavorite ? '❤️' : '🤍'}
              </text>
            </view>
          </view>
          <view className="HeaderContent">
            <image
              className="DetailsCover"
              src={details.cover}
              mode="aspectFill"
            />
            <view className="HeaderInfo">
              <text className="DetailsTitle">{details.title}</text>
              <view className="DetailsBadges">
                {details.status && (
                  <text className="Badge status">{details.status}</text>
                )}
                {details.rating && (
                  <text className="Badge rating">★ {details.rating}</text>
                )}
              </view>
              <text className="DetailsMeta">{details.authors?.join(', ')}</text>
              <text className="DetailsMeta">{details.views} views</text>
            </view>
          </view>
        </view>
      </view>

      <scroll-view className="DetailsBody" scroll-y>
        {/* Description */}
        <view
          className="DescriptionSection"
          bindtap={() => setDescExpanded(!descExpanded)}
        >
          <text
            className={
              descExpanded ? 'DescriptionText expanded' : 'DescriptionText'
            }
          >
            {details.description || 'No description available.'}
          </text>
          <text className="ExpandHint">
            {descExpanded ? 'Show less' : 'Read more'}
          </text>
        </view>

        {/* Genres, these need to be badges, but non intrusive. */}
        <scroll-view className="GenreRow" scroll-x>
          {details.genres?.map((g) => (
            <text key={g} className="GenreTag">
              {g}
            </text>
          ))}
        </scroll-view>

        {/* Chapters Actions */}
        <view className="ChapterActions">
          <text className="SectionTitle">
            {details.chapters.length} Chapters
          </text>
          <view
            className="SortButton"
            bindtap={() => setReverseOrder(!reverseOrder)}
          >
            <text className="SortText">
              {reverseOrder ? 'Oldest First' : 'Newest First'}
            </text>
          </view>
        </view>

        {/* Chapter List */}
        <view className="DetailsChapterList">
          {displayChapters.map((ch) => (
            <view
              key={ch.id}
              className="DetailChapterItem"
              bindtap={() => onRead(ch.url, ch.title)}
            >
              <view>
                <text className="ChTitle">{ch.title}</text>
                <text className="ChMeta">
                  {ch.group} • {ch.uploadDate}
                </text>
              </view>
            </view>
          ))}
        </view>
      </scroll-view>
    </view>
  );
}
