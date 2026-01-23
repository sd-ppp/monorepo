import { Button, Tooltip, Typography, Space } from 'antd';
import type { ButtonProps } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import { RefreshCw } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

const SPIN_STYLE_ID = 'sdppp-sync-button-spin-style';
const ensureSpinStyle = () => {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(SPIN_STYLE_ID)) {
    return;
  }
  const styleElement = document.createElement('style');
  styleElement.id = SPIN_STYLE_ID;
  styleElement.textContent = `
    @keyframes sdppp-sync-button-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleElement);
};

const DEFAULT_AUTO_SYNC_ICON = <RefreshCw size={18} strokeWidth={2} />;
const AUTO_PRIMARY_SIZE = 28;
const DEFAULT_CROSS_SIZE = 28;

export interface SyncButtonProps extends React.HTMLAttributes<HTMLDivElement> {
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
  /**
   * Size along the primary axis of the control.
   * Vertical => total height, Horizontal => total width.
   */
  buttonSize?: number | string;
  /**
   * Size along the secondary axis of the control.
   * Vertical => width (and auto button square size), Horizontal => height.
   */
  buttonSizeSub?: number | string;
  // customize main button style (e.g., 'primary')
  mainButtonType?: ButtonProps['type'];
  mainButtonStyle?: React.CSSProperties;
  autoSyncButtonStyle?: React.CSSProperties;
  mainButtonDisabled?: boolean;
  tooltipPlacement?: TooltipPlacement;
  autoTooltipPlacement?: TooltipPlacement;
  direction?: 'horizontal' | 'vertical';
  collapseToAutoWhenEnabled?: boolean;
}

const toNumber = (value: number | string | undefined): number | undefined =>
  typeof value === 'number' ? value : undefined;

export const SyncButton: React.FC<SyncButtonProps> = ({
  disabled,
  isAutoSync,
  onSync,
  onAutoSyncToggle,
  autoSyncEnabled = true,
  autoSyncIcon,
  children,
  descText,
  syncButtonTooltip,
  autoSyncButtonTooltips,
  buttonSize,
  buttonSizeSub,
  mainButtonType = 'default',
  mainButtonStyle,
  autoSyncButtonStyle,
  mainButtonDisabled = false,
  tooltipPlacement = 'top',
  autoTooltipPlacement = 'top',
  direction = 'horizontal',
  collapseToAutoWhenEnabled = false,
  ...rest
}) => {
  const { style: restStyle, ...restProps } = rest;
  const defaultOffset: [number, number] = [0, -8];
  const isVertical = direction === 'vertical';
  const autoCrossCss = useMemo(() => {
    if (typeof buttonSizeSub === 'number') return `${buttonSizeSub}px`;
    if (typeof buttonSizeSub === 'string') return buttonSizeSub;
    return `${DEFAULT_CROSS_SIZE}px`;
  }, [buttonSizeSub]);
  const shouldCollapseToAuto = collapseToAutoWhenEnabled && autoSyncEnabled && isAutoSync;
  const autoButtonVisible = autoSyncEnabled && !shouldCollapseToAuto;

  const resolvedAutoSyncIcon = useMemo<React.ReactElement>(() => {
    if (React.isValidElement(autoSyncIcon)) {
      return autoSyncIcon;
    }
    return DEFAULT_AUTO_SYNC_ICON;
  }, [autoSyncIcon]);

  const autoSyncButtonIcon = useMemo(() => {
    const baseClassName = resolvedAutoSyncIcon.props.className ?? '';
    const mergedClassName = [
      'sync-button-auto-icon',
      baseClassName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return React.cloneElement(resolvedAutoSyncIcon, {
      className: mergedClassName || undefined,
    });
  }, [resolvedAutoSyncIcon]);

  const handleSyncClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    onSync({ altKey: e.altKey, shiftKey: e.shiftKey });
  }, [onSync]);

  const handleAutoSyncToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    onAutoSyncToggle({ altKey: e.altKey, shiftKey: e.shiftKey });
  }, [onAutoSyncToggle]);

  const mainPrimaryNumber = useMemo(() => {
    if (typeof buttonSize === 'number') {
      return autoButtonVisible
        ? Math.max(buttonSize - AUTO_PRIMARY_SIZE, DEFAULT_CROSS_SIZE)
        : buttonSize;
    }
    if (buttonSize === undefined) {
      return autoButtonVisible
        ? Math.max(64 - AUTO_PRIMARY_SIZE, DEFAULT_CROSS_SIZE)
        : 64;
    }
    // string case fallback for numeric usage
    return autoButtonVisible
      ? Math.max(64 - AUTO_PRIMARY_SIZE, DEFAULT_CROSS_SIZE)
      : 64;
  }, [buttonSize, autoButtonVisible]);

  const mainPrimaryCss = useMemo(() => {
    if (typeof buttonSize === 'string') {
      return autoButtonVisible
        ? `calc(${buttonSize} - ${AUTO_PRIMARY_SIZE}px)`
        : buttonSize;
    }
    return `${mainPrimaryNumber}px`;
  }, [buttonSize, autoButtonVisible, mainPrimaryNumber]);

  const collapsePrimaryCss = useMemo(() => {
    if (typeof buttonSize === 'string') {
      return buttonSize;
    }
    if (typeof buttonSize === 'number') {
      return `${buttonSize}px`;
    }
    return `${mainPrimaryNumber}px`;
  }, [buttonSize, mainPrimaryNumber]);

  const mainButton = useMemo(() => (
    <Button
      data-testid="sync-button-main"
      type={mainButtonType}
      size="middle"
      disabled={disabled || mainButtonDisabled}
      onClick={handleSyncClick}
      block={isVertical}
      style={{
        flex: isVertical ? '0 0 auto' : '1 1 0%',
        position: 'relative',
        height: isVertical ? mainPrimaryCss : autoCrossCss,
        minWidth: 0,
        width: isVertical ? '100%' : mainPrimaryCss,
        ...(isVertical ? { padding: 0, fontSize: 12 } : {}),
        ...mainButtonStyle,
      }}
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
            padding: isVertical ? 0 : '0 4px',
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
  ), [
    disabled,
    mainButtonDisabled,
    handleSyncClick,
    children,
    mainButtonType,
    descText,
    isVertical,
    mainPrimaryCss,
    autoCrossCss,
    mainButtonStyle,
  ]);

  const autoSyncButton = useMemo(() => (
    <Button
      data-testid="sync-button-auto-sync"
      type={isAutoSync ? 'primary' : 'dashed'}
      icon={autoSyncButtonIcon}
      size="middle"
      disabled={disabled}
      onClick={handleAutoSyncToggle}
      block={isVertical}
      style={{
        height: isVertical
          ? (shouldCollapseToAuto ? collapsePrimaryCss : `${AUTO_PRIMARY_SIZE}px`)
          : autoCrossCss,
        width: isVertical
          ? (shouldCollapseToAuto ? '100%' : autoCrossCss)
          : (shouldCollapseToAuto ? collapsePrimaryCss : `${AUTO_PRIMARY_SIZE}px`),
        flex: isVertical ? '0 0 auto' : '0 0 auto',
        alignSelf: isVertical ? 'flex-start' : 'center',
        ...((isVertical || shouldCollapseToAuto)
          ? { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
          : {}),
        ...autoSyncButtonStyle,
      }}
    />
  ), [
    isAutoSync,
    autoSyncButtonIcon,
    disabled,
    handleAutoSyncToggle,
    isVertical,
    autoCrossCss,
    shouldCollapseToAuto,
    collapsePrimaryCss,
    autoSyncButtonStyle,
  ]);

  const renderedAutoSyncButton = useMemo(() => {
    if (!autoSyncEnabled) return null;
    if (!autoSyncButtonTooltips) return autoSyncButton;
    const title = isAutoSync ? autoSyncButtonTooltips.enabled : autoSyncButtonTooltips.disabled;
    const autoAlign =
      autoTooltipPlacement === 'top' ? { offset: defaultOffset } : undefined;
    return (
      <Tooltip
        title={title}
        placement={autoTooltipPlacement}
        align={autoAlign}
        getPopupContainer={() => document.body}
      >
        {autoSyncButton}
      </Tooltip>
    );
  }, [autoSyncEnabled, autoSyncButtonTooltips, isAutoSync, autoSyncButton, autoTooltipPlacement]);

  const renderedMainButton = useMemo(() => {
    if (!syncButtonTooltip) return mainButton;
    const align =
      tooltipPlacement === 'top' ? { offset: defaultOffset } : undefined;
    return (
      <Tooltip
        title={syncButtonTooltip}
        placement={tooltipPlacement}
        align={align}
        getPopupContainer={() => document.body}
      >
        {mainButton}
      </Tooltip>
    );
  }, [syncButtonTooltip, mainButton, tooltipPlacement]);

  const totalPrimarySizeCss = useMemo(() => {
    if (shouldCollapseToAuto) {
      return collapsePrimaryCss;
    }
    if (typeof buttonSize === 'string') {
      return buttonSize;
    }
    if (typeof buttonSize === 'number') {
      return `${buttonSize}px`;
    }
    const base = autoButtonVisible
      ? mainPrimaryNumber + AUTO_PRIMARY_SIZE
      : mainPrimaryNumber;
    return `${base}px`;
  }, [shouldCollapseToAuto, buttonSize, autoButtonVisible, mainPrimaryNumber, collapsePrimaryCss]);

  const containerStyle = useMemo(() => {
    if (isVertical) {
      return {
        overflow: 'hidden' as const,
        width:
          buttonSizeSub !== undefined
            ? (typeof buttonSizeSub === 'number' ? `${buttonSizeSub}px` : buttonSizeSub)
            : autoCrossCss,
        height: totalPrimarySizeCss,
      };
    }

    return {
      overflow: 'hidden' as const,
      width: totalPrimarySizeCss,
      height: autoCrossCss,
    };
  }, [isVertical, buttonSizeSub, autoCrossCss, totalPrimarySizeCss]);

  const buttonsToRender = shouldCollapseToAuto
    ? [{ key: 'auto', element: renderedAutoSyncButton }]
    : [
        { key: 'auto', element: renderedAutoSyncButton },
        { key: 'main', element: renderedMainButton },
      ];

  const content = (
    <Space.Compact
      direction={isVertical ? 'vertical' : 'horizontal'}
      block={!isVertical}
      style={containerStyle}
    >
      {buttonsToRender.map(({ key, element }) => (
        <React.Fragment key={key}>{element}</React.Fragment>
      ))}
    </Space.Compact>
  );

  return (
    <div
      {...restProps}
      style={{
        display: 'inline-flex',
        margin: 0,
        padding: 0,
        verticalAlign: 'top',
        lineHeight: 1,
        ...restStyle,
      }}
    >
      {content}
    </div>
  );
};
