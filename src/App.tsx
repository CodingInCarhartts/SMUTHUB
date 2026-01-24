import { useState } from '@lynx-js/react';
import { sourceManager } from './services/sourceManager';

export function App() {
  const [status, setStatus] = useState('Idle');
  const [data, setData] = useState<string>('');

  const runFetch = async () => {
    setStatus('Fetching...');
    try {
      const source = sourceManager.getSource('mangapark');
      if (!source) throw new Error('No source');
      const feed = await source.getHomeFeed();
      setData(`Success! Popular: ${feed.popular.length}, Latest: ${feed.latest.length}`);
      setStatus('Done');
    } catch (e: any) {
      setData('Error: ' + e.message);
      setStatus('Error');
    }
  };

  return (
    <view className="Main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a', padding: '20px' }}>
      <text style={{ fontSize: '20px', color: '#ff4d4f', marginBottom: '20px' }}>DIAGNOSTIC 1.0.199</text>
      
      <text style={{ color: 'white', marginBottom: '20px' }}>Mangago: DISABLED</text>
      <text style={{ color: 'white', marginBottom: '20px' }}>Init Logs: DISABLED</text>
      <text style={{ color: 'white', marginBottom: '20px' }}>Status: {status}</text>
      
      <view 
        bindtap={runFetch}
        style={{ padding: '15px', backgroundColor: '#ee5566', borderRadius: '8px', marginBottom: '20px' }}
      >
        <text style={{ color: 'white', fontWeight: 'bold' }}>TEST NETWORK FETCH</text>
      </view>

      <scroll-view scroll-y style={{ height: '200px', width: '100%', backgroundColor: '#333' }}>
        <text style={{ color: '#ccc', fontSize: '12px' }}>{data || 'No data yet'}</text>
      </scroll-view>
    </view>
  );
}
