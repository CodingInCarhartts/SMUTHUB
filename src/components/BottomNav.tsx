import { useState } from '@lynx-js/react';
import './BottomNav.css';

type Tab = 'home' | 'search';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <view className="BottomNav">
      <view 
        className={activeTab === 'home' ? "BottomNav-tab active" : "BottomNav-tab"} 
        bindtap={() => onTabChange('home')}
      >
        <text className="BottomNav-icon">🏠</text>
        <text className="BottomNav-label">Home</text>
      </view>
      <view 
        className={activeTab === 'search' ? "BottomNav-tab active" : "BottomNav-tab"} 
        bindtap={() => onTabChange('search')}
      >
        <text className="BottomNav-icon">🔍</text>
        <text className="BottomNav-label">Search</text>
      </view>
    </view>
  );
}
