import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MultiImageSelector } from 'sdppp-photoshop-widgets/components/selectors/MultiImageSelector';

const meta: Meta<typeof MultiImageSelector> = {
  title: 'Components/Image/Multi',
  component: MultiImageSelector,
  args: {
    widgetableId: 'demo-multi-image-selector',
    maxCount: 3,
    workBoundary: 'uxp://boundary/0/canvas',
    value: [
      'https://picsum.photos/seed/sdppp-2/400/300',
      'https://picsum.photos/seed/sdppp-3/400/300',
      'https://picsum.photos/seed/sdppp-4/400/300',
    ],
    showActionButtons: true,
  },
  argTypes: {
    value: {
      control: 'object',
    },
    maxCount: {
      control: { type: 'number', min: 1, max: 9, step: 1 },
    },
    workBoundary: {
      control: 'text',
    },
    showActionButtons: {
      control: 'boolean',
    },
  },
};

export default meta;

type Story = StoryObj<typeof MultiImageSelector>;

export const MultipleImages: Story = {
  render: args => {
    return (
      <div style={{ width: 320, maxWidth: 320 }}>
        <MultiImageSelector
          {...args}
        />
      </div>
    );
  },
};
