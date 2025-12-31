import { useEffect, useState, useRef } from '@lynx-js/react';
import { BatotoService, type Manga } from '../services/batoto';
import { SettingsStore } from '../services/settings';
import { StorageService, normalizeUrl } from '../services/storage';
import { logCapture } from '../services/debugLog';
import {
  DEFAULT_ASPECT_RATIO,
  BG_COLOR_DARK,
  MIN_PANEL_HEIGHT,
  PANEL_MAX_RETRIES,
  RETRY_DELAY_BASE,
  RETRY_DELAY_INCREMENT,
  KEY_DEBOUNCE_MS,
  REMOTE_TOUCH_DIVIDER_X,
  SWIPE_THRESHOLD_PX
} from '../config';
import './Reader.css';

// Helper for debug logging
const log = (...args: any[]) => logCapture('log', ...args);
const logError = (...args: any[]) => logCapture('error', ...args);

// Log immediately when Reader module loads
log('[Reader] ========== READER MODULE LOADED ==========');

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

  const currentUrl =
    retryCount > 0
      ? `${url}${url.includes('?') ? '&' : '?'}retry=${retryCount}`
      : url;

  useEffect(() => {
    log(`[ReaderPanel #${index}] URL: ${url} (retry: ${retryCount})`);
  }, [url, index, retryCount]);

  const handleLoad = (e: any) => {
    const { width, height } = e.detail;
    const calcRatio = width / height;
    log(
      `[ReaderPanel #${index}] LOADED: ${width}x${height} (ratio: ${calcRatio.toFixed(3)})`,
    );
    if (width && height) {
      setRatio(calcRatio);
      setFailed(false);
    }
  };

  const handleError = (e: any) => {
    logError(
      `[ReaderPanel #${index}] ERROR (attempt ${retryCount + 1}/${PANEL_MAX_RETRIES}):`,
      e.detail?.errMsg,
    );
    if (retryCount < PANEL_MAX_RETRIES - 1) {
      setTimeout(
        () => {
          setRetryCount((prev) => prev + 1);
        },
        RETRY_DELAY_BASE + (index % 5) * RETRY_DELAY_INCREMENT,
      );
    } else {
      setFailed(true);
    }
  };

  const handleRetryTap = () => {
    if (retryCount >= PANEL_MAX_RETRIES - 1) {
      setRetryCount(0);
      setFailed(false);
    }
  };

  const displayRatio = ratio ? `${ratio}` : `${DEFAULT_ASPECT_RATIO}`;

  return (
    <view
      className="Reader-panel-wrapper"
      style={{
        aspectRatio: displayRatio,
        backgroundColor: ratio ? 'transparent' : BG_COLOR_DARK,
        minHeight: ratio ? 'auto' : MIN_PANEL_HEIGHT,
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
              ? `Retrying (${retryCount}/${PANEL_MAX_RETRIES})...`
              : 'Loading...'}
          </text>
        </view>
      )}
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
  log('[Reader] COMPONENT RENDERING - chapterUrl:', chapterUrl?.substring(0, 50));

  const [panels, setPanels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0); // In vertical mode, specific page tracking is less precise but used for restoration
  const [restoredPageIndex, setRestoredPageIndex] = useState<number | undefined>(undefined);
  const [positionRestored, setPositionRestored] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isFavorite, setIsFavorite] = useState(() =>
    manga ? StorageService.isFavoriteSync(manga.id) : false,
  );
  const [showControls, setShowControls] = useState(true);
  const lastKeyDownTime = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = SettingsStore.subscribe(() => {
      // Just for scroll speed or other future settings
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadPanels = async () => {
      setLoading(true);
      setIsRestoring(true);
      log('[Reader] Loading panels for:', chapterUrl);
      const urls = await BatotoService.getChapterPanels(chapterUrl);
      log('[Reader] Received panels:', urls.length);
      setPanels(urls);

      if (manga) {
        const savedPosition = await StorageService.getReaderPositionForManga(manga.id);

        if (savedPosition && normalizeUrl(savedPosition.chapterUrl) === normalizeUrl(chapterUrl)) {
          const restoredPage = Math.min(savedPosition.panelIndex, urls.length - 1);
          log('[Reader] Found position to restore:', restoredPage);
          setCurrentPage(restoredPage);
          setRestoredPageIndex(restoredPage);
        } else {
          log('[Reader] No matching position found for this chapter');
          setCurrentPage(0);
          setRestoredPageIndex(0);
        }
      }

      // Small delay to let the list / pager initialize before we allow saves
      setTimeout(() => {
        setPositionRestored(true);
        setIsRestoring(false);
        setLoading(false);
        log('[Reader] Restoration window closed. Tracking active.');
      }, 100);
    };
    loadPanels();
  }, [chapterUrl, manga?.id]);

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const scrollDown = (intensity = 1.0) => {
    // For vertical mode, we want to scroll down exactly one viewport height
    const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime) {
      // SystemInfo dimensions are typically physical pixels, but scrollBy expects logical units (px/dp)
      const si = (globalThis as any).SystemInfo || (typeof SystemInfo !== 'undefined' ? SystemInfo : null);
      const pixelRatio = si?.pixelRatio || 1;
      const screenHeightLogical = si?.screenHeight ? (si.screenHeight / pixelRatio) : 800;
      
      // Use user setting, but scale by intensity (e.g. 0.25 for keys => 15% screen)
      const baseSpeed = SettingsStore.getScrollSpeed();
      const scrollDistance = Math.floor(screenHeightLogical * baseSpeed * intensity);

      log(`[Reader] Scroll DOWN: speed=${baseSpeed}, intensity=${intensity}, dist=${scrollDistance}`);

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

  const scrollUp = (intensity = 1.0) => {
    const runtime = typeof lynx !== 'undefined' ? lynx : (globalThis as any).lynx;
    if (runtime) {
      const si = (globalThis as any).SystemInfo || (typeof SystemInfo !== 'undefined' ? SystemInfo : null);
      const pixelRatio = si?.pixelRatio || 1;
      const screenHeightLogical = si?.screenHeight ? (si.screenHeight / pixelRatio) : 800;
      
      const baseSpeed = SettingsStore.getScrollSpeed();
      const scrollDistance = Math.floor(screenHeightLogical * baseSpeed * intensity);

      log(`[Reader] Scroll UP: speed=${baseSpeed}, intensity=${intensity}, dist=${scrollDistance}`);

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
    const now = Date.now();
    if (now - lastKeyDownTime.current < KEY_DEBOUNCE_MS) {
      log(`[Reader] Throttling KeyDown (${KEY_DEBOUNCE_MS}ms debounce)`);
      return;
    }
    lastKeyDownTime.current = now;

    // Handle both event structures (native override vs standard bindkeydown)
    const keyCode = e.keyCode || e.detail?.keyCode;
    log(`[Reader] KeyDown: ${keyCode}`);

    switch (keyCode) {
      case 19: // DPAD_UP
      case 21: // DPAD_LEFT
      case 24: // VOLUME_UP
        scrollUp(0.25); // 25% of normal speed (simulates lerp/smooth scroll)
        break;
      case 20: // DPAD_DOWN
      case 22: // DPAD_RIGHT
      case 25: // VOLUME_DOWN
        scrollDown(0.25); // 25% of normal speed
        break;
      case 23: // DPAD_CENTER
      case 66: // ENTER
      case 62: // SPACE
        toggleControls();
        break;
    }
  };

  // Listen for Native GlobalKeyEvents (from MainActivity.kt)
  useEffect(() => {
    log('[Reader] Setting up global event listeners...');

    // Get GlobalEventEmitter from Lynx
    let globalEventEmitter: any = null;
    try {
      if (typeof lynx !== 'undefined' && (lynx as any).getJSModule) {
        globalEventEmitter = (lynx as any).getJSModule('GlobalEventEmitter');
        log('[Reader] GlobalEventEmitter obtained:', !!globalEventEmitter);
      } else {
        log('[Reader] lynx.getJSModule not available');
      }
    } catch (e: any) {
      logError('[Reader] Failed to get GlobalEventEmitter:', e?.message);
    }

    const onGlobalKey = (data: any) => {
      log('[Reader] GlobalKeyEvent received:', JSON.stringify(data));

      // Handle both cases: data is the raw payload, or it's wrapped in an event object
      const payload = data?.data || data;
      let keyCode: number | undefined;

      if (Array.isArray(payload) && payload.length > 0) {
        keyCode = payload[0].keyCode;
      } else if (payload && typeof payload === 'object') {
        keyCode = payload.keyCode;
      } else if (typeof payload === 'number') {
        keyCode = payload;
      }

      if (keyCode) {
        log('[Reader] Processing Key:', keyCode);
        handleKeyDown({ keyCode });
      }
    };


    // Try to register with GlobalEventEmitter (correct Lynx API)
    if (globalEventEmitter && globalEventEmitter.addListener) {
      try {
        log('[Reader] Using GlobalEventEmitter.addListener...');
        globalEventEmitter.addListener('GlobalKeyEvent', onGlobalKey);
        // Removed GlobalTouchEvent listener to prevent conflict with screen touches
        log('[Reader] GlobalKeyEvent registered via GlobalEventEmitter!');
      } catch (e: any) {
        logError('[Reader] GlobalEventEmitter.addListener failed:', e?.message);
      }
    } else {
      log('[Reader] GlobalEventEmitter not available, trying lynx.on fallback...');
      // Fallback to lynx.on (older API)
      try {
        if (typeof lynx !== 'undefined' && (lynx as any).on) {
          (lynx as any).on('GlobalKeyEvent', onGlobalKey);
          // Removed GlobalTouchEvent listener
          log('[Reader] Registered via lynx.on fallback');
        } else {
          logError('[Reader] No event listening API available!');
        }
      } catch (e: any) {
        logError('[Reader] lynx.on fallback failed:', e?.message);
      }
    }

    return () => {
      if (globalEventEmitter && globalEventEmitter.removeListener) {
        globalEventEmitter.removeListener('GlobalKeyEvent', onGlobalKey);
      } else if (typeof lynx !== 'undefined' && (lynx as any).off) {
        (lynx as any).off('GlobalKeyEvent', onGlobalKey);
      }
    };
  }, [currentPage, panels.length]);

  // Save position when page changes (debounced)
  useEffect(() => {
    // CRITICAL: Block all saves until we are 100% sure we are in "tracking" mode
    if (isRestoring || !positionRestored || !manga || loading || panels.length === 0) return;

    const timeoutId = setTimeout(() => {
      log('[Reader] SYNCING: Saving current position:', currentPage);
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
      bindtap={toggleControls}
      bindkeydown={handleKeyDown}
      focusable={true}
      focus-index="0"
    >
      <view className={showControls ? "Reader-header" : "Reader-header hidden"}>
        <view
          className="Reader-header-left"
          bindtap={onBack}
          style={{ padding: '10px 20px 10px 0' }}
        >
          {/* Expanded hit target */}
          <text className="Reader-back">{'‹ Back'}</text>
        </view>

        <view className="Reader-header-center">
          <text className="Reader-header-title">
            {chapterTitle || 'Reading Chapter'}
          </text>
          <text className="Reader-header-subtitle">
            {`${panels.length} panels total`}
          </text>
        </view>

        <view
          className="Reader-header-right"
          bindtap={handleToggleFavorite}
          style={{ padding: '10px 0 10px 20px' }}
        >
          {/* Expanded hit target */}
          <text className="Reader-back">{isFavorite ? '❤️' : '🤍'}</text>
        </view>
      </view>

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
    </view>
  );
}
