import { useState } from '@lynx-js/react';
import './App.css';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <view className="Main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <text style={{ fontSize: '30px', color: '#ff4d4f', marginBottom: '20px' }}>STABILITY TEST</text>
      <text style={{ fontSize: '18px', color: '#333' }}>If you can see this and the counter works, the app is stable.</text>
      
      <view 
        style={{ marginTop: '40px', padding: '20px', backgroundColor: '#ee5566', borderRadius: '10px' }}
        bindtap={() => setCount(count + 1)}
      >
        <text style={{ color: 'white', fontWeight: 'bold' }}>Counter: {count}</text>
      </view>

      <text style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>Click the button to verify state reactivity.</text>
    </view>
  );
}
