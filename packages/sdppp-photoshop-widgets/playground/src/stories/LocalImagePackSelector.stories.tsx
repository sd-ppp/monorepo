import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { LocalImagePackSelector } from 'sdppp-photoshop-widgets/components/selectors/LocalImagePackSelector';

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
    return (
      <div style={{ width: 320, maxWidth: 320 }}>
        <LocalImagePackSelector
          {...args}
        />
      </div>
    );
  },
};
