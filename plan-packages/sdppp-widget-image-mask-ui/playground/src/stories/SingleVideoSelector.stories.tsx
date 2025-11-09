import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { SingleVideoSelector } from '@sdppp/widget-image-mask-ui/components/SingleVideoSelector';

const meta: Meta<typeof SingleVideoSelector> = {
  title: 'Components/Video/Single',
  component: SingleVideoSelector,
  args: {
    widgetableId: 'demo-single-video-selector',
    value: ['https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'],
  },
  argTypes: {
    value: {
      control: 'object',
    },
  },
};

export default meta;

type Story = StoryObj<typeof SingleVideoSelector>;

export const SingleVideo: Story = {
  render: args => (
    <div style={{ width: 320, maxWidth: 320 }}>
      <SingleVideoSelector {...args} />
    </div>
  ),
};
