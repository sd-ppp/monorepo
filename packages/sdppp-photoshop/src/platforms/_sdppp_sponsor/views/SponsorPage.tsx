import { Flex, Skeleton, Typography } from 'antd';
import { memo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { SponsorAuthState } from './auth/authStore';
import type { SponsorUiState } from './uiStore';

const { Text } = Typography;

export type SponsorPageProps = {
  t: (key: string, options?: any) => string;
  hasClient: boolean;
  authStore: UseBoundStore<StoreApi<SponsorAuthState>>;
  uiStore: UseBoundStore<StoreApi<SponsorUiState>>;
  header: JSX.Element;
  tabs: JSX.Element;
};

const SponsorPage = memo(function SponsorPage({ t, hasClient, authStore, uiStore, header, tabs }: SponsorPageProps) {
  const authLoading = authStore(state => state.authLoading);
  const initialized = uiStore(state => state.initialized);

  return (
    <Flex vertical gap={12} style={{ width: '100%' }}>
      {!hasClient ? (
        <Text>{t('auth.login_hint', { defaultValue: 'Please click Login in the top-right corner.' })}</Text>
      ) : (
        <>
          {!initialized || authLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : null}
          {header}
          {tabs}
        </>
      )}
    </Flex>
  );
});

export default SponsorPage;
