import type { Meta, StoryObj } from '@storybook/react';
import TaskHistoryList from './TaskHistoryList';
import { mockHistory } from '../stories/mockStores';

const meta: Meta<typeof TaskHistoryList> = {
  title: 'SDPPP Sponsor/TaskHistoryList',
  component: TaskHistoryList,
  argTypes: {
    onSelect: { action: 'select item' },
  },
};

export default meta;

type Story = StoryObj<typeof TaskHistoryList>;

export const Default: Story = {
  args: {
    items: mockHistory,
    loading: false,
    error: null,
    selectedId: mockHistory[0]?.id ?? null,
    onSelect: () => {},
    resolveTemplateLabel: (item) => item.templateName ?? item.templateId,
  },
};
