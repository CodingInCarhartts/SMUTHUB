import { useEffect, useState } from '@lynx-js/react';
import { BatotoService } from '../services/batoto';
import { SettingsStore, type ReadingMode } from '../services/settings';
import './Reader.css';

interface Props {
  chapterUrl: string;
  onBack: () => void;
  hasNextChapter?: boolean;
  onNextChapter?: () => void;
}

function ReaderPanel({ url, index }: { url: string; index: number }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const MAX_RETRIES = 5;

  const currentUrl = retryCount > 0 
    ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : url;

  useEffect(() => {
    console.log(`[ReaderPanel #${index}] URL: ${url} (retry: ${retryCount})`);
  }, [url, index, retryCount]);

  const handleLoad = (e: any) => {
    const { width, height } = e.detail;
    const calcRatio = width / height;
    console.log(`[ReaderPanel #${index}] LOADED: ${width}x${height} (ratio: ${calcRatio.toFixed(3)})`);
    if (width && height) {
      setRatio(calcRatio);
      setFailed(false);
    }
  };

  const handleError = (e: any) => {
    console.error(`[ReaderPanel #${index}] ERROR (attempt ${retryCount + 1}/${MAX_RETRIES}):`, e.detail?.errMsg);
    if (retryCount < MAX_RETRIES - 1) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 500 + (index % 5) * 200);
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
    <view className="Reader-panel-wrapper" style={{ 
      aspectRatio: displayRatio,
      backgroundColor: ratio ? 'transparent' : '#1a1a1a',
      minHeight: ratio ? 'auto' : '400px',
    }}>
      {failed ? (
        <view className="Reader-panel-error" bindtap={handleRetryTap}>
          <text className="Reader-panel-error-text">Failed to load - Tap to retry</text>
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
            height: '100%'
          }}
        />
      )}
      {!ratio && !failed && (
        <view className="Reader-panel-loader">
          <text className="Reader-panel-loader-text">
            {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})...` : 'Loading...'}
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

  const currentUrl = retryCount > 0 
    ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : url;

  const handleError = () => {
    if (retryCount < MAX_RETRIES - 1) {
      setTimeout(() => setRetryCount(prev => prev + 1), 500);
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

export function Reader({ chapterUrl, onBack, hasNextChapter, onNextChapter }: Props) {
  const [panels, setPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>(SettingsStore.getReadingMode());
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      setReadingMode(SettingsStore.getReadingMode());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadPanels = async () => {
      setLoading(true);
      console.log('[Reader] Loading panels for:', chapterUrl);
      const urls = await BatotoService.getChapterPanels(chapterUrl);
      console.log('[Reader] Received panels:', urls.length, 'First:', urls[0]);
      setPanels(urls);
      setLoading(false);
    };
    loadPanels();
  }, [chapterUrl]);

  const handleSwipeEnd = (e: any) => {
    // Handle horizontal swipe navigation
    const direction = e.detail?.direction;
    if (direction === 'left' && currentPage < panels.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else if (direction === 'right' && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToPage = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 0 && newPage < panels.length) {
      setCurrentPage(newPage);
    }
  };

  return (
    <view className="Reader">
      <view className="Reader-header">
        <text className="Reader-back" bindtap={onBack}>{"< Back"}</text>
        <text className="Reader-title">
          {readingMode === 'horizontal' ? `${currentPage + 1}/${panels.length}` : `${panels.length} panels`}
        </text>
        <text className="Reader-mode-indicator">
          {readingMode === 'vertical' ? '📜' : '📖'}
        </text>
      </view>

      {readingMode === 'vertical' ? (
        // Vertical scroll mode (Webtoon)
        <list className="Reader-content" scroll-y>
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
                <list-item key={`panel-${index}`} item-key={`panel-${index}`} full-span>
                  <ReaderPanel url={url} index={index} />
                </list-item>
              )),
              hasNextChapter && onNextChapter && (
                <list-item key="next-chapter" item-key="next-chapter" full-span>
                  <view className="Reader-footer-nav">
                    <view className="Reader-next-btn" bindtap={onNextChapter}>
                      <text className="Reader-next-text">Next Chapter ›</text>
                    </view>
                  </view>
                </list-item>
              )
            ]
          )}
        </list>
      ) : (
        // Horizontal swipe mode (Manga)
        <view className="Reader-horizontal-container">
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
              
              {/* Navigation buttons */}
              <view className="Reader-nav-buttons">
                <view 
                  className={currentPage > 0 ? "Reader-nav-btn" : "Reader-nav-btn disabled"} 
                  bindtap={() => goToPage(-1)}
                >
                  <text className="Reader-nav-text">‹ Prev</text>
                </view>

                {currentPage < panels.length - 1 ? (
                  <view className="Reader-nav-btn" bindtap={() => goToPage(1)}>
                    <text className="Reader-nav-text">Next ›</text>
                  </view>
                ) : hasNextChapter && onNextChapter ? (
                  <view className="Reader-nav-btn" style={{ background: '#34c759' }} bindtap={onNextChapter}>
                    <text className="Reader-nav-text">Next Chapter ›</text>
                  </view>
                ) : (
                  <view className="Reader-nav-btn disabled">
                    <text className="Reader-nav-text">Next ›</text>
                  </view>
                )}
              </view>
            </>
          )}
        </view>
      )}
    </view>
  );
}
