import { useEffect, useState } from '@lynx-js/react';
import { BatotoService } from '../services/batoto';
import './Reader.css';

interface Props {
  chapterUrl: string;
  onBack: () => void;
}


function ReaderPanel({ url }: { url: string }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);

  const handleLoad = (e: any) => {
    const { width, height } = e.detail;
    console.log(`[ReaderPanel] Loaded: ${width}x${height}`);
    if (width && height) {
      setRatio(width / height);
    }
  };

  return (
    <image 
      src={url} 
      className="Reader-panel" 
      mode="scaleToFill"
      bindload={handleLoad}
      style={{ 
        aspectRatio: ratio ? `${ratio}` : '0.75',
        minHeight: ratio ? 'auto' : '200px'
      }}
    />
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
      console.log('[Reader] Received panels:', urls.length, 'First URL:', urls[0]?.substring(0, 50));
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
               <ReaderPanel url={url} />
            </list-item>
          ))
        )}
      </list>
    </view>
  );
}

