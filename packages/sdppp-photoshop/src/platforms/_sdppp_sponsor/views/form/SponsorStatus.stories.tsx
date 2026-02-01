import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { useMockStores } from '../stories/mockStores';
import { sponsorTemplateStore } from '../templates/templateStore';
import { sponsorExecutionStore } from './executionStore';
import SponsorStatus from './SponsorStatus';

const meta: Meta<typeof SponsorStatus> = {
  title: 'SDPPP Sponsor/SponsorStatus',
  component: SponsorStatus,
  argTypes: {
    onRun: { action: 'run' },
    onCancel: { action: 'cancel' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorStatus>;

const Template = (args: Omit<Story['args'], 't'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorStatus
      {...args}
      t={t}
      executionStore={sponsorExecutionStore}
      schemaStore={sponsorSchemaStore}
      templateStore={sponsorTemplateStore}
      authStore={sponsorAuthStore}
      isRunning={false}
      canCancel={false}
    />
  );
};

export const Default: Story = {
  args: {
    onRun: () => {},
    onCancel: () => {},
  },
  render: (args) => <Template {...args} />,
};
