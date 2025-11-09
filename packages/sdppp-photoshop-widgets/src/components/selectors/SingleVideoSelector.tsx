import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { FileVideo, Plus, Trash2 } from 'lucide-react';
import {
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import { useLocalResourceSelection } from '../../hooks/useLocalResourceSelection';
import { UploadIndicator } from '../shared/UploadIndicator';

const VIDEO_SELECTION_PARAMS = {
  multiple: false,
  types: [
    {
      description: 'Videos',
      extensions: ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.flv', '.wmv'],
      accept: {
        'video/*': ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.flv', '.wmv'],
      },
    },
  ],
} as const;

const WRAPPER_GAP = 8;
const PANEL_HEIGHT = 128;
const ADD_BUTTON_HEIGHT = 100;
const TRASH_BUTTON_HEIGHT = 28;
const LEFT_WIDTH = 120;
const BORDER_COLOR = 'var(--sdppp-widget-border-color, var(--ant-color-border, #d9d9d9))';
const BORDER_RADIUS = 'var(--sdppp-widget-border-radius, 4px)';

const PREVIEW_CONTENT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  textAlign: 'center',
};

export const SingleVideoSelector: React.FC<{
  widgetableId: string;
  value: string[];
  onValueChange?: (value: string[]) => void;
}> = ({ widgetableId, value = [], onValueChange }) => {
  const t = useWidgetText();
  const logger = useWidgetLogger();
  const selectLocalVideo = useLocalResourceSelection({
    actionParams: VIDEO_SELECTION_PARAMS as unknown as Record<string, unknown>,
    maxItems: 1,
    disablePreviewCapture: true,
  });
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();

  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
    },
    [onValueChange],
  );

  const uploadErrorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [displayNameCache, setDisplayNameCache] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const currentResource = useMemo(() => {
    if (!Array.isArray(value) || !value.length) return '';
    return (value[0] ?? '').trim();
  }, [value]);

  const hasVideo = currentResource.length > 0;
  const displayLabel = hasVideo ? displayNameCache[currentResource] ?? currentResource : '';

  const recordUploadError = useCallback(
    (reason?: unknown) => {
      setUploadStatus('error');
      setUploadErrorMessage(prev => {
        if (prev) return prev;
        if (reason instanceof Error && reason.message) return reason.message;
        if (typeof reason === 'string' && reason.trim().length) return reason.trim();
        return uploadErrorLabel;
      });
    },
    [uploadErrorLabel],
  );

  const handleAddFromFile = useCallback(async () => {
    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: 1 });
    try {
      const selection = await selectLocalVideo();
      const totalForProgress = Math.max(selection.items.length, selection.hasError ? 1 : 0);
      if (totalForProgress > 0) {
        setUploadProgress({ current: 0, total: totalForProgress });
      } else {
        setUploadProgress({ current: 0, total: 0 });
      }
      if (!selection.items.length) {
        if (selection.hasError) {
          recordUploadError();
          setUploadStatus('error');
        } else {
          setUploadStatus('idle');
        }
        return;
      }

      if (selection.hasError) {
        recordUploadError();
      }

      const [item] = selection.items;
      if (!item) {
        setUploadStatus(selection.hasError ? 'error' : 'idle');
        return;
      }

      const previousValue = currentResource;

      try {
        const uploadPass: WidgetUploadPass = {
          getUploadFile: async (signal?: AbortSignal) => {
            if (signal?.aborted) {
              throw new DOMException('Upload aborted', 'AbortError');
            }
            return {
              type: 'resource',
              resource: item.resource,
              resourceId: item.resource,
              fileName: item.fileName,
              mimeType: item.mime ?? undefined,
            };
          },
        };
        const uploaded = await runUploadPassOnce(uploadPass);
        const normalized = typeof uploaded === 'string' ? uploaded.trim() : '';
        if (normalized) {
          setDisplayNameCache(prev => {
            const next = { ...prev };
            if (previousValue && previousValue !== normalized) {
              delete next[previousValue];
            }
            if (item.fileName) {
              next[normalized] = item.fileName;
            }
            return next;
          });
          logger('SingleVideoSelector emitValue', JSON.stringify([normalized]));
          emitValue([normalized]);
          if (totalForProgress > 0) {
            setUploadProgress({ current: totalForProgress, total: totalForProgress });
          }
          setUploadStatus('idle');
        } else {
          recordUploadError();
        }
      } catch (error) {
        recordUploadError(error);
        logger(
          'SingleVideoSelector upload error',
          error instanceof Error ? error.message : String(error),
        );
      }
    } catch (err) {
      recordUploadError(err);
      logger(
        'SingleVideoSelector selection error',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    }
  }, [
    selectLocalVideo,
    recordUploadError,
    runUploadPassOnce,
    logger,
    emitValue,
    currentResource,
    setUploadProgress,
  ]);

  const buttonLabel = t('video.local.button', { defaultValue: '本地视频' });
  const emptyLabel = t('video.local.empty', { defaultValue: '暂无视频' });

  const handleClearVideo = useCallback(() => {
    setDisplayNameCache({});
    setUploadErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress({ current: 0, total: 0 });
    logger('SingleVideoSelector clearVideo');
    emitValue([]);
  }, [emitValue, logger, setUploadProgress]);

  useEffect(() => {
    if (uploadStatus === 'idle' && uploadErrorMessage === null) {
      setUploadProgress(prev => (prev.total === 0 ? prev : { current: 0, total: 0 }));
    }
  }, [uploadStatus, uploadErrorMessage]);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      gap: WRAPPER_GAP,
      width: '100%',
    }),
    [],
  );

  const panelStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'stretch',
      gap: WRAPPER_GAP,
      width: '100%',
      height: PANEL_HEIGHT,
    }),
    [],
  );

  const leftColumnStyle = useMemo<React.CSSProperties>(
    () => ({
      width: LEFT_WIDTH,
      minWidth: LEFT_WIDTH,
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: PANEL_HEIGHT,
    }),
    [],
  );

  const addButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      height: hasVideo ? ADD_BUTTON_HEIGHT : PANEL_HEIGHT,
      minHeight: hasVideo ? ADD_BUTTON_HEIGHT : PANEL_HEIGHT,
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${BORDER_COLOR}`,
      borderColor: BORDER_COLOR,
      borderRadius: hasVideo ? `${BORDER_RADIUS} ${BORDER_RADIUS} 0 0` : BORDER_RADIUS,
    }),
    [hasVideo],
  );

  const trashButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      height: TRASH_BUTTON_HEIGHT,
      lineHeight: `${TRASH_BUTTON_HEIGHT}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      border: `1px solid ${BORDER_COLOR}`,
      borderColor: BORDER_COLOR,
      borderTop: 'none',
      borderRadius: `0 0 ${BORDER_RADIUS} ${BORDER_RADIUS}`,
    }),
    [],
  );

  const previewWrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      flex: '1 1 0%',
      height: PANEL_HEIGHT,
      minHeight: PANEL_HEIGHT,
      border: `1px solid ${BORDER_COLOR}`,
      borderRadius: BORDER_RADIUS,
      padding: 16,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }),
    [],
  );

  const uploadingOverlayStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      inset: 0,
      background: 'rgba(255,255,255,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BORDER_RADIUS,
    }),
    [],
  );

  const handleIndicatorDismiss = useCallback(() => {
    setUploadErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress({ current: 0, total: 0 });
  }, [setUploadErrorMessage, setUploadProgress, setUploadStatus]);

  return (
    <div data-widgetable-id={widgetableId} style={containerStyle}>
      <div style={panelStyle}>
        <div style={leftColumnStyle}>
          <Button
            type="default"
            block
            icon={<Plus size={18} strokeWidth={2} />}
            style={addButtonStyle}
            aria-label={buttonLabel}
            title={buttonLabel}
            onClick={() => {
              void handleAddFromFile();
            }}
          >
            {buttonLabel}
          </Button>
          {hasVideo ? (
            <Button
              block
              type="default"
              icon={<Trash2 size={16} />}
              style={trashButtonStyle}
              onClick={handleClearVideo}
            >
              {t('video.local.remove', { defaultValue: '清除视频' })}
            </Button>
          ) : null}
        </div>
        <div style={previewWrapperStyle}>
          <div style={PREVIEW_CONTENT_STYLE}>
            <FileVideo size={48} strokeWidth={1.5} color="rgba(0,0,0,0.65)" />
            <span
              style={{
                fontSize: 14,
                color: hasVideo ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.45)',
                wordBreak: 'break-all',
              }}
            >
              {hasVideo ? displayLabel : emptyLabel}
            </span>
          </div>
          {uploadStatus === 'uploading' ? (
            <div style={uploadingOverlayStyle}>
              <Spin />
            </div>
          ) : null}
        </div>
      </div>
      <UploadIndicator
        status={uploadStatus}
        errorMessage={uploadErrorMessage ?? undefined}
        progressCurrent={uploadProgress.current}
        progressTotal={uploadProgress.total}
        onDismiss={uploadStatus === 'error' ? handleIndicatorDismiss : undefined}
        containerStyle={{
          position: 'static',
          width: '100%',
        }}
      />
    </div>
  );
};
