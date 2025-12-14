import { Button, Tooltip } from 'antd';
import type { TooltipPlacement } from 'antd/es/tooltip';
import React, { useMemo } from 'react';
import { useWidgetDebug } from '../../context/PhotoshopWidgetContext';

export interface DebugBadgeProps {
  details: Record<string, React.ReactNode>;
  placement?: TooltipPlacement;
  containerStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  className?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  size?: 'small' | 'middle' | 'large';
  tooltip?: React.ReactNode;
}

const DEFAULT_CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 4,
  bottom: 4,
  zIndex: 10,
};

const DEFAULT_TOOLTIP_OVERLAY_STYLE: React.CSSProperties = {
  maxWidth: 280,
};

const renderDetails = (details: Record<string, React.ReactNode>): React.ReactNode => (
  <div style={{ fontSize: 10, lineHeight: 1.4 }}>
    {Object.entries(details).map(([key, value]) => (
      <div key={key}>
        {key}: {value ?? '-'}
      </div>
    ))}
  </div>
);

export const DebugBadge: React.FC<DebugBadgeProps> = ({
  details,
  placement = 'topRight',
  containerStyle,
  buttonStyle,
  className,
  buttonClassName,
  buttonLabel = 'dbg',
  size = 'small',
  tooltip,
}) => {
  const debug = useWidgetDebug();

  const resolvedTooltip = useMemo(() => tooltip ?? renderDetails(details), [tooltip, details]);
  const popupContainer = useMemo<(() => HTMLElement) | undefined>(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    return () => document.body;
  }, []);

  if (!debug) return null;

  const mergedContainerStyle = {
    ...DEFAULT_CONTAINER_STYLE,
    ...containerStyle,
  };

  const isSmall = size === 'small';

  return (
    <div className={className} style={mergedContainerStyle}>
      <Tooltip
        title={resolvedTooltip}
        placement={placement}
        overlayStyle={DEFAULT_TOOLTIP_OVERLAY_STYLE}
        getPopupContainer={popupContainer}
      >
        <Button
          type="default"
          size={size}
          className={buttonClassName}
          style={{
            padding: isSmall ? '0 6px' : undefined,
            height: isSmall ? 20 : undefined,
            fontSize: isSmall ? 10 : undefined,
            lineHeight: isSmall ? '18px' : undefined,
            ...buttonStyle,
          }}
        >
          {buttonLabel}
        </Button>
      </Tooltip>
    </div>
  );
};
