import { useEffect, useState } from '@lynx-js/react';
import { BatotoService } from '../services/batoto';
import './Reader.css';

interface Props {
  chapterUrl: string;
  onBack: () => void;
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
      <scroll-view className="Reader-content" scroll-y>
        {loading ? (
          <view className="Reader-loading-container">
            <text className="Reader-loading">Loading panels...</text>
          </view>
        ) : panels.length === 0 ? (
          <view className="Reader-loading-container">
            <text className="Reader-loading">No panels found</text>
          </view>
        ) : (
          panels.map((url, index) => (
            <image 
              key={`panel-${index}`} 
              src={url} 
              className="Reader-panel" 
              mode="aspectFit"
            />
          ))
        )}
      </scroll-view>
    </view>
  );
}

