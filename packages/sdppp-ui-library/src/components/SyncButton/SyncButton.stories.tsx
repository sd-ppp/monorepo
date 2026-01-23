import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect, useState } from 'react';
import { SyncButton, type SyncButtonProps } from './SyncButton';

const meta: Meta<typeof SyncButton> = {
  title: 'SDPPP/SyncButton',
  component: SyncButton,
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    onSync: { action: 'sync' },
    onAutoSyncToggle: { action: 'auto toggle' }
  }
};

export default meta;

type Story = StoryObj<typeof SyncButton>;

const StatefulSyncButton: React.FC<SyncButtonProps> = (props) => {
  const [auto, setAuto] = useState(props.isAutoSync);

  useEffect(() => {
    setAuto(props.isAutoSync);
  }, [props.isAutoSync]);

  return (
    <SyncButton
      {...props}
      isAutoSync={auto}
      onSync={(event) => {
        props.onSync?.(event);
      }}
      onAutoSyncToggle={(event) => {
        props.onAutoSyncToggle?.(event);
        setAuto((prev) => !prev);
      }}
    />
  );
};

export const Horizontal: Story = {
  args: {
    disabled: false,
    isAutoSync: false,
    autoSyncEnabled: true,
    buttonSize: 160,
    children: '手动同步',
    descText: '点击手动同步一次',
    direction: 'horizontal',
    autoSyncButtonTooltips: {
      enabled: '自动同步已开启',
      disabled: '自动同步已关闭'
    }
  },
  render: (args) => <StatefulSyncButton {...args} />
};

export const Vertical: Story = {
  args: {
    ...Horizontal.args,
    direction: 'vertical',
    buttonSize: 140,
    buttonSizeSub: 90,
    descText: '垂直布局'
  },
  render: (args) => <StatefulSyncButton {...args} />
};

export const ContextAuto: Story = {
  args: {
    disabled: false,
    isAutoSync: true,
    autoSyncEnabled: true,
    mainButtonType: 'primary',
    buttonSize: 120,
    buttonSizeSub: 120,
    children: '自动同步中',
    descText: '右键切换自动同步',
    direction: 'context-auto'
  },
  render: (args) => <StatefulSyncButton {...args} />
};
