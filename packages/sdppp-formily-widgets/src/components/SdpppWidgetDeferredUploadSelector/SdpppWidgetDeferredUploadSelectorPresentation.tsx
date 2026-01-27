import React from 'react';
import { Spin, Typography, theme } from 'antd';
import type { DeferredUploadStatus } from './types';

export interface SdpppWidgetDeferredUploadSelectorPresentationProps {
  /** 预览 URL */
  displayUrl: string;
  /** 显示标签 */
  label: string;
  /** 上传状态 */
  status: DeferredUploadStatus;
  /** 错误信息 */
  errorMessage: string | null;
  /** 点击预览回调（可选） */
  onPreviewClick?: () => void;
}

/**
 * 延迟上传选择器的展示层组件
 * 
 * 提供简化的 UI：预览 + 标签
 */
export const SdpppWidgetDeferredUploadSelectorPresentation: React.FC<
  SdpppWidgetDeferredUploadSelectorPresentationProps
> = ({
  displayUrl,
  label,
  status,
  errorMessage,
  onPreviewClick,
}) => {
  const { token } = theme.useToken();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  const previewWrapperStyle: React.CSSProperties = {
    flex: '0 0 auto',
    width: 140,
    height: 112,
    borderRadius: 4,
    border: `1px solid ${token.colorBorder}`,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    position: 'relative',
    overflow: 'hidden',
    cursor: onPreviewClick ? 'pointer' : 'default',
  };

  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 12px',
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.45)',
    textAlign: 'center',
    lineHeight: 1.4,
  };

  const labelStyle: React.CSSProperties = {
    flex: '1 1 auto',
    margin: 0,
    wordBreak: 'break-word',
  };

  return (
    <div style={containerStyle}>
      {/* 预览区域 */}
      <div style={previewWrapperStyle} onClick={onPreviewClick}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div style={placeholderStyle}>
            {status === 'generating' && <Spin size="small" />}
            {status === 'idle' && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {label}
              </Typography.Text>
            )}
            {status === 'error' && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {errorMessage || '获取预览失败'}
              </Typography.Text>
            )}
          </div>
        )}
      </div>

      {/* 标签 */}
      <Typography.Paragraph style={labelStyle}>
        {label}
      </Typography.Paragraph>
    </div>
  );
};

SdpppWidgetDeferredUploadSelectorPresentation.displayName = 'SdpppWidgetDeferredUploadSelectorPresentation';
