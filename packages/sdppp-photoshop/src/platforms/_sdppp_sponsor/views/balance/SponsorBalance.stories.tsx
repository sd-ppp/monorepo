import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import SponsorBalance from './SponsorBalance';
import { sponsorUiStore } from '../uiStore';
import { mockBalanceStore, useMockStores } from '../stories/mockStores';

const meta: Meta<typeof SponsorBalance> = {
  title: 'SDPPP Sponsor/SponsorBalance',
  component: SponsorBalance,
  argTypes: {
    onOpenRecharge: { action: 'open recharge' },
    onRefreshBalance: { action: 'refresh balance' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorBalance>;

const Template = (args: Omit<Story['args'], 't' | 'balanceStore' | 'uiStore'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorBalance
      {...args}
      t={t}
      balanceStore={mockBalanceStore}
      uiStore={sponsorUiStore}
      rechargeUrl="https://example.com/recharge"
    />
  );
};

export const Default: Story = {
  args: {
    onOpenRecharge: () => {},
    onRefreshBalance: () => {},
  },
  render: (args) => <Template {...args} />,
};
