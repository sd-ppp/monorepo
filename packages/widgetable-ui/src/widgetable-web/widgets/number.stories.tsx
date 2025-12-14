import type { Meta, StoryObj } from '@storybook/react';
import { NumberWidget } from './number';

const meta: Meta<typeof NumberWidget> = {
  title: 'Widgets/NumberWidget',
  component: NumberWidget,
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
    inputMin: 0,
    inputMax: 100,
    inputStep: 1,
    value: 50,
    useSlider: false,
    uiWeight: 12,
  },
};

export const WithSlider: Story = {
  args: {
    inputMin: 0,
    inputMax: 100,
    inputStep: 1,
    value: 25,
    useSlider: true,
    uiWeight: 12,
  },
};

export const WithName: Story = {
  args: {
    inputMin: 0,
    inputMax: 10,
    inputStep: 0.1,
    value: 5.5,
    name: 'Opacity',
    useSlider: false,
    uiWeight: 12,
  },
};
