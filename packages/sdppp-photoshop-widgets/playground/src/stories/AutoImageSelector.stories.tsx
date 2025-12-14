import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { AutoImageSelector } from 'sdppp-photoshop-widgets/components/selectors/AutoImageSelector';

const meta: Meta<typeof AutoImageSelector> = {
  title: 'Components/Image/Auto Selector',
  component: AutoImageSelector,
  args: {
    value: ['https://picsum.photos/seed/auto-preview/400/300'],
    workBoundary: 'uxp://boundary/9527/canvas',
  },
  argTypes: {
    value: { control: 'object' },
    workBoundary: { control: 'text' },
    sourceHints: { control: 'object' },
  },
};

export default meta;

type Story = StoryObj<typeof AutoImageSelector>;

const Container: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div style={{ width: 320 }}>{children}</div>
);

export const CanvasDefaults: Story = {
  render: args => (
    <Container>
      <AutoImageSelector {...args} />
    </Container>
  ),
};

export const CurrentLayerFocus: Story = {
  args: {
    sourceHints: {
      content: 'curlayer',
      mask: 'curlayer',
      boundary: 'canvas',
    },
  },
  render: args => (
    <Container>
      <AutoImageSelector {...args} />
    </Container>
  ),
};

export const SelectionMaskWithLayerBoundary: Story = {
  args: {
    sourceHints: {
      content: 'curlayer',
      mask: 'selection',
      boundary: 'curlayer',
    },
  },
  render: args => (
    <Container>
      <AutoImageSelector {...args} />
    </Container>
  ),
};

export const CanvasMaskOnly: Story = {
  args: {
    sourceHints: {
      content: 'canvas',
      mask: 'canvas',
      boundary: 'canvas',
    },
  },
  render: args => (
    <Container>
      <AutoImageSelector {...args} />
    </Container>
  ),
};
