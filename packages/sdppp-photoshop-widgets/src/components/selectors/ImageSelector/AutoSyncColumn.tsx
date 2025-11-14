import { Button, Flex } from 'antd';
import React from 'react';

import { SECTION_SIZE, SYNC_BUTTON_WIDTH } from './constants';

interface AutoSyncColumnProps {
  widgetableId: string;
  autoButtonIcon: React.ReactElement;
  syncButtonIcon: React.ReactElement;
  onAutoToggle: () => void;
  onSyncHoverStart: () => void;
  onSyncHoverEnd: () => void;
}

export const AutoSyncColumn: React.FC<AutoSyncColumnProps> = ({
  widgetableId,
  autoButtonIcon,
  syncButtonIcon,
  onAutoToggle,
  onSyncHoverStart,
  onSyncHoverEnd,
}) => {
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
      <Button
        type="text"
        data-testid={`single-image-auto-toggle-${widgetableId}`}
        icon={autoButtonIcon}
        style={{
          flex: 1,
          width: '100%',
          borderRadius: 0,
          border: 'none',
          borderBottom: '1px solid var(--sdppp-widget-border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        onClick={onAutoToggle}
      />
      <Button
        type="text"
        icon={syncButtonIcon}
        data-testid={`single-image-sync-${widgetableId}`}
        style={{
          width: '100%',
          height: 28,
          minHeight: 28,
          padding: 0,
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: 'none',
        }}
        onMouseEnter={onSyncHoverStart}
        onMouseLeave={onSyncHoverEnd}
      />
    </Flex>
  );
};
