import { useCallback } from 'react';
import { sponsorUiStore } from './uiStore';

export const useSponsorTabs = () => {
  const setActiveTab = sponsorUiStore(state => state.setActiveTab);
  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key as 'editor' | 'history');
    },
    [setActiveTab]
  );

  return { handleTabChange };
};
