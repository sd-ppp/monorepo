import { ImagePreviewFrame } from '@sdppp/ui-library';
import { Flex } from 'antd';
import React from 'react';

import { DebugBadge } from '../../shared/DebugBadge';

interface PreviewPanelPresentationProps {
  displayUrl: string;
  overlayDisplayUrl: string;
  overlayVisible?: boolean;
  widgetableId?: string;
  debugDetails?: unknown;
}

export const PreviewPanelPresentation: React.FC<PreviewPanelPresentationProps> = ({
  displayUrl,
  overlayDisplayUrl,
  overlayVisible = false,
  widgetableId,
  debugDetails,
}) => {
  const basePreviewTestId = widgetableId ? `single-image-preview-${widgetableId}` : undefined;
  const overlayPreviewTestId = widgetableId
    ? `single-image-preview-overlay-${widgetableId}`
    : undefined;

  return (
    <Flex
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        flex: '1 1 auto',
      }}
      gap={0}
    >
      <ImagePreviewFrame
        imageUrl={displayUrl}
        background="checkerboard"
        containerStyle={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none' }}
        data-testid={basePreviewTestId}
      />
      {overlayDisplayUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: overlayVisible ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <ImagePreviewFrame
            imageUrl={overlayDisplayUrl}
            background="white"
            containerStyle={{
              borderRadius: 0,
              borderTop: 'none',
              borderBottom: 'none',
              background: 'transparent',
              border: 'none',
            }}
            previewStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
            }}
            data-testid={overlayPreviewTestId}
          />
        </div>
      ) : null}
      {debugDetails ? <DebugBadge details={debugDetails} /> : null}
    </Flex>
  );
};
