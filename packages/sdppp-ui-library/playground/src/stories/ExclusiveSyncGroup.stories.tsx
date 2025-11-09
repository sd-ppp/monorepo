import type { Meta, StoryObj } from '@storybook/react';
import { useCallback } from 'react';
import { ExclusiveSyncGroup } from '@sdppp/ui-library';
import type { ButtonConfig } from '@sdppp/ui-library';

const meta: Meta<typeof ExclusiveSyncGroup> = {
  title: 'Components/ExclusiveSyncGroup',
  component: ExclusiveSyncGroup,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ExclusiveSyncGroup>;

const buttons: ButtonConfig[] = [
  { id: 'red', text: 'Sync Red', supportsAutoSync: true },
  { id: 'blue', text: 'Sync Blue', supportsAutoSync: true },
  { id: 'green', text: 'Sync Green', supportsAutoSync: true },
];

export const Default: Story = {
  args: {
    buttons,
    onSync: async () => {},
    onAutoSyncChange: () => {},
    buttonSize: 140,
  },
};
