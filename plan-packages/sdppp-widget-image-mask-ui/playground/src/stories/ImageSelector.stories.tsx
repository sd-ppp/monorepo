import React from 'react';
import { useArgs } from '@storybook/preview-api';
import { ImageSelector } from '@sdppp/widget-image-mask-ui/components/ImageSelector';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ImageSelector> = {
  title: 'Components/Image/Single',
  component: ImageSelector,
  args: {
    widgetableId: 'demo-image-selector',
    value: ['https://picsum.photos/seed/sdppp-1/400/300'],
    showActionButtons: true,
    workBoundary: 'uxp://boundary/0/canvas',
  },
  argTypes: {
    value: {
      control: 'object',
    },
    showActionButtons: {
      control: 'boolean',
    },
    workBoundary: {
      control: 'text',
    },
  },
};

export default meta;

type Story = StoryObj<typeof ImageSelector>;

export const SingleImage: Story = {
  render: args => {
    const [{ value }, updateArgs] = useArgs<{
      value: string[];
    }>();

    const handleValueChange = (next: string[]) => {
      updateArgs({ value: next });
    };

    return (
      <div style={{ width: 320, maxWidth: 320 }}>
        <ImageSelector
          {...args}
          value={value}
          onValueChange={handleValueChange}
        />
      </div>
    );
  },
};
