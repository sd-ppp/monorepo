import { PlusOutlined } from '@ant-design/icons';
import {
  ExclusiveSyncGroup,
  ImagePreviewSplit,
  SyncButton,
  type ButtonConfig,
} from '@sdppp/ui-library';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Checkbox, Space } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useCallback, useMemo, useState } from 'react';

const generateSvgBase64 = (color: string, text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480">
    <defs>
      <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="28px" fill="#ffffff">${text}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const buttonConfigs: ButtonConfig[] = [
  {
    id: 'red',
    text: 'Sync Red',
    supportsAutoSync: true,
    syncButtonTooltip: '手动同步红色通道',
    autoSyncButtonTooltips: {
      enabled: '自动同步红色中…',
      disabled: '启用红色自动同步',
    },
  },
  {
    id: 'blue',
    text: 'Sync Blue',
    supportsAutoSync: true,
    syncButtonTooltip: '手动同步蓝色通道',
    autoSyncButtonTooltips: {
      enabled: '自动同步蓝色中…',
      disabled: '启用蓝色自动同步',
    },
  },
  {
    id: 'green',
    text: 'Sync Green',
    supportsAutoSync: true,
    syncButtonTooltip: '手动同步绿色通道',
    autoSyncButtonTooltips: {
      enabled: '自动同步绿色中…',
      disabled: '启用绿色自动同步',
    },
  },
];

const meta: Meta<typeof ImagePreviewSplit> = {
  title: 'Components/ImagePreviewSplit',
  component: ImagePreviewSplit,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ImagePreviewSplit>;

const colorMap: Record<string, string> = {
  red: '#ff5a5f',
  blue: '#3083ff',
  green: '#38c172',
  neutral: '#6c6f7f',
};

export const ExclusiveGroupExample: Story = {
  render: () => {
    const [imageUrl, setImageUrl] = useState(() =>
      generateSvgBase64(colorMap.neutral, 'Initial')
    );
    const [activeAutoId, setActiveAutoId] = useState<string | null>(null);

    const handleSync = useCallback(
      async (id: string) => {
        const color = colorMap[id] ?? colorMap.neutral;
        await new Promise(resolve => setTimeout(resolve, 150));
        setImageUrl(generateSvgBase64(color, id.toUpperCase()));
      },
      []
    );

    const left = useMemo(
      () => (
        <ExclusiveSyncGroup
          buttons={buttonConfigs}
          onSync={(id, event) => handleSync(id)}
          onAutoSyncChange={nextId => setActiveAutoId(nextId)}
          activeAutoSyncId={activeAutoId}
          buttonWidth={140}
          tooltipPlacement="right"
          autoTooltipPlacement="right"
        />
      ),
      [activeAutoId, handleSync]
    );

    return (
      <ImagePreviewSplit
        left={left}
        imageUrl={imageUrl}
        background="checkerboard"
        data-testid="exclusive-preview"
      />
    );
  },
};

export const CheckboxAndButtonExample: Story = {
  render: () => {
    const buildImage = useCallback((alt: boolean, index: number) => {
      return generateSvgBase64(
        alt ? '#8e44ad' : '#0f9d58',
        alt ? `Mode ${index}` : `Primary ${index}`
      );
    }, []);

    const [useAlt, setUseAlt] = useState(false);
    const [count, setCount] = useState(0);
    const [imageUrl, setImageUrl] = useState(() => buildImage(false, 0));

    const handleRefresh = useCallback(() => {
      setCount(prev => {
        const next = prev + 1;
        setImageUrl(buildImage(useAlt, next));
        return next;
      });
    }, [buildImage, useAlt]);

    const handleToggle = useCallback(
      (event: CheckboxChangeEvent) => {
        const nextChecked = event.target.checked;
        setUseAlt(nextChecked);
        setImageUrl(buildImage(nextChecked, count));
      },
      [buildImage, count]
    );

    const left = (
      <Space direction="vertical">
        <Checkbox checked={useAlt} onChange={handleToggle}>
          Alternate palette
        </Checkbox>
        <Button type="primary" onClick={handleRefresh}>
          Refresh image
        </Button>
      </Space>
    );

    return (
      <ImagePreviewSplit
        left={left}
        imageUrl={imageUrl}
        background="white"
        previewStyle={{
          padding: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  },
};

export const ConditionalControlsExample: Story = {
  render: () => {
    const [mainAuto, setMainAuto] = useState(false);
    const [maskAuto, setMaskAuto] = useState(false);
    const [advancedExpanded, setAdvancedExpanded] = useState(false);
    const [advancedAuto, setAdvancedAuto] = useState(false);
    const [imageUrl, setImageUrl] = useState(() =>
      generateSvgBase64(colorMap.blue, 'Primary')
    );

    const updateImage = useCallback((color: string, label: string) => {
      setImageUrl(generateSvgBase64(color, label));
    }, []);

    const handleMainSync = useCallback((_event?: { altKey: boolean; shiftKey: boolean }) => {
      updateImage(colorMap.blue, 'Primary Sync');
    }, [updateImage]);

    const handleAdvancedSync = useCallback(
      (_event?: { altKey: boolean; shiftKey: boolean }) => {
        updateImage(colorMap.red, 'Advanced');
        setAdvancedExpanded(true);
        setAdvancedAuto(false);
      },
      [updateImage]
    );

    const handleAdvancedAutoToggle = useCallback(
      (_event?: { altKey: boolean; shiftKey: boolean }) => {
        setAdvancedExpanded(true);
        setAdvancedAuto(prev => {
          const next = !prev;
          updateImage(colorMap.red, next ? 'Advanced Auto' : 'Advanced');
          return next;
        });
      },
      [updateImage]
    );

    const handleAdvancedCancel = useCallback(
      (_event?: { altKey: boolean; shiftKey: boolean }) => {
        setAdvancedAuto(false);
        setAdvancedExpanded(false);
      },
      []
    );

    const handleMaskSync = useCallback(
      (_event?: { altKey: boolean; shiftKey: boolean }) => {
        updateImage(colorMap.green, maskAuto ? 'Mask Auto' : 'Mask Manual');
      },
      [maskAuto, updateImage]
    );

    const handleMaskAutoToggle = useCallback((_event?: { altKey: boolean; shiftKey: boolean }) => {
      setMaskAuto(prev => !prev);
    }, []);

    const handleMainAutoToggle = useCallback(
      (_event?: { altKey: boolean; shiftKey: boolean }) => {
        setMainAuto(prev => {
          const next = !prev;
          updateImage(colorMap.blue, next ? 'Primary Auto' : 'Primary');
          return next;
        });
      },
      [updateImage]
    );

    const Divider = () => (
      <div style={{ margin: '4px 0', width: '100%' }}>
        <div
          style={{
            borderTop:
              '1px dashed var(--sdppp-widget-border-color, var(--ant-color-border, #d9d9d9))',
            width: '100%',
          }}
        />
      </div>
    );

    const topSectionHeight = 62;
    const mainButtonLabel = mainAuto ? '自动取图中...' : '使用主图';
    const advancedButtonLabel = advancedAuto
      ? '自动高级取图'
      : advancedExpanded
        ? '重新高级取图'
        : '高级选图';

    const maskButton = (
      <SyncButton
        disabled={false}
        isAutoSync={maskAuto}
        onSync={(event) => handleMaskSync(event)}
        onAutoSyncToggle={(event) => handleMaskAutoToggle(event)}
        buttonWidth={160}
      >
        {maskAuto ? (
          '自动取遮罩中...'
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PlusOutlined />
            选区遮罩
          </span>
        )}
      </SyncButton>
    );

    const upperControls = (
      <div
        style={{
          height: topSectionHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <SyncButton
          disabled={false}
          isAutoSync={mainAuto}
          onSync={(event) => {
            handleMainSync(event);
          }}
          onAutoSyncToggle={(event) => handleMainAutoToggle(event)}
          buttonWidth={160}
        >
          {mainButtonLabel}
        </SyncButton>
        {mainAuto ? (
          <div
            style={{
              minHeight: 28,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              whiteSpace: 'pre-line',
              fontSize: 12,
              color: 'var(--sdppp-widget-muted-text, rgba(0, 0, 0, 0.65))',
              lineHeight: 1.2,
              padding: '0 4px',
              textAlign: 'center',
            }}
          >
            本节点默认继承
            {'\n'}
            主图
          </div>
        ) : (
          <SyncButton
            disabled={false}
            isAutoSync={advancedAuto}
            onSync={(event) => handleAdvancedSync(event)}
            onAutoSyncToggle={(event) => handleAdvancedAutoToggle(event)}
            onCancel={(event) => handleAdvancedCancel(event)}
            autoSyncEnabled={advancedExpanded}
            cancelEnabled={advancedExpanded}
            buttonWidth={160}
          >
            {advancedButtonLabel}
          </SyncButton>
        )}
      </div>
    );

    const leftContent = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {upperControls}
        <Divider />
        <div>{maskButton}</div>
      </div>
    );

    return (
      <ImagePreviewSplit
        left={leftContent}
        imageUrl={imageUrl}
        background="checkerboard"
        previewStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
    );
  },
};
