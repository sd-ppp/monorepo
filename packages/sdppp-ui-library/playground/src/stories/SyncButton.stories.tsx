import type { Meta, StoryObj } from '@storybook/react';
import { SyncButton } from '@sdppp/ui-library';

const meta: Meta<typeof SyncButton> = {
  title: 'Components/SyncButton',
  component: SyncButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    isAutoSync: { control: 'boolean' },
    autoSyncEnabled: { control: 'boolean' },
    children: { control: 'text' },
    descText: { control: 'text' },
    syncButtonTooltip: { control: 'text' },
    autoSyncButtonTooltips: { control: 'object' },
    onSync: { action: 'onSync' },
    onAutoSyncToggle: { action: 'onAutoSyncToggle' },
  },
};

export default meta;
type Story = StoryObj<typeof SyncButton>;

export const Default: Story = {
  args: {
    disabled: false,
    isAutoSync: false,
    autoSyncEnabled: true,
    children: 'Sync Now',
    syncButtonTooltip: 'Click to sync',
    autoSyncButtonTooltips: {
      enabled: 'Auto-sync is ON',
      disabled: 'Auto-sync is OFF',
    },
  },
};

export const AutoSyncActive: Story = {
  args: {
    ...Default.args,
    isAutoSync: true,
    children: 'Syncing...',
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};

export const NoAutoSyncOption: Story = {
  args: {
    ...Default.args,
    autoSyncEnabled: false,
  },
};

export const WithDescription: Story = {
  args: {
    ...Default.args,
    descText: '导入为智能对象，不改变图层',
    buttonWidth: 120,
  },
};
