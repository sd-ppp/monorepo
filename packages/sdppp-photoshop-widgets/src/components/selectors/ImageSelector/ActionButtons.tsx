import { Button, Flex, Tooltip } from 'antd';
import type { LucideIcon } from 'lucide-react';
import { Plus, Scan, Scissors } from 'lucide-react';
import React, { useMemo } from 'react';

import { ACTION_BUTTON_MARGIN, ACTION_BUTTON_SIZE } from './constants';

interface ActionButtonsProps {
  shouldShowFallbackActionButton: boolean;
  cutLabel: string;
  scanLabel: string;
  cutTooltipText: string;
  scanTooltipText: string;
  renderTooltipLines: (text: string) => React.ReactNode;
  onFallback: () => Promise<void>;
  onCut: () => void;
  onScan: () => void;
}

const createIconWithPlusOverlay = (BaseIcon: LucideIcon) => {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
      }}
    >
      <Plus size={20} strokeWidth={2} />
      <BaseIcon
        size={10}
        strokeWidth={2}
        style={{
          position: 'absolute',
          right: -7,
          bottom: -7,
        }}
      />
    </span>
  );
};

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  shouldShowFallbackActionButton,
  cutLabel,
  scanLabel,
  cutTooltipText,
  scanTooltipText,
  renderTooltipLines,
  onFallback,
  onCut,
  onScan,
}) => {
  const actionButtonStyle = useMemo(
    () => ({
      width: ACTION_BUTTON_SIZE,
      height: ACTION_BUTTON_SIZE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      margin: ACTION_BUTTON_MARGIN,
    }),
    [],
  );

  const fallbackActionButtonStyle = useMemo(() => {
    const margin = ACTION_BUTTON_MARGIN;
    return {
      width: ACTION_BUTTON_SIZE,
      height: 98,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      margin,
    };
  }, []);

  return (
    <Flex
      vertical
      style={{
        flex: '0 0 auto',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        borderRadius: '0 var(--ant-border-radius-lg, 6px) var(--ant-border-radius-lg, 6px) 0',
        overflow: 'hidden',
      }}
      gap={0}
    >
      {shouldShowFallbackActionButton ? (
        <Tooltip
          placement="left"
          autoAdjustOverflow={false}
          title={renderTooltipLines(cutTooltipText)}
        >
          <Button
            type="primary"
            icon={<Plus size={20} strokeWidth={2} />}
            aria-label={cutLabel}
            title={cutLabel}
            style={fallbackActionButtonStyle}
            onClick={async () => {
              await onFallback();
            }}
          />
        </Tooltip>
      ) : (
        <>
          <Tooltip
            placement="left"
            autoAdjustOverflow={false}
            title={renderTooltipLines(cutTooltipText)}
          >
            <Button
              type="primary"
              icon={createIconWithPlusOverlay(Scissors)}
              aria-label={cutLabel}
              title={cutLabel}
              style={actionButtonStyle}
              onClick={onCut}
            />
          </Tooltip>
          <Tooltip
            placement="left"
            autoAdjustOverflow={false}
            title={renderTooltipLines(scanTooltipText)}
          >
            <Button
              type="primary"
              icon={createIconWithPlusOverlay(Scan)}
              aria-label={scanLabel}
              title={scanLabel}
              style={actionButtonStyle}
              onClick={onScan}
            />
          </Tooltip>
        </>
      )}
    </Flex>
  );
};
