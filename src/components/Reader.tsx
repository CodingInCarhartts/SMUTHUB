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
      const urls = await BatotoService.getChapterPanels(chapterUrl);
      setPanels(urls);
      setLoading(false);
    };
    loadPanels();
  }, [chapterUrl]);

  return (
    <view className="Reader">
      <view className="Reader-header">
        <text className="Reader-back" bindtap={onBack}>{"< Back"}</text>
      </view>
      <scroll-view className="Reader-content" scroll-y>
        {loading ? (
          <text className="Reader-loading">Loading panels...</text>
        ) : (
          panels.map((url, index) => (
            <image 
              key={`${url}-${index}`} 
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
