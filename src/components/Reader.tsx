import { useEffect, useState } from '@lynx-js/react';
import { BatotoService } from '../services/batoto';
import './Reader.css';

interface Props {
  chapterUrl: string;
  onBack: () => void;
}


function ReaderPanel({ url, index }: { url: string; index: number }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const MAX_RETRIES = 5;

  // Add cache-busting parameter on retry
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
      // Retry after a delay (staggered based on index to avoid thundering herd)
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

export function Reader({ chapterUrl, onBack }: Props) {
  const [panels, setPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <view className="Reader">
      <view className="Reader-header">
        <text className="Reader-back" bindtap={onBack}>{"< Back"}</text>
        <text className="Reader-title">{panels.length} panels</text>
      </view>
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
          panels.map((url, index) => (
            <list-item key={`panel-${index}`} item-key={`panel-${index}`} full-span>
               <ReaderPanel url={url} index={index} />
            </list-item>
          ))
        )}
      </list>
    </view>
  );
}

