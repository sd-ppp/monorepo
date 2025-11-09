import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MultiImageSelector } from '@sdppp/widget-image-mask-ui/components/MultiImageSelector';

const meta: Meta<typeof MultiImageSelector> = {
  title: 'Components/Image/Multi',
  component: MultiImageSelector,
  args: {
    widgetableId: 'demo-multi-image-selector',
    maxCount: 3,
    value: [
      'https://picsum.photos/seed/sdppp-2/400/300',
      'https://picsum.photos/seed/sdppp-3/400/300',
      'https://picsum.photos/seed/sdppp-4/400/300',
    ],
  },
  argTypes: {
    value: {
      control: 'object',
    },
    maxCount: {
      control: { type: 'number', min: 1, max: 9, step: 1 },
    },
  },
};

export default meta;

type Story = StoryObj<typeof MultiImageSelector>;

export const MultipleImages: Story = {
  render: args => (
    <div style={{ width: 320, maxWidth: 320 }}>
      <MultiImageSelector {...args} />
    </div>
  ),
};
