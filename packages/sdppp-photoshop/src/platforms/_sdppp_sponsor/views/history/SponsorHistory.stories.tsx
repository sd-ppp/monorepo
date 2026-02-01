import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { useMockStores } from '../stories/mockStores';
import { sponsorHistoryStore } from './historyStore';
import SponsorHistory from './SponsorHistory';

const meta: Meta<typeof SponsorHistory> = {
  title: 'SDPPP Sponsor/SponsorHistory',
  component: SponsorHistory,
  argTypes: {
    onSelect: { action: 'select history item' },
    onRefresh: { action: 'refresh history' },
    onDetailRefresh: { action: 'refresh detail' },
    onSendImage: { action: 'send image' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorHistory>;

const Template = (args: Omit<Story['args'], 't'>) => {
  const overrides = useMemo(() => ({ activeTab: 'history' as const }), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorHistory
      {...args}
      t={t}
      historyStore={sponsorHistoryStore}
      authStore={sponsorAuthStore}
      active
      sendingUrl={null}
      resolveTemplateLabel={(item) => item.templateName ?? item.templateId}
    />
  );
};

export const Default: Story = {
  args: {
    onSelect: () => {},
    onRefresh: () => {},
    onDetailRefresh: () => {},
    onSendImage: () => {},
  },
  render: (args) => <Template {...args} />,
};
