import { memo, useMemo, type ReactNode } from 'react';
import { Tabs } from 'antd';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { SponsorUiState } from '../uiStore';

export type SponsorTabsProps = {
  t: (key: string, options?: any) => string;
  uiStore: UseBoundStore<StoreApi<SponsorUiState>>;
  onTabChange: (key: string) => void;
  editor: JSX.Element;
  history: JSX.Element;
  rightContent?: ReactNode;
};

const SponsorTabs = memo(function SponsorTabs({
  t,
  uiStore,
  onTabChange,
  editor,
  history,
  rightContent,
}: SponsorTabsProps) {
  const activeTab = uiStore(state => state.activeTab);

  const tabItems = useMemo(
    () => [
      {
        key: 'editor',
        label: t('taskrouter.tab.editor', { defaultValue: 'Run' }),
        children: editor,
      },
      {
        key: 'history',
        label: t('taskrouter.tab.history', { defaultValue: 'History' }),
        children: history,
      },
    ],
    [t, editor, history]
  );

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      items={tabItems}
      tabBarExtraContent={rightContent}
    />
  );
});

export default SponsorTabs;
