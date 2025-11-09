import { ImagePreviewFrame } from '@sdppp/ui-library';
import type { ImagePreviewSplitProps } from '@sdppp/ui-library';
import type { SpinSize } from 'antd/es/spin';
import React from 'react';
import { UploadIndicator, type UploadIndicatorStatus } from './UploadIndicator';

export interface UploadableImagePreviewSplitProps extends ImagePreviewSplitProps {
  uploadStatus?: UploadIndicatorStatus;
  uploadIndicatorUploadingMessage?: React.ReactNode;
  uploadIndicatorErrorMessage?: React.ReactNode;
  onUploadRetry?: () => void;
  onUploadDismiss?: () => void;
  uploadRetryLabel?: React.ReactNode;
  uploadDismissLabel?: React.ReactNode;
  uploadIndicatorSize?: SpinSize;
  uploadIndicatorContainerClassName?: string;
  uploadIndicatorContainerStyle?: React.CSSProperties;
  uploadIndicatorSpinnerClassName?: string;
  uploadIndicatorSpinnerStyle?: React.CSSProperties;
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
  uploadDismissLabel,
  uploadIndicatorSize,
  uploadIndicatorContainerClassName,
  uploadIndicatorContainerStyle,
  uploadIndicatorSpinnerClassName,
  uploadIndicatorSpinnerStyle,
  ...previewProps
}) => {
  const gapValue = typeof gap === 'number' ? `${gap}px` : gap;

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
      <div
        className={leftContainerClassName}
        style={{
          flex: '0 0 auto',
          ...leftContainerStyle,
        }}
      >
        {left}
      </div>
      <div
        className={rightContainerClassName}
        style={{
          position: 'relative',
          flex: '1 1 0%',
          minWidth: 160,
          ...rightContainerStyle,
        }}
      >
        <ImagePreviewFrame {...previewProps} />
        <UploadIndicator
          status={uploadStatus}
          uploadingMessage={uploadIndicatorUploadingMessage}
          errorMessage={uploadIndicatorErrorMessage}
          onRetry={onUploadRetry}
          retryLabel={uploadRetryLabel}
          onDismiss={onUploadDismiss}
          dismissLabel={uploadDismissLabel}
          size={uploadIndicatorSize}
          containerClassName={uploadIndicatorContainerClassName}
          containerStyle={uploadIndicatorContainerStyle}
          spinnerClassName={uploadIndicatorSpinnerClassName}
          spinnerStyle={uploadIndicatorSpinnerStyle}
        />
      </div>
    </div>
  );
};
