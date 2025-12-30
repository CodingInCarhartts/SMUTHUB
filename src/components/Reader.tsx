import { useEffect, useState, useRef } from '@lynx-js/react';
import { BatotoService, type Manga } from '../services/batoto';
import { type ReadingMode, SettingsStore } from '../services/settings';
import { StorageService } from '../services/storage';
import './Reader.css';

interface Props {
  chapterUrl: string;
  chapterTitle?: string;
  manga?: Manga;
  onBack: () => void;
  hasNextChapter: boolean;
  onNextChapter: () => void;
}

function ReaderPanel({ url, index }: { url: string; index: number }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const MAX_RETRIES = 5;

  const currentUrl =
    retryCount > 0
      ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryCount}`
      : url;

  useEffect(() => {
    console.log(`[ReaderPanel #${index}] URL: ${url} (retry: ${retryCount})`);
  }, [url, index, retryCount]);

  const handleLoad = (e: any) => {
    const { width, height } = e.detail;
    const calcRatio = width / height;
    console.log(
      `[ReaderPanel #${index}] LOADED: ${width}x${height} (ratio: ${calcRatio.toFixed(3)})`,
    );
    if (width && height) {
      setRatio(calcRatio);
      setFailed(false);
    }
  };

  const handleError = (e: any) => {
    console.error(
      `[ReaderPanel #${index}] ERROR (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
      e.detail?.errMsg,
    );
    if (retryCount < MAX_RETRIES - 1) {
      setTimeout(
        () => {
          setRetryCount((prev) => prev + 1);
        },
        500 + (index % 5) * 200,
      );
    } else {
      setFailed(true);
    }
  };

  const handleRetryTap = () => {
    if (retryCount >= MAX_RETRIES - 1) {
      setRetryCount(0);
      setFailed(false);
    }
  };

  const displayRatio = ratio ? `${ratio}` : '0.6';

  return (
    <view
      className="Reader-panel-wrapper"
      style={{
        aspectRatio: displayRatio,
        backgroundColor: ratio ? 'transparent' : '#1a1a1a',
        minHeight: ratio ? 'auto' : '400px',
      }}
    >
      {failed ? (
        <view className="Reader-panel-error" bindtap={handleRetryTap}>
          <text className="Reader-panel-error-text">
            Failed to load - Tap to retry
          </text>
        </view>
      ) : (
        <image
          src={currentUrl}
          className="Reader-panel"
          mode="scaleToFill"
          bindload={handleLoad}
          binderror={handleError}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      )}
      {!ratio && !failed && (
        <view className="Reader-panel-loader">
          <text className="Reader-panel-loader-text">
            {retryCount > 0
              ? `Retrying (${retryCount}/${MAX_RETRIES})...`
              : 'Loading...'}
          </text>
        </view>
      )}
    </view>
  );
}

// Horizontal mode panel - fixed size for swiping
function HorizontalPanel({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5;

  const currentUrl =
    retryCount > 0
      ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryCount}`
      : url;

  const handleError = () => {
    if (retryCount < MAX_RETRIES - 1) {
      setTimeout(() => setRetryCount((prev) => prev + 1), 500);
    } else {
      setFailed(true);
    }
  };

  const handleRetryTap = () => {
    setRetryCount(0);
    setFailed(false);
  };

  return (
    <view className="Reader-horizontal-panel">
      {failed ? (
        <view className="Reader-panel-error" bindtap={handleRetryTap}>
          <text className="Reader-panel-error-text">Failed - Tap to retry</text>
        </view>
      ) : (
        <image
          src={currentUrl}
          className="Reader-horizontal-image"
          mode="aspectFit"
          binderror={handleError}
        />
      )}
      <view className="Reader-page-indicator">
        <text className="Reader-page-number">{index + 1}</text>
      </view>
    </view>
  );
}

export function Reader({
  chapterUrl,
  chapterTitle,
  manga,
  onBack,
  hasNextChapter,
  onNextChapter,
}: Props) {
  const [panels, setPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>(
    SettingsStore.getReadingMode(),
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [restoredPageIndex, setRestoredPageIndex] = useState<number | undefined>(undefined);
  const [touchStartX, setTouchStartX] = useState(0);
  const [positionRestored, setPositionRestored] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isFavorite, setIsFavorite] = useState(() =>
    manga ? StorageService.isFavoriteSync(manga.id) : false,
  );
  const [remoteMode, setRemoteMode] = useState(SettingsStore.getRemoteMode());
  const [showControls, setShowControls] = useState(true);
  const lastKeyDownTime = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      setReadingMode(SettingsStore.getReadingMode());
      setRemoteMode(SettingsStore.getRemoteMode());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadPanels = async () => {
      setLoading(true);
      setIsRestoring(true);
      console.log('[Reader] Loading panels for:', chapterUrl);
      const urls = await BatotoService.getChapterPanels(chapterUrl);
      console.log('[Reader] Received panels:', urls.length);
      setPanels(urls);
      
      if (manga) {
        const savedPosition = await StorageService.getReaderPositionForManga(manga.id);
        const normalizedSavedUrl = savedPosition?.chapterUrl.replace(/\/$/, '');
        const normalizedCurrentUrl = chapterUrl.replace(/\/$/, '');

        if (savedPosition && normalizedSavedUrl === normalizedCurrentUrl) {
           const restoredPage = Math.min(savedPosition.panelIndex, urls.length - 1);
           console.log('[Reader] Found position to restore:', restoredPage);
           setCurrentPage(restoredPage);
           setRestoredPageIndex(restoredPage);
        } else {
           console.log('[Reader] No matching position found for this chapter');
           setCurrentPage(0);
           setRestoredPageIndex(0);
        }
      }

      // Small delay to let the list / pager initialize before we allow saves
      setTimeout(() => {
        setPositionRestored(true);
        setIsRestoring(false);
        setLoading(false);
        console.log('[Reader] Restoration window closed. Tracking active.');
      }, 100);
    };
    loadPanels();
  }, [chapterUrl, manga?.id]);

  const handleTouchStart = (e: any) => {
    setTouchStartX(e.detail.touches[0].clientX);
  };

  const handleTouchEnd = (e: any) => {
    const touchEndX = e.detail.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const threshold = 50; // pixels

    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0 && currentPage < panels.length - 1) {
        console.log('[Reader] Swipe Left detected');
        setCurrentPage((prev) => prev + 1);
      } else if (deltaX > 0 && currentPage > 0) {
        console.log('[Reader] Swipe Right detected');
        setCurrentPage((prev) => prev - 1);
      }
    }
  };

  const goToPage = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 0 && newPage < panels.length) {
      setCurrentPage(newPage);
    }
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const scrollDown = () => {
    // For vertical mode, we want to scroll down exactly one viewport height
    const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime) {
      // SystemInfo dimensions are typically physical pixels, but scrollBy expects logical units (px/dp)
      const si = (globalThis as any).SystemInfo || (typeof SystemInfo !== 'undefined' ? SystemInfo : null);
      const pixelRatio = si?.pixelRatio || 1;
      const screenHeightLogical = si?.screenHeight ? (si.screenHeight / pixelRatio) : 800;
      const scrollDistance = Math.floor(screenHeightLogical * 0.1); // Scroll 10% of logical screen per press
      
      console.log(`[Reader] Scroll DOWN: screenH=${si?.screenHeight}, pixelRatio=${pixelRatio}, logicalH=${screenHeightLogical}, dist=${scrollDistance}`);
      
      runtime.createSelectorQuery()
        .select('#reader-list')
        .invoke({
          method: 'scrollBy',
          params: {
            offset: scrollDistance,
            animated: true
          }
        })
        .exec();
    }
  };

  const scrollUp = () => {
    const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime) {
      const si = (globalThis as any).SystemInfo || (typeof SystemInfo !== 'undefined' ? SystemInfo : null);
      const pixelRatio = si?.pixelRatio || 1;
      const screenHeightLogical = si?.screenHeight ? (si.screenHeight / pixelRatio) : 800;
      const scrollDistance = Math.floor(screenHeightLogical * 0.1);

      console.log(`[Reader] Scroll UP: screenH=${si?.screenHeight}, pixelRatio=${pixelRatio}, logicalH=${screenHeightLogical}, dist=${scrollDistance}`);

      runtime.createSelectorQuery()
        .select('#reader-list')
        .invoke({
          method: 'scrollBy',
          params: {
            offset: -scrollDistance,
            animated: true
          }
        })
        .exec();
    }
  };

  const handleKeyDown = (e: any) => {
    // Throttle key events significantly to prevent over-scrolling/rapid page turns
    // HID rings often send many repeat events or have high sensitivity
    const now = Date.now();
    if (now - lastKeyDownTime.current < 800) {
      console.log('[Reader] Throttling KeyDown (800ms debounce)');
      return;
    }
    lastKeyDownTime.current = now;

    const keyCode = e.detail?.keyCode || e.keyCode;
    console.log('[Reader] KeyDown:', keyCode);

    switch (keyCode) {
      case 19: // DPAD_UP
      case 21: // DPAD_LEFT
      case 24: // VOLUME_UP
        if (readingMode === 'vertical') {
          scrollUp();
        } else {
          goToPage(-1);
        }
        break;
      case 20: // DPAD_DOWN
      case 22: // DPAD_RIGHT
      case 25: // VOLUME_DOWN
        if (readingMode === 'vertical') {
          scrollDown();
        } else {
          goToPage(1);
        }
        break;
      case 23: // DPAD_CENTER
      case 66: // ENTER
        toggleControls();
        break;
    }
  };

  // Save position when page changes (debounced)
  useEffect(() => {
    // CRITICAL: Block all saves until we are 100% sure we are in "tracking" mode
    if (isRestoring || !positionRestored || !manga || loading || panels.length === 0) return;

    const timeoutId = setTimeout(() => {
      console.log('[Reader] SYNCING: Saving current position:', currentPage);
      StorageService.saveReaderPosition(manga.id, chapterUrl, currentPage);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [currentPage, manga, chapterUrl, loading, panels.length, positionRestored, isRestoring]);

  const handleToggleFavorite = async () => {
    if (!manga) return;
    if (isFavorite) {
      await StorageService.removeFavorite(manga.id);
      setIsFavorite(false);
    } else {
      await StorageService.addFavorite(manga);
      setIsFavorite(true);
    }
  };

  return (
    <view 
      className="Reader" 
      bindtap={!remoteMode ? toggleControls : undefined}
      bindkeydown={handleKeyDown}
      focusable={true}
      focus-index="0"
    >
      <view className={showControls ? "Reader-header" : "Reader-header hidden"}>
        <view className="Reader-header-left" bindtap={onBack}>
          <text className="Reader-back">{'‹ Back'}</text>
        </view>

        <view className="Reader-header-center">
          <text className="Reader-header-title">
            {chapterTitle || 'Reading Chapter'}
          </text>
          <text className="Reader-header-subtitle">
            {readingMode === 'horizontal'
              ? `Panel ${currentPage + 1} of ${panels.length}`
              : `${panels.length} panels total`}
          </text>
        </view>

        <view className="Reader-header-right" bindtap={handleToggleFavorite}>
          <text className="Reader-favorite-btn">{isFavorite ? '❤️' : '🤍'}</text>
        </view>
      </view>

      {readingMode === 'vertical' ? (
        // Vertical scroll mode (Webtoon)
        <list 
          id="reader-list"
          className="Reader-content" 
          scroll-y 
          initial-scroll-index={restoredPageIndex}
        >
          {loading ? (
            <list-item item-key="loading" full-span>
              <view className="Reader-loading-container">
                <text className="Reader-loading">Loading panels...</text>
              </view>
            </list-item>
          ) : panels.length === 0 ? (
            <list-item item-key="empty" full-span>
              <view className="Reader-loading-container">
                <text className="Reader-loading">No panels found</text>
              </view>
            </list-item>
          ) : (
            [
              ...panels.map((url, index) => (
                <list-item
                  key={`panel-${index}`}
                  item-key={`panel-${index}`}
                  full-span
                  binduiappear={() => {
                    // Only update currentPage if we are NOT in the middle of restoration
                    if (!isRestoring && !loading && positionRestored) {
                      setCurrentPage(index);
                    }
                  }}
                >
                  <ReaderPanel url={url} index={index} />
                </list-item>
              )),
              ...(hasNextChapter && onNextChapter
                ? [
                    <list-item
                      key="next-chapter"
                      item-key="next-chapter"
                      full-span
                    >
                      <view className="Reader-footer-nav">
                        <view
                          className="Reader-next-btn"
                          bindtap={onNextChapter}
                        >
                          <text className="Reader-next-text">
                            Next Chapter ›
                          </text>
                        </view>
                      </view>
                    </list-item>,
                  ]
                : []),
            ]
          )}
        </list>
      ) : (
        // Horizontal swipe mode (Manga)
        <view 
          className="Reader-horizontal-container"
          bindtouchstart={handleTouchStart}
          bindtouchend={handleTouchEnd}
          bindtap={!remoteMode ? toggleControls : undefined}
        >
          {loading ? (
            <view className="Reader-loading-container">
              <text className="Reader-loading">Loading panels...</text>
            </view>
          ) : panels.length === 0 ? (
            <view className="Reader-loading-container">
              <text className="Reader-loading">No panels found</text>
            </view>
          ) : (
            <>
              <HorizontalPanel url={panels[currentPage]} index={currentPage} />

              {/* Navigation buttons: hidden in remoteMode unless controls are shown */}
              {(!remoteMode || showControls) && (
                <view className="Reader-nav-buttons">
                  <view
                    className={
                      currentPage > 0
                        ? 'Reader-nav-btn'
                        : 'Reader-nav-btn disabled'
                    }
                    bindtap={() => goToPage(-1)}
                  >
                    <text className="Reader-nav-text">‹ Prev</text>
                  </view>

                  {currentPage < panels.length - 1 ? (
                    <view className="Reader-nav-btn" bindtap={() => goToPage(1)}>
                      <text className="Reader-nav-text">Next ›</text>
                    </view>
                  ) : hasNextChapter && onNextChapter ? (
                    <view className="Reader-next-btn" bindtap={onNextChapter}>
                      <text className="Reader-next-text">Next Chapter ›</text>
                    </view>
                  ) : (
                    <view className="Reader-nav-btn disabled">
                      <text className="Reader-nav-text">Next ›</text>
                    </view>
                  )}
                </view>
              )}
            </>
          )}
        </view>
      )}

      {/* Tap Zones for Remote Mode */}
      {remoteMode && (
        <view className="Reader-tap-zones">
          <view className="Reader-tap-zone prev" bindtap={() => goToPage(-1)} />
          <view className="Reader-tap-zone center" bindtap={toggleControls} />
          <view className="Reader-tap-zone next" bindtap={readingMode === 'vertical' ? scrollDown : () => goToPage(1)} />
        </view>
      )}
    </view>
  );
}
