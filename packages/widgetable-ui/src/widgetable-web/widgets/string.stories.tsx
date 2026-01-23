import type { Meta, StoryObj } from '@storybook/react';
import { StringWidget } from './string';

const meta: Meta<typeof StringWidget> = {
  title: 'Widgets/StringWidget',
  component: StringWidget,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onValueChange: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'Enter your text here...',
    uiWeight: 12,
  },
};

export const Empty: Story = {
  args: {
    value: '',
    uiWeight: 12,
  },
};

export const MultiLine: Story = {
  args: {
    value: 'This is a longer text\nthat spans multiple lines\nand demonstrates the auto-resize feature',
    uiWeight: 12,
  },
};
