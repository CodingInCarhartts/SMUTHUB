// Direct Poison Test: node-html-parser
import { useState, useEffect } from '@lynx-js/react';
import { parse } from 'node-html-parser';

export function App() {
  const [status, setStatus] = useState('Idle');

  useEffect(() => {
    try {
        console.log("Testing parser...");
        const root = parse('<div id="test">Hello</div>');
        console.log("Parser result:", root.querySelector('#test')?.text);
        setStatus('Parser Loaded OK');
    } catch(e: any) {
        console.error("Parser Died:", e);
        setStatus('Parser Crashed: ' + e.message);
    }
  }, []);

  return (
    <view className="Main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a' }}>
      <text style={{ fontSize: '24px', color: '#ff4d4f', marginBottom: '10px' }}>PARSER TEST 1.0.196</text>
      <text style={{ fontSize: '14px', color: '#ccc' }}>Is node-html-parser safety?</text>
      
      <view style={{ marginTop: '30px', padding: '20px', backgroundColor: '#ee5566', borderRadius: '10px' }}>
        <text style={{ color: 'white', fontWeight: 'bold' }}>{status}</text>
      </view>
    </view>
  );
}
