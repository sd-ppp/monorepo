import { Button, Flex, Spin, Tooltip, theme, Typography } from 'antd';
import { FileUp, Image as ImageIcon, Import as ImportIcon, Trash2 } from 'lucide-react';
import React from 'react';

import type { FileDropZoneHandlers } from '../../hooks/useFileDropZone';
import { PreviewPanelPresentation } from '../ImageSelector/PreviewPanelPresentation';
import {
  ACTION_BUTTON_MARGIN,
  ACTION_BUTTON_SIZE,
  SECTION_SIZE,
  SYNC_BUTTON_WIDTH,
} from '../ImageSelector/constants';
import type { UploadStatus } from './types';

const { Text } = Typography;

interface SdpppWidgetControlColumnProps {
  onClear: () => void;
  clearTooltip: string;
}

const SdpppWidgetControlColumn: React.FC<SdpppWidgetControlColumnProps> = ({ onClear, clearTooltip }) => (
  <Button
    type="text"
    icon={<Trash2 size={18} strokeWidth={2} />}
    aria-label={clearTooltip}
    title={clearTooltip}
    onClick={onClear}
    style={{
      height: SECTION_SIZE,
      flex: '0 0 auto',
      width: SYNC_BUTTON_WIDTH,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
      border: 'none',
    }}
  />
);

interface SdpppWidgetActionButtonsProps {
  onFetchCanvas: () => void;
  fetchCanvasTooltip: string;
  onSelectLocal: () => void;
  selectLocalTooltip: string;
}

const SdpppWidgetActionButtons: React.FC<SdpppWidgetActionButtonsProps> = ({
  onFetchCanvas,
  fetchCanvasTooltip,
  onSelectLocal,
  selectLocalTooltip,
}) => {
  const canvasIcon = React.useMemo(
    () => (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
        }}
      >
        <ImportIcon
          size={20}
          strokeWidth={2}
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '50% 50%',
          }}
        />
      </span>
    ),
    [],
  );
  const buttonStyle: React.CSSProperties = {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: '0 var(--ant-border-radius-lg, 6px) var(--ant-border-radius-lg, 6px) 0',
        overflow: 'hidden',
        padding: ACTION_BUTTON_MARGIN,
        gap: ACTION_BUTTON_MARGIN,
      }}
    >
      <Tooltip placement="left" autoAdjustOverflow={false} title={fetchCanvasTooltip}>
        <Button
          type="primary"
          icon={canvasIcon}
          aria-label={fetchCanvasTooltip}
          style={{
            ...buttonStyle,
            alignSelf: 'center',
          }}
          onClick={onFetchCanvas}
        />
      </Tooltip>
      <Tooltip placement="left" autoAdjustOverflow={false} title={selectLocalTooltip}>
        <Button
          type="primary"
          icon={<FileUp size={20} strokeWidth={2} />}
          aria-label={selectLocalTooltip}
          style={{
            ...buttonStyle,
            alignSelf: 'center',
          }}
          onClick={onSelectLocal}
        />
      </Tooltip>
    </div>
  );
};

export interface SdpppWidgetUploadSelectorPresentationProps {
  widgetableId: string;
  dropHint: string;
  isDragging: boolean;
  dropHandlers: FileDropZoneHandlers;
  dropOverlayBackground: string;
  dropOverlayBorder: string;
  dropOverlayText: string;
  onClear: () => void;
  clearTooltip: string;
  onFetchCanvas: () => void;
  fetchCanvasTooltip: string;
  onSelectLocal: () => void;
  selectLocalTooltip: string;
  previewUrl: string;
  overlayUrl: string;
  hasPreview: boolean;
  onPreviewClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  placeholderLabel: string;
  status: UploadStatus;
  statusMessage: string | null;
  statusLabel: string;
  onStatusDismiss: () => void;
}

export const SdpppWidgetUploadSelectorPresentation: React.FC<SdpppWidgetUploadSelectorPresentationProps> = ({
  widgetableId,
  dropHint,
  isDragging,
  dropHandlers,
  dropOverlayBackground,
  dropOverlayBorder,
  dropOverlayText,
  onClear,
  clearTooltip,
  onFetchCanvas,
  fetchCanvasTooltip,
  onSelectLocal,
  selectLocalTooltip,
  previewUrl,
  overlayUrl,
  hasPreview,
  onPreviewClick,
  placeholderLabel,
  status,
  statusMessage,
  statusLabel,
  onStatusDismiss,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <Flex
        style={{
          width: '100%',
          minHeight: SECTION_SIZE,
          height: SECTION_SIZE,
          position: 'relative',
        }}
        align="stretch"
        gap={0}
        {...dropHandlers}
      >
        {isDragging ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: dropOverlayBackground,
              border: `2px dashed ${dropOverlayBorder}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: dropOverlayText,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 0.5,
              pointerEvents: 'none',
              backdropFilter: 'blur(1px)',
              zIndex: 5,
              textAlign: 'center',
              padding: '0 24px',
            }}
          >
            {dropHint}
          </div>
        ) : null}
        <SdpppWidgetControlColumn onClear={onClear} clearTooltip={clearTooltip} />
        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minWidth: 160,
            height: '100%',
            display: 'flex',
            alignItems: 'stretch',
          }}
          onClick={onPreviewClick}
        >
          <PreviewPanelPresentation
            widgetableId={widgetableId}
            displayUrl={previewUrl}
            overlayDisplayUrl={overlayUrl}
            overlayVisible={false}
            debugDetails={null}
            previewEnabled={false}
          />
          {!hasPreview ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: token.colorTextTertiary,
                pointerEvents: 'none',
                fontSize: 12,
              }}
            >
              <ImageIcon size={24} strokeWidth={1.5} />
              <span>{placeholderLabel}</span>
            </div>
          ) : null}
        </div>
        <SdpppWidgetActionButtons
          onFetchCanvas={onFetchCanvas}
          fetchCanvasTooltip={fetchCanvasTooltip}
          onSelectLocal={onSelectLocal}
          selectLocalTooltip={selectLocalTooltip}
        />
      </Flex>
      <div
        style={{
          height: 28,
          borderTop: `1px solid ${token.colorBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: 12,
          boxSizing: 'border-box',
          color: token.colorText,
          fontSize: 12,
          lineHeight: '28px',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {status === 'uploading' ? (
            <>
              <Spin size="small" />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {statusMessage ?? statusLabel}
              </span>
            </>
          ) : (
            <Text
              type="secondary"
              style={{
                margin: 0,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {status === 'error' && statusMessage ? statusMessage : statusLabel}
            </Text>
          )}
        </div>
        <span />
      </div>
    </div>
  );
};

SdpppWidgetUploadSelectorPresentation.displayName = 'SdpppWidgetUploadSelectorPresentation';
