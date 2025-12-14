import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { PreviewPanelPresentation } from 'sdppp-photoshop-widgets/components/selectors/ImageSelector/PreviewPanelPresentation';

const meta: Meta<typeof PreviewPanelPresentation> = {
  title: 'Components/Image/PreviewPanelPresentation',
  component: PreviewPanelPresentation,
  args: {
    displayUrl: 'https://picsum.photos/seed/preview-base/640/480',
    overlayDisplayUrl: 'https://picsum.photos/seed/preview-overlay/640/480',
    overlayVisible: true,
    widgetableId: 'demo-preview-panel',
  },
  argTypes: {
    displayUrl: { control: 'text' },
    overlayDisplayUrl: { control: 'text' },
    overlayVisible: { control: 'boolean' },
    widgetableId: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof PreviewPanelPresentation>;

export const Default: Story = {
  render: args => (
    <div
      style={{
        width: 320,
        height: 240,
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <PreviewPanelPresentation {...args} />
    </div>
  ),
};
