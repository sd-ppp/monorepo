import type { Meta, StoryObj } from '@storybook/react';
import { WorkflowStatusDisplay } from '@sdppp/ui-library';

const meta: Meta<typeof WorkflowStatusDisplay> = {
  title: 'Components/WorkflowStatusDisplay',
  component: WorkflowStatusDisplay,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    status: { control: 'object' },
  },
};

export default meta;

type Story = StoryObj<typeof WorkflowStatusDisplay>;

export const Uploading: Story = {
  args: {
    status: { type: 'uploading', message: '正在上传图像资源…' },
  },
};

export const Error: Story = {
  args: {
    status: { type: 'error', message: '运行失败，请检查节点配置' },
  },
};

export const Progress: Story = {
  args: {
    status: { type: 'progress', percent: 72, message: '正在执行节点 Rendering' },
  },
};

export const AutoRunningHint: Story = {
  args: {
    status: { type: 'text', tone: 'secondary', message: '自动运行已开启，监听画布变化…' },
  },
};

export const Idle: Story = {
  args: {
    status: { type: 'text', tone: 'secondary', message: 'workflow/example.json' },
  },
};
