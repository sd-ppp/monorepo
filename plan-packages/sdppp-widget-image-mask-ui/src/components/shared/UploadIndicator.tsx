import { Button, Spin } from 'antd';
import type { SpinSize } from 'antd/es/spin';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import React, { useMemo } from 'react';
import { useWidgetText } from '../../context/WidgetImageMaskContext';

export type UploadIndicatorStatus = 'idle' | 'uploading' | 'error';

export interface UploadIndicatorProps {
  status?: UploadIndicatorStatus;
  visible?: boolean;
  uploadingMessage?: React.ReactNode;
  errorMessage?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  spinnerClassName?: string;
  spinnerStyle?: React.CSSProperties;
  size?: SpinSize;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: React.ReactNode;
}

const DEFAULT_CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(255, 255, 255, 0.78)',
  zIndex: 10,
  borderRadius: 'var(--sdppp-widget-border-radius, 4px)',
};

export const UploadIndicator: React.FC<UploadIndicatorProps> = ({
  status,
  visible,
  uploadingMessage,
  errorMessage,
  containerStyle,
  containerClassName,
  spinnerClassName,
  spinnerStyle,
  size = 'small',
  onRetry,
  retryLabel,
  onDismiss,
  dismissLabel,
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

  const resolvedDismissLabel = useMemo(
    () =>
      dismissLabel ??
      t('image.upload.dismiss', {
        defaultValue: '知道了',
      }),
    [dismissLabel, t],
  );

  if (resolvedStatus === 'idle') return null;

  const pointerEvents =
    resolvedStatus === 'error' && (onRetry || onDismiss) ? 'auto' : resolvedStatus === 'error' ? 'auto' : 'none';

  return (
    <div
      className={containerClassName}
      style={{
        ...DEFAULT_CONTAINER_STYLE,
        pointerEvents,
        ...containerStyle,
      }}
      aria-live={resolvedStatus === 'uploading' ? 'polite' : 'assertive'}
    >
      {resolvedStatus === 'uploading' ? (
        <Spin
          tip={resolvedUploadingMessage}
          size={size}
          className={spinnerClassName}
          style={spinnerStyle}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            minWidth: 200,
            maxWidth: 260,
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: 'var(--sdppp-widget-border-radius, 4px)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
            textAlign: 'center',
          }}
        >
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.85)', lineHeight: 1.5 }}>
            {resolvedErrorMessage}
          </div>
          {onRetry || onDismiss ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {onRetry ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={onRetry}
                >
                  {resolvedRetryLabel}
                </Button>
              ) : null}
              {onDismiss ? (
                <Button
                  size="small"
                  onClick={onDismiss}
                >
                  {resolvedDismissLabel}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
