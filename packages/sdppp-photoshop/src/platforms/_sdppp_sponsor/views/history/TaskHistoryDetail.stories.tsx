import type { Meta, StoryObj } from '@storybook/react';
import TaskHistoryDetail from './TaskHistoryDetail';
import { mockHistory } from '../stories/mockStores';

const meta: Meta<typeof TaskHistoryDetail> = {
  title: 'SDPPP Sponsor/TaskHistoryDetail',
  component: TaskHistoryDetail,
  argTypes: {
    onRefresh: { action: 'refresh detail' },
    onSendImage: { action: 'send image' },
  },
};

export default meta;

type Story = StoryObj<typeof TaskHistoryDetail>;

export const Default: Story = {
  args: {
    record: mockHistory[0] ?? null,
    outputs: ['https://example.com/image-1.png', 'https://example.com/image-2.png'],
    loading: false,
    error: null,
    sendingUrl: null,
    onRefresh: () => {},
    onSendImage: () => {},
  },
};
