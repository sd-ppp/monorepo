import type { Meta, StoryObj } from '@storybook/react';
import { useArgs } from '@storybook/preview-api';
import React from 'react';
import { LocalImagePackSelector } from '@sdppp/widget-image-mask-ui/components/LocalImagePackSelector';

const meta: Meta<typeof LocalImagePackSelector> = {
  title: 'Components/ImagePack/Local',
  component: LocalImagePackSelector,
  args: {
    widgetableId: 'demo-local-image-pack-selector',
    value: ['https://picsum.photos/seed/sdppp-local-pack/400/300'],
  },
};

export default meta;

type Story = StoryObj<typeof LocalImagePackSelector>;

export const LocalImagePack: Story = {
  render: args => {
    const [{ value }, updateArgs] = useArgs<{
      value: string[];
    }>();

    const handleValueChange = (next: string[]) => {
      updateArgs({ value: next });
    };

    return (
      <div style={{ width: 320, maxWidth: 320 }}>
        <LocalImagePackSelector
          {...args}
          value={value}
          onValueChange={handleValueChange}
        />
      </div>
    );
  },
};
