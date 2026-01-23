import { Button } from 'antd';
import React, { useMemo, useCallback } from 'react';
import { useWidgetText } from '../../context/PhotoshopWidgetContext';

export type UploadIndicatorStatus = 'idle' | 'uploading' | 'error';

export interface UploadIndicatorProps {
  status?: UploadIndicatorStatus;
  visible?: boolean;
  uploadingMessage?: React.ReactNode;
  errorMessage?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  onDismiss?: () => void;
  progressCurrent?: number;
  progressTotal?: number;
}

const TEXT_STYLE: React.CSSProperties = {
  fontSize: 11,
  lineHeight: '16px',
  letterSpacing: 0.2,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
};

const getBarVisualStyle = (status: UploadIndicatorStatus): React.CSSProperties => {
  if (status === 'error') {
    return {
      background: 'var(--ant-color-error-bg, #fff1f0)',
      border: '1px solid var(--ant-color-error, #ff4d4f)',
      color: 'var(--ant-color-error, #ff4d4f)',
    };
  }
  return {
    background: 'var(--ant-color-bg-elevated, rgba(255,255,255,0.95))',
    border: '1px solid rgba(0,0,0,0.06)',
    color: 'var(--ant-color-text, rgba(0,0,0,0.75))',
  };
};

export const UploadIndicator: React.FC<UploadIndicatorProps> = ({
  status,
  visible,
  uploadingMessage,
  errorMessage,
  containerStyle,
  containerClassName,
  onRetry,
  retryLabel,
  onDismiss,
  progressCurrent,
  progressTotal,
}) => {
  const t = useWidgetText();

  const resolvedStatus = useMemo<UploadIndicatorStatus>(() => {
    if (status) return status;
    if (typeof visible === 'boolean') {
      return visible ? 'uploading' : 'idle';
    }
    return 'idle';
  }, [status, visible]);

  const resolvedUploadingMessage = useMemo(
    () =>
      uploadingMessage ??
      t('image.upload.uploading', {
        defaultValue: '上传中，如果图片过大，可能会卡顿...',
      }),
    [uploadingMessage, t],
  );

  const resolvedErrorMessage = useMemo(
    () =>
      errorMessage ??
      t('image.upload.error', {
        defaultValue: '上传失败，请重试',
      }),
    [errorMessage, t],
  );

  const resolvedRetryLabel = useMemo(
    () =>
      retryLabel ??
      t('image.upload.retry', {
        defaultValue: '重试',
      }),
    [retryLabel, t],
  );

  const isError = resolvedStatus === 'error';

  const handleBarClick = useCallback(() => {
    if (isError && onDismiss) {
      onDismiss();
    }
  }, [isError, onDismiss]);

  if (resolvedStatus === 'idle') return null;

  const normalizedTotal =
    typeof progressTotal === 'number' && Number.isFinite(progressTotal)
      ? Math.max(0, Math.round(progressTotal))
      : undefined;
  const normalizedCurrent =
    normalizedTotal !== undefined
      ? Math.max(0, Math.min(Math.round(progressCurrent ?? 0), normalizedTotal))
      : undefined;

  const visualStyle = getBarVisualStyle(resolvedStatus);
  const interactable = isError && (onRetry || onDismiss);
  const pointerEvents = interactable ? 'auto' : 'none';
  const containerCursor = isError && onDismiss ? 'pointer' : 'default';

  const message = isError ? resolvedErrorMessage : resolvedUploadingMessage;
  const showProgress =
    normalizedTotal !== undefined &&
    normalizedCurrent !== undefined &&
    !(
      normalizedTotal === 0 &&
      normalizedCurrent === 0 &&
      !uploadingMessage
    );

  return (
    <div
      className={containerClassName}
      style={{
        pointerEvents,
        ...containerStyle,
      }}
      aria-live={resolvedStatus === 'uploading' ? 'polite' : 'assertive'}
    >
      <div
        onClick={handleBarClick}
        role={isError && onDismiss ? 'button' : undefined}
        tabIndex={isError && onDismiss ? 0 : undefined}
        onKeyDown={event => {
          if (!onDismiss || !isError) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onDismiss();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '6px 14px',
          borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          cursor: containerCursor,
          ...visualStyle,
        }}
      >
        <span
          style={{
            ...TEXT_STYLE,
            flex: '1 1 auto',
            cursor: containerCursor,
            display: 'inline-block',
          }}
        >
          {showProgress ? `(${normalizedCurrent ?? 0}/${normalizedTotal}) ` : null}
          {message}
        </span>
        {isError && onRetry ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              type="primary"
              onClick={event => {
                event.stopPropagation();
                onRetry();
              }}
            >
              {resolvedRetryLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
