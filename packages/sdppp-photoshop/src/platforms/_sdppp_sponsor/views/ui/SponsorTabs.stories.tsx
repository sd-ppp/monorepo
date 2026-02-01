import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import SponsorTabs from './SponsorTabs';
import { sponsorUiStore } from '../uiStore';
import { useMockStores } from '../stories/mockStores';

const meta: Meta<typeof SponsorTabs> = {
  title: 'SDPPP Sponsor/SponsorTabs',
  component: SponsorTabs,
  argTypes: {
    onTabChange: { action: 'tab change' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorTabs>;

const Template = (args: Omit<Story['args'], 't' | 'uiStore'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorTabs
      {...args}
      t={t}
      uiStore={sponsorUiStore}
      editor={<div style={{ padding: 12 }}>Editor placeholder</div>}
      history={<div style={{ padding: 12 }}>History placeholder</div>}
      rightContent={<div style={{ paddingRight: 8 }}>Balance: 42</div>}
    />
  );
};

export const Default: Story = {
  args: {
    onTabChange: () => {},
  },
  render: (args) => <Template {...args} />,
};
