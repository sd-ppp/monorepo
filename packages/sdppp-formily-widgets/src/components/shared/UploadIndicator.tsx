import React, { useMemo } from 'react';
import { Alert, Progress } from 'antd';
import { useWidgetText } from '../../context/SdpppWidgetContext';

export interface UploadIndicatorProps {
  /** 上传状态 */
  status: 'idle' | 'uploading' | 'generating' | 'error';
  /** 错误消息 */
  errorMessage?: string;
  /** 当前进度 */
  progressCurrent?: number;
  /** 总进度 */
  progressTotal?: number;
  /** 错误消除回调 */
  onDismiss?: () => void;
  /** 容器样式 */
  containerStyle?: React.CSSProperties;
}

/**
 * 上传状态指示器组件
 * 
 * @remarks
 * 用于显示上传/生成进度和错误状态
 * 
 * @example
 * ```tsx
 * <UploadIndicator
 *   status="uploading"
 *   progressCurrent={3}
 *   progressTotal={10}
 * />
 * 
 * <UploadIndicator
 *   status="error"
 *   errorMessage="上传失败，请重试"
 *   onDismiss={handleDismiss}
 * />
 * ```
 */
export const UploadIndicator: React.FC<UploadIndicatorProps> = ({
  status,
  errorMessage,
  progressCurrent = 0,
  progressTotal = 0,
  onDismiss,
  containerStyle,
}) => {
  const t = useWidgetText();

  const progressPercent = useMemo(() => {
    if (progressTotal <= 0) return 0;
    return Math.round((progressCurrent / progressTotal) * 100);
  }, [progressCurrent, progressTotal]);

  const defaultContainerStyle: React.CSSProperties = {
    position: 'static',
    width: '100%',
    marginTop: 4,
    ...containerStyle,
  };

  // 错误状态
  if (status === 'error' && errorMessage) {
    return (
      <div style={defaultContainerStyle}>
        <Alert
          message={errorMessage}
          type="error"
          closable={Boolean(onDismiss)}
          onClose={onDismiss}
          showIcon
          style={{ fontSize: 12 }}
        />
      </div>
    );
  }

  // 上传中
  if (status === 'uploading') {
    return (
      <div style={defaultContainerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 4,
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'rgba(0, 0, 0, 0.65)',
            }}
          >
            {t('upload.indicator.uploading', { defaultValue: '上传中...' })}
          </div>
          {progressTotal > 0 && (
            <Progress
              percent={progressPercent}
              size="small"
              status="active"
              showInfo
              format={() => `${progressCurrent}/${progressTotal}`}
            />
          )}
        </div>
      </div>
    );
  }

  // 生成中
  if (status === 'generating') {
    return (
      <div style={defaultContainerStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            borderRadius: 4,
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'rgba(0, 0, 0, 0.65)',
            }}
          >
            {t('upload.indicator.generating', { defaultValue: '生成预览中...' })}
          </div>
          {progressTotal > 0 && (
            <Progress
              percent={progressPercent}
              size="small"
              status="active"
              showInfo
              format={() => `${progressCurrent}/${progressTotal}`}
            />
          )}
        </div>
      </div>
    );
  }

  // idle 状态不显示
  return null;
};

UploadIndicator.displayName = 'UploadIndicator';
