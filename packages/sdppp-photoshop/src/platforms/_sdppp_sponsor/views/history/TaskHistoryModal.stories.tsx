import type { Meta, StoryObj } from '@storybook/react';
import TaskHistoryModal from './TaskHistoryModal';

const meta: Meta<typeof TaskHistoryModal> = {
  title: 'SDPPP Sponsor/TaskHistoryModal',
  component: TaskHistoryModal,
  argTypes: {
    onClose: { action: 'close modal' },
  },
};

export default meta;

type Story = StoryObj<typeof TaskHistoryModal>;

export const Default: Story = {
  args: {
    open: true,
    title: 'Task Details',
    children: <div style={{ padding: 12 }}>Modal content placeholder</div>,
    onClose: () => {},
  },
};
