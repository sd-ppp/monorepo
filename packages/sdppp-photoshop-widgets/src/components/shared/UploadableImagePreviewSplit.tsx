import type { ImagePreviewSplitProps } from '@sdppp/ui-library';
import { ImagePreviewFrame } from '@sdppp/ui-library';
import React from 'react';
import { UploadIndicator, type UploadIndicatorStatus } from './UploadIndicator';

export interface UploadableImagePreviewSplitProps extends ImagePreviewSplitProps {
  uploadStatus?: UploadIndicatorStatus;
  uploadIndicatorUploadingMessage?: React.ReactNode;
  uploadIndicatorErrorMessage?: React.ReactNode;
  onUploadRetry?: () => void;
  onUploadDismiss?: () => void;
  uploadRetryLabel?: React.ReactNode;
  uploadIndicatorProgressCurrent?: number;
  uploadIndicatorProgressTotal?: number;
  uploadIndicatorContainerClassName?: string;
  uploadIndicatorContainerStyle?: React.CSSProperties;
  indicatorPlacement?: 'overlay' | 'below';
}

export const UploadableImagePreviewSplit: React.FC<UploadableImagePreviewSplitProps> = ({
  left,
  gap = 8,
  className,
  style,
  leftContainerClassName,
  leftContainerStyle,
  rightContainerClassName,
  rightContainerStyle,
  uploadStatus = 'idle',
  uploadIndicatorUploadingMessage,
  uploadIndicatorErrorMessage,
  onUploadRetry,
  onUploadDismiss,
  uploadRetryLabel,
  uploadIndicatorProgressCurrent,
  uploadIndicatorProgressTotal,
  uploadIndicatorContainerClassName,
  uploadIndicatorContainerStyle,
  indicatorPlacement = 'overlay',
  ...previewProps
}) => {
  const gapValue = typeof gap === 'number' ? `${gap}px` : gap;

  const leftSection = (
    <div
      className={leftContainerClassName}
      style={{
        flex: '0 0 auto',
        ...leftContainerStyle,
      }}
    >
      {left}
    </div>
  );

  const rightSection = (
    <div
      className={rightContainerClassName}
      style={{
        position: indicatorPlacement === 'overlay' ? 'relative' : 'static',
        flex: '1 1 0%',
        minWidth: 160,
        ...rightContainerStyle,
      }}
    >
      <ImagePreviewFrame {...previewProps} />
    </div>
  );

  if (indicatorPlacement === 'below') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          ...style,
        }}
        data-testid={previewProps['data-testid']}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: gapValue,
            width: '100%',
          }}
        >
          {leftSection}
          <div
            className={rightContainerClassName}
            style={{
              flex: '1 1 0%',
              minWidth: 160,
              ...rightContainerStyle,
            }}
          >
            <ImagePreviewFrame {...previewProps} />
          </div>
        </div>
        <UploadIndicator
          status={uploadStatus}
          uploadingMessage={uploadIndicatorUploadingMessage}
          errorMessage={uploadIndicatorErrorMessage}
          onRetry={onUploadRetry}
          retryLabel={uploadRetryLabel}
          onDismiss={onUploadDismiss}
          progressCurrent={uploadIndicatorProgressCurrent}
          progressTotal={uploadIndicatorProgressTotal}
          containerClassName={uploadIndicatorContainerClassName}
          containerStyle={{
            position: 'static',
            width: '100%',
            marginTop: 4,
            ...uploadIndicatorContainerStyle,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: gapValue,
        width: '100%',
        ...style,
      }}
      data-testid={previewProps['data-testid']}
    >
      {leftSection}
      {rightSection}
    </div>
  );
};
