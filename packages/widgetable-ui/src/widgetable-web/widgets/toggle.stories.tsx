import type { Meta, StoryObj } from '@storybook/react';
import { ToggleWidget } from './toggle';

const meta: Meta<typeof ToggleWidget> = {
  title: 'Widgets/ToggleWidget',
  component: ToggleWidget,
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
    value: false,
    name: 'Toggle Option',
    uiWeight: 12,
  },
};

export const Checked: Story = {
  args: {
    value: true,
    name: 'Enabled Feature',
    uiWeight: 12,
  },
};

export const WithoutLabel: Story = {
  args: {
    value: false,
    uiWeight: 12,
  },
};
