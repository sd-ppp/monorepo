import { Button, Flex, theme } from 'antd';
import { Trash2 } from 'lucide-react';
import React from 'react';

import { SECTION_SIZE, SYNC_BUTTON_WIDTH } from './constants';

interface AutoSyncColumnProps {
  widgetableId: string;
  syncButtonIcon: React.ReactElement;
  clearButtonTooltip: string;
  onSyncHoverStart: () => void;
  onSyncHoverEnd: () => void;
  onClear: () => void;
}

export const AutoSyncColumn: React.FC<AutoSyncColumnProps> = ({
  widgetableId,
  syncButtonIcon,
  clearButtonTooltip,
  onSyncHoverStart,
  onSyncHoverEnd,
  onClear,
}) => {
  const { token } = theme.useToken();
  const sharedButtonStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 28,
    height: 28,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  };
  const dividerStyle = `1px solid ${token.colorBorder}`;

  return (
    <Flex
      vertical
      style={{
        height: SECTION_SIZE,
        flex: '0 0 auto',
        width: SYNC_BUTTON_WIDTH,
        overflow: 'hidden',
      }}
      gap={0}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          borderBottom: dividerStyle,
        }}
      >
        <Button
          type="text"
          data-testid={`single-image-clear-${widgetableId}`}
          icon={<Trash2 size={18} strokeWidth={2} />}
          style={{
            height: '100%',
            width: '100%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 0,
            border: 'none',
          }}
          onClick={onClear}
          aria-label={clearButtonTooltip}
        />
      </div>
      <Button
        type="text"
        icon={syncButtonIcon}
        data-testid={`single-image-sync-${widgetableId}`}
        style={{
          ...sharedButtonStyle,
          borderTop: dividerStyle,
        }}
        onMouseEnter={onSyncHoverStart}
        onMouseLeave={onSyncHoverEnd}
      />
    </Flex>
  );
};
