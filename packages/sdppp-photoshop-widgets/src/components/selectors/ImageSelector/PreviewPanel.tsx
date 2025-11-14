import { ImagePreviewFrame } from '@sdppp/ui-library';
import { Button, Flex, Tooltip } from 'antd';
import React from 'react';

import { DebugBadge } from '../../shared/DebugBadge';
import {
  SECTION_SIZE,
  STATUS_BAR_FADE_DISTANCE,
  STATUS_BAR_HEIGHT,
} from './constants';
import type { ModeButtonDescriptor, SourceMode } from './types';

interface PreviewPanelProps {
  widgetableId: string;
  displayUrl: string;
  debugDetails: unknown;
  isStatusBarVisible: boolean;
  onStatusBarHoverChange: (hovered: boolean) => void;
  modeButtons: ModeButtonDescriptor[];
  activeMode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  statusCurrentLabel: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  widgetableId,
  displayUrl,
  debugDetails,
  isStatusBarVisible,
  onStatusBarHoverChange,
  modeButtons,
  activeMode,
  onModeChange,
  statusCurrentLabel,
}) => {
  return (
    <Flex
      style={{
        flex: '1 1 auto',
        minWidth: SECTION_SIZE,
        height: SECTION_SIZE,
        position: 'relative',
        overflow: 'hidden',
      }}
      gap={0}
    >
      <ImagePreviewFrame
        imageUrl={displayUrl}
        background="checkerboard"
        containerStyle={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none' }}
        data-testid={`single-image-preview-${widgetableId}`}
      />
      <DebugBadge details={debugDetails} />
      <div
        onMouseEnter={() => onStatusBarHoverChange(true)}
        onMouseLeave={() => onStatusBarHoverChange(false)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          transform: isStatusBarVisible ? 'translateY(0)' : `translateY(${STATUS_BAR_FADE_DISTANCE}px)`,
          opacity: isStatusBarVisible ? 1 : 0,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: isStatusBarVisible ? 'auto' : 'none',
          background:
            'linear-gradient(0deg, rgba(22, 22, 22, 0.62) 0%, rgba(22, 22, 22, 0.36) 50%, rgba(22, 22, 22, 0) 100%)',
          padding: '0 8px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            minHeight: STATUS_BAR_HEIGHT,
            height: STATUS_BAR_HEIGHT,
            padding: 0,
            color: '#fff',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              gap: 4,
            }} 
          >
            {modeButtons.map(({ mode, icon: InactiveIcon, activeIcon, tooltip }) => {
              const isActive = activeMode === mode;
              const IconComponent = isActive && activeIcon ? activeIcon : InactiveIcon;
              const iconColor = '#ffffff';
              return (
                <Tooltip key={mode} placement="top" title={tooltip}>
                  <Button
                    type={isActive ? 'default' : 'text'}
                    shape="circle"
                    size="small"
                    onClick={() => onModeChange(mode)}
                    aria-pressed={isActive}
                    aria-label={tooltip}
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: iconColor,
                    }}
                    icon={<IconComponent size={14} strokeWidth={2} color={iconColor} />}
                  />
                </Tooltip>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 0,
              fontSize: 11,
              lineHeight: 1,
              fontWeight: 500,
              textAlign: 'right',
            }}
          >
            <span>{statusCurrentLabel}</span>
          </div>
        </div>
      </div>
    </Flex>
  );
};
