import { Button, Tooltip, Typography, Space } from 'antd';
import type { ButtonProps } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import React, { useCallback, useMemo } from 'react';

export interface SyncButtonProps {
  disabled: boolean;
  isAutoSync: boolean;
  onSync: (event: { altKey: boolean; shiftKey: boolean }) => void;
  onAutoSyncToggle: (event: { altKey: boolean; shiftKey: boolean }) => void;
  autoSyncEnabled?: boolean;
  autoSyncIcon?: React.ReactNode;
  children: React.ReactNode;
  descText?: string;
  syncButtonTooltip?: React.ReactNode;
  autoSyncButtonTooltips?: {
    enabled: React.ReactNode;
    disabled: React.ReactNode;
  };
  buttonWidth?: number | string;
  // customize main button style (e.g., 'primary')
  mainButtonType?: ButtonProps['type'];
  'data-testid'?: string;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  disabled,
  isAutoSync,
  onSync,
  onAutoSyncToggle,
  autoSyncEnabled = true,
  autoSyncIcon = <SyncOutlined />,
  children,
  descText,
  syncButtonTooltip,
  autoSyncButtonTooltips,
  buttonWidth,
  mainButtonType = 'default',
  ...rest
}) => {
  const autoSyncButtonIcon = useMemo(() =>
    React.cloneElement(autoSyncIcon as React.ReactElement, { spin: isAutoSync }),
  [autoSyncIcon, isAutoSync]);

  const handleSyncClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    onSync({ altKey: e.altKey, shiftKey: e.shiftKey });
  }, [onSync]);

  const handleAutoSyncToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    onAutoSyncToggle({ altKey: e.altKey, shiftKey: e.shiftKey });
  }, [onAutoSyncToggle]);

  const mainButton = useMemo(() => (
    <Button
      data-testid="sync-button-main"
      type={mainButtonType}
      size="middle"
      disabled={disabled}
      onClick={handleSyncClick}
      style={{ flex: '1 1 0%', position: 'relative', height: 28, minWidth: 0 }}
    >
      <div
        data-testid="sync-button-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          lineHeight: 1,
          gap: 0,
          width: '100%',
          minWidth: 0
        }}
      >
        <div
          data-testid="sync-button-main-content"
          style={{
            height: descText ? '50%' : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            width: '100%',
            minWidth: 0,
            padding: '0 4px',
            overflow: 'hidden'
          }}
        >
          <span
            style={{
              display: 'block',
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={typeof children === 'string' ? children : undefined}
          >
            {children}
          </span>
        </div>
        {descText ? (
          <div
            data-testid="sync-button-desc-container"
            style={{
              height: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%'
            }}
          >
            <Typography.Text
              data-testid="sync-button-desc"
              type="secondary"
              style={{ fontSize: 10, lineHeight: 1, pointerEvents: 'none', margin: 0 }}
            >
              {descText}
            </Typography.Text>
          </div>
        ) : null}
      </div>
    </Button>
  ), [disabled, handleSyncClick, children, mainButtonType, descText]);

  const autoSyncButton = useMemo(() => (
    <Button
      data-testid="sync-button-auto-sync"
      type={isAutoSync ? 'primary' : 'dashed'}
      icon={autoSyncButtonIcon}
      size="middle"
      disabled={disabled}
      onClick={handleAutoSyncToggle}
      style={{ height: 28, flex: '0 0 auto' }}
    />
  ), [isAutoSync, autoSyncButtonIcon, disabled, handleAutoSyncToggle]);

  const renderedAutoSyncButton = useMemo(() => {
    if (!autoSyncEnabled) return null;
    if (!autoSyncButtonTooltips) return autoSyncButton;
    const title = isAutoSync ? autoSyncButtonTooltips.enabled : autoSyncButtonTooltips.disabled;
    return <Tooltip title={title}>{autoSyncButton}</Tooltip>;
  }, [autoSyncEnabled, autoSyncButtonTooltips, isAutoSync, autoSyncButton]);

  const renderedMainButton = useMemo(() => {
    if (!syncButtonTooltip) return mainButton;
    return <Tooltip title={syncButtonTooltip}>{mainButton}</Tooltip>;
  }, [syncButtonTooltip, mainButton]);

  return (
    <div {...rest} style={{ display: 'inline-flex', margin: 0, padding: 0, verticalAlign: 'top', lineHeight: 1 }}>
      <Space.Compact style={{ width: buttonWidth, overflow: 'hidden' }} block>
        {renderedMainButton}
        {renderedAutoSyncButton}
      </Space.Compact>
    </div>
  );
};
