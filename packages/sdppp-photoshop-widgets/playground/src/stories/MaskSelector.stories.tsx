import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MaskSelector } from 'sdppp-photoshop-widgets/components/selectors/MaskSelector';

const meta: Meta<typeof MaskSelector> = {
  title: 'Components/Mask',
  component: MaskSelector,
  args: {
    widgetableId: 'demo-mask-selector',
    value: ['https://picsum.photos/seed/sdppp-mask-1/400/300'],
    workBoundary: 'uxp://boundary/1/canvas',
  },
  argTypes: {
    value: {
      control: 'object',
    },
  },
};

export default meta;

type Story = StoryObj<typeof MaskSelector>;

export const MaskPreview: Story = {
  render: args => (
    <div style={{ width: 320, maxWidth: 320 }}>
      <MaskSelector {...args} />
    </div>
  ),
};
