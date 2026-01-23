import type { Meta, StoryObj } from '@storybook/react';
import { FileUp, Layers, Layers2, RefreshCcw, Scroll } from 'lucide-react';
import React from 'react';

import {
  ImageSelectorPresentation,
  type ImageSelectorPresentationProps,
} from 'sdppp-photoshop-widgets/components/selectors/ImageSelector/ImageSelectorPresentation';

const meta: Meta<typeof ImageSelectorPresentation> = {
  title: 'Components/Image/Single/Presentation',
  component: ImageSelectorPresentation,
};

export default meta;

type Story = StoryObj<typeof ImageSelectorPresentation>;

const noop = () => undefined;
const preventDefault = (event?: React.MouseEvent<HTMLElement>) => event?.preventDefault();

const createBaseProps = (): ImageSelectorPresentationProps => ({
  dropHint: '拖拽图片到这里即可上传',
  isDragging: false,
  dropHandlers: {
    onDragEnter: noop,
    onDragLeave: noop,
    onDragOver: noop,
    onDrop: noop,
  },
  autoSyncColumn: {
    widgetableId: 'demo-image-selector',
    syncButtonIcon: <RefreshCcw size={18} strokeWidth={2} />,
    clearButtonTooltip: '清空当前图片',
    onSyncHoverStart: noop,
    onSyncHoverEnd: noop,
    onClear: noop,
  },
  previewPanel: {
    widgetableId: 'demo-image-selector',
    displayUrl: 'https://picsum.photos/seed/sdppp-1/400/300',
    overlayDisplayUrl: 'https://picsum.photos/seed/sdppp-mask/400/300',
    debugDetails: { boundary: 'uxp://boundary/9527/canvas' },
    overlayVisible: false,
  },
  actionArea: {
    mode: 'sync',
    auto: true,
    autoButtonTooltip: '自动同步已开启',
    manualSyncTooltipText: '立即同步',
    autoSyncIcon: <RefreshCcw size={16} strokeWidth={2} />,
    onManualSync: noop,
    onAutoToggle: noop,
    onHelpHintChange: noop,
  },
  statusBar: {
    resolvedUploadingStatusMessage: null,
    isModeSelectionActive: false,
    modeButtons: [
      {
        mode: 'file',
        icon: FileUp,
        activeIcon: FileUp,
        tooltip: '使用本地文件',
        label: '本地文件',
      },
      {
        mode: 'layer',
        icon: Layers,
        activeIcon: Layers2,
        tooltip: '使用当前图层',
        label: '当前图层',
      },
      {
        mode: 'canvas',
        icon: Scroll,
        activeIcon: Scroll,
        tooltip: '使用整个画布',
        label: '整个画布',
      },
    ],
    sourceMode: 'canvas',
    currentModeLabel: '正在使用画布',
    onModeChange: noop,
    onModeIconHoverStart: noop,
    onModeIconHoverEnd: noop,
    onModeSelectionAreaEnter: noop,
    onModeSelectionAreaLeave: noop,
    shouldShowFileTag: false,
    fileTagLabel: '正使用本地文件',
    fileTagResetHint: '点击移除本地文件',
    onFileTagReset: event => {
      event?.preventDefault();
    },
    shouldShowAutoTag: true,
    autoStatusLabel: '自动同步中',
    autoTagResetHint: '点击退出自动同步',
    onAutoToggle: noop,
    statusBarLeftLabel: '\u00A0',
    shouldShowStatusTags: true,
    hasCustomMask: true,
    maskTagLabel: '已添加遮罩',
    maskTagResetHint: '点击恢复默认遮罩',
    hasCustomBoundary: true,
    boundaryTagLabel: '已限定范围',
    boundaryTagResetHint: '点击恢复默认边界',
    onResetMask: preventDefault,
    onResetBoundary: preventDefault,
    onMaskStatusTagHoverStart: noop,
    onMaskStatusTagHoverEnd: noop,
    onBoundaryStatusTagHoverStart: noop,
    onBoundaryStatusTagHoverEnd: noop,
    hoverHelpMessage: '选择自动同步可以随画布更新',
  },
});

export const SyncMode: Story = {
  args: createBaseProps(),
  render: args => (
    <div style={{ width: 320, maxWidth: 320 }}>
      <ImageSelectorPresentation {...args} />
    </div>
  ),
};

export const SelectionMode: Story = {
  args: (() => {
    const base = createBaseProps();
    base.actionArea = {
      mode: 'selection',
      cutLabel: '智能抠图',
      scanLabel: '更新选区',
      cutTooltipText: '生成遮罩并应用',
      scanTooltipText: '根据当前画布刷新边界',
      onCut: noop,
      onScan: noop,
      onMaskHoverStart: noop,
      onMaskHoverEnd: noop,
      onBoundaryHoverStart: noop,
      onBoundaryHoverEnd: noop,
      onHelpHintChange: noop,
    };
    base.statusBar = {
      ...base.statusBar,
      shouldShowStatusTags: true,
      hasCustomMask: false,
      hasCustomBoundary: false,
      hoverHelpMessage: '使用选区工具可以快速修正边界',
    };
    return base;
  })(),
  render: args => (
    <div style={{ width: 320, maxWidth: 320 }}>
      <ImageSelectorPresentation {...args} />
    </div>
  ),
};
