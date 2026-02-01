import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { useMockStores } from '../stories/mockStores';
import { sponsorTemplateStore } from '../templates/templateStore';
import SponsorHeader from './SponsorHeader';

const meta: Meta<typeof SponsorHeader> = {
  title: 'SDPPP Sponsor/SponsorHeader',
  component: SponsorHeader,
  argTypes: {
    onRefreshTemplates: { action: 'refresh templates' },
    onTemplateSelect: { action: 'select template' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorHeader>;

const Template = (args: Omit<Story['args'], 't' | 'authStore' | 'templateStore'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorHeader
      {...args}
      t={t}
      authStore={sponsorAuthStore}
      templateStore={sponsorTemplateStore}
    />
  );
};

export const Default: Story = {
  args: {
    onRefreshTemplates: () => {},
    onTemplateSelect: () => {},
  },
  render: (args) => <Template {...args} />,
};
