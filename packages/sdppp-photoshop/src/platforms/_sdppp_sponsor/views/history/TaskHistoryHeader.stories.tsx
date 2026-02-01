import type { Meta, StoryObj } from '@storybook/react';
import TaskHistoryHeader from './TaskHistoryHeader';

const meta: Meta<typeof TaskHistoryHeader> = {
  title: 'SDPPP Sponsor/TaskHistoryHeader',
  component: TaskHistoryHeader,
  argTypes: {
    onRefresh: { action: 'refresh history' },
  },
};

export default meta;

type Story = StoryObj<typeof TaskHistoryHeader>;

export const Default: Story = {
  args: {
    t: (key: string, options?: any) => options?.defaultValue ?? key,
    loading: false,
    disabled: false,
    onRefresh: () => {},
  },
};
