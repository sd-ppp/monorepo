import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import SponsorForm from './SponsorForm';
import { sponsorFormStore } from './formStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { useMockStores } from '../stories/mockStores';

const meta: Meta<typeof SponsorForm> = {
  title: 'SDPPP Sponsor/SponsorForm',
  component: SponsorForm,
};

export default meta;

type Story = StoryObj<typeof SponsorForm>;

const Template = (args: Omit<Story['args'], 't'>) => {
  const overrides = useMemo(() => ({}), []);
  useMockStores(overrides);

  const t = (key: string, options?: any) => options?.defaultValue ?? key;

  return <SponsorForm {...args} t={t} formStore={sponsorFormStore} schemaStore={sponsorSchemaStore} />;
};

export const Default: Story = {
  render: (args) => <Template {...args} />,
};
