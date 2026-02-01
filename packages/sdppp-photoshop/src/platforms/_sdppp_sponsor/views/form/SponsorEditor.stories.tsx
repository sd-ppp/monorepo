import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { useMockStores } from '../stories/mockStores';
import { sponsorTemplateStore } from '../templates/templateStore';
import { sponsorExecutionStore } from './executionStore';
import { sponsorFormStore } from './formStore';
import SponsorEditor from './SponsorEditor';

const meta: Meta<typeof SponsorEditor> = {
  title: 'SDPPP Sponsor/SponsorEditor',
  component: SponsorEditor,
  argTypes: {
    onRun: { action: 'run' },
    onCancel: { action: 'cancel' },
  },
};

export default meta;

type Story = StoryObj<typeof SponsorEditor>;

const Template = (args: Omit<Story['args'], 't'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return (
    <SponsorEditor
      {...args}
      t={t}
      executionStore={sponsorExecutionStore}
      schemaStore={sponsorSchemaStore}
      templateStore={sponsorTemplateStore}
      authStore={sponsorAuthStore}
      formStore={sponsorFormStore}
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
