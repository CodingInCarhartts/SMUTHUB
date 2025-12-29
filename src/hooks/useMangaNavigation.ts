import { useCallback, useState } from '@lynx-js/react';

export type Tab = 'home' | 'search' | 'settings';
export type ViewState = 'browse' | 'details' | 'reader';
export type SettingsSubview = 'main' | 'favorites' | 'history';

export function useMangaNavigation() {
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<ViewState>('browse');
  const [settingsSubview, setSettingsSubview] =
    useState<SettingsSubview>('main');

  const navigateToDetails = useCallback(() => {
    setView('details');
    setSettingsSubview('main');
  }, []);

  const navigateToReader = useCallback(() => {
    setView('reader');
  }, []);

  const navigateBack = useCallback(
    (onReaderExit?: () => void) => {
      if (view === 'reader') {
        setView('details');
        onReaderExit?.();
      } else if (view === 'details') {
        setView('browse');
      }
    },
    [view],
  );

  const changeTab = useCallback((newTab: Tab, onHomeTab?: () => void) => {
    setTab(newTab);
    setView('browse');
    if (newTab === 'home') {
      onHomeTab?.();
    }
  }, []);

  return {
    tab,
    setTab,
    view,
    setView,
    settingsSubview,
    setSettingsSubview,
    navigateToDetails,
    navigateToReader,
    navigateBack,
    changeTab,
  };
}
