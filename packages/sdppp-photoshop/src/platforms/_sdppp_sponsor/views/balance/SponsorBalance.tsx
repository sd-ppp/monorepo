import { memo, useState } from 'react';
import { Button, Flex, Typography } from 'antd';
import { useStore } from 'zustand';
import type { UseBoundStore, StoreApi } from 'zustand';
import { RotateCcw } from 'lucide-react';
import type { SponsorUiState } from '../uiStore';

const { Text } = Typography;

export type SponsorBalanceProps = {
  t: (key: string, options?: any) => string;
  balanceStore: StoreApi<{ balance: number | null }>;
  uiStore: UseBoundStore<StoreApi<SponsorUiState>>;
  rechargeUrl?: string | null;
  onOpenRecharge: () => void;
  onRefreshBalance: () => Promise<void> | void;
};

const SponsorBalance = memo(function SponsorBalance({
  t,
  balanceStore,
  uiStore,
  rechargeUrl,
  onOpenRecharge,
  onRefreshBalance,
}: SponsorBalanceProps) {
  const balance = useStore(balanceStore, state => state.balance);
  const loadingBalance = uiStore(state => state.balanceLoading);
  const [isHovering, setIsHovering] = useState(false);

  return (
    <Flex align="center" gap={12}>
      <Flex
        align="center"
        gap={4}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {isHovering ? (
          <Button
            type="text"
            size="small"
            icon={<RotateCcw size={12} />}
            onClick={() => onRefreshBalance()}
            loading={loadingBalance}
            title={t('taskrouter.refresh_balance', { defaultValue: 'Refresh balance' })}
            style={{ padding: 0, minWidth: 0, height: 'auto' }}
          />
        ) : null}
        <Text type="secondary">
          {t('taskrouter.balance', { defaultValue: 'Balance' })}: {loadingBalance ? '...' : balance ?? '--'}
        </Text>
      </Flex>
      {rechargeUrl ? (
        <Button type="text" size="small" onClick={onOpenRecharge}>
          {t('taskrouter.recharge', { defaultValue: 'Recharge' })}
        </Button>
      ) : null}
    </Flex>
  );
});

export default SponsorBalance;
