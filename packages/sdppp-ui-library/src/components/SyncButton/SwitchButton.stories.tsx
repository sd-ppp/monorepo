import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { SwitchButton, type SwitchButtonProps } from './SwitchButton';

const meta: Meta<typeof SwitchButton> = {
  title: 'SDPPP/SwitchButton',
  component: SwitchButton,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    onClick: { action: 'click' }
  }
};

export default meta;

type Story = StoryObj<typeof SwitchButton>;

const StatefulSwitchButton: React.FC<SwitchButtonProps> = (props) => {
  const [value, setValue] = useState(props.value ?? false);

  useEffect(() => {
    setValue(props.value ?? false);
  }, [props.value]);

  return (
    <SwitchButton
      {...props}
      value={value}
      onClick={(event) => {
        props.onClick?.(event);
        setValue(prev => !prev);
      }}
    />
  );
};

export const Default: Story = {
  args: {
    children: '切换状态',
    value: false,
    type: 'default'
  },
  render: (args) => <StatefulSwitchButton {...args} />
};

export const Active: Story = {
  args: {
    children: '激活中',
    value: true,
    type: 'primary'
  },
  render: (args) => <StatefulSwitchButton {...args} />
};
