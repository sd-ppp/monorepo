import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { FileVideo, Plus, Trash2 } from 'lucide-react';
import {
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import {
  useLocalResourceSelection,
  type LocalResourceSelectionItem,
} from '../../hooks/useLocalResourceSelection';
import { UploadIndicator } from '../shared/UploadIndicator';

const ALLOWED_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.flv',
  '.wmv',
]);

const VIDEO_SELECTION_PARAMS = {
  multiple: false,
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

const safeJsonStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const replacer = (_: string, val: unknown) => {
    if (typeof val === 'bigint') {
      return val.toString();
    }
  if (val instanceof Error) {
      const base: Record<string, unknown> = {
        name: val.name,
        message: val.message,
      };
      if (typeof val.stack === 'string') {
        base.stack = val.stack;
      }
      try {
        const ownKeys = Object.getOwnPropertyNames(val);
        for (const key of ownKeys) {
          const descriptor = (val as Record<string, unknown>)[key];
          if (!(key in base) && descriptor !== undefined) {
            base[key] = descriptor;
          }
        }
      } catch {
        // ignore descriptor failures
      }
      return base;
    }
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) {
        return '[Circular]';
      }
      seen.add(val as object);
    }
    return val;
  };
  try {
    return JSON.stringify(value, replacer);
  } catch {
    try {
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  }
};

const buildErrorPayload = (reason: unknown): unknown => {
  if (!reason) return null;
  if (reason instanceof Error) {
    const payload: Record<string, unknown> = {
      name: reason.name,
      message: reason.message,
    };
    if (typeof reason.stack === 'string') {
      payload.stack = reason.stack;
    }
    const errorAsRecord = reason as Record<string, unknown>;
    for (const key of Object.keys(errorAsRecord)) {
      payload[key] = errorAsRecord[key];
    }
    const cause = (reason as unknown as { cause?: unknown }).cause;
    if (cause !== undefined) {
      payload.cause = cause;
    }
    return payload;
  }
  if (typeof reason === 'object') {
    return reason;
  }
  return { value: reason };
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

  const extractErrorMessage = useCallback((reason?: unknown): string => {
    if (!reason) return '';
    if (reason instanceof Error) {
      if (reason.message && reason.message.trim().length) {
        return reason.message.trim();
      }
      return reason.toString();
    }
    if (typeof reason === 'string') {
      return reason.trim();
    }
    if (typeof reason === 'object' && reason !== null) {
      const obj = reason as Record<string, any>;
      const candidates = [
        obj.message,
        obj.msg,
        obj.error,
        obj.detail,
        obj.data?.message,
        obj.data?.error,
        obj.response?.data?.message,
        obj.response?.data?.error,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length) {
          return candidate.trim();
        }
      }
      try {
        return JSON.stringify(reason);
      } catch {
        return Object.prototype.toString.call(reason);
      }
    }
    try {
      return String(reason);
    } catch {
      return '';
    }
  }, []);

  const logErrorDetail = useCallback(
    (reason?: unknown, fallback?: string) => {
      const detail = extractErrorMessage(reason) || fallback || uploadErrorLabel;
       const payload = buildErrorPayload(reason);
       const serialized = payload ? safeJsonStringify(payload) : '';
      try {
        if (serialized && serialized !== '{}') {
          logger('SingleVideoSelector upload error detail', detail, serialized);
        } else {
          logger('SingleVideoSelector upload error detail', detail);
        }
      } catch {
        // ignore logger failures
      }
      const consolePayload = payload
        ? {
            message: detail,
            payload,
            original: reason,
          }
        : detail;
      // eslint-disable-next-line no-console
      console.error('SingleVideoSelector upload error detail:', consolePayload);
    },
    [extractErrorMessage, logger, uploadErrorLabel],
  );

  const parseExtension = useCallback((fileName?: string | null): string => {
    if (!fileName) return '';
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.slice(lastDot).trim().toLowerCase();
  }, []);

  const isSupportedVideo = useCallback(
    (item: LocalResourceSelectionItem): boolean => {
      const mime = (item.mime ?? '').toLowerCase();
      if (mime.startsWith('video/')) {
        return true;
      }
      const ext = parseExtension(item.fileName);
      return ALLOWED_VIDEO_EXTENSIONS.has(ext);
    },
    [parseExtension],
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
      const normalizedMessage = extractErrorMessage(reason);
      setUploadStatus('error');
      setUploadErrorMessage(prev => {
        if (prev) return prev;
        if (normalizedMessage.trim().length) return normalizedMessage;
        return uploadErrorLabel;
      });
      logErrorDetail(reason, normalizedMessage);
    },
    [extractErrorMessage, logErrorDetail, uploadErrorLabel],
  );

  const handleAddFromFile = useCallback(async () => {
    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: 1 });
    try {
      const selection = await selectLocalVideo();
      const validItems = selection.items.filter(isSupportedVideo);
      const invalidItems = selection.items.filter(item => !validItems.includes(item));
      const totalForProgress = Math.max(validItems.length, selection.hasError ? 1 : 0);
      if (totalForProgress > 0) {
        setUploadProgress({ current: 0, total: totalForProgress });
      } else {
        setUploadProgress({ current: 0, total: 0 });
      }

      if (selection.hasError) {
        const errorPayload = selection.errorDetail ? safeJsonStringify(selection.errorDetail) : '';
        try {
          if (errorPayload && errorPayload !== '{}') {
            logger(
              'SingleVideoSelector selection error detail',
              selection.errorMessage ?? uploadErrorLabel,
              errorPayload,
            );
          } else {
            logger(
              'SingleVideoSelector selection error detail',
              selection.errorMessage ?? uploadErrorLabel,
            );
          }
        } catch {
          // ignore logger failures
        }
      }

      if (invalidItems.length) {
        const invalidNames = invalidItems.map(item => item.fileName).filter(Boolean);
        const invalidMessage =
          invalidNames.length > 0
            ? `不支持的视频格式：${invalidNames.join(', ')}`
            : '所选文件不是支持的视频格式';
        recordUploadError(invalidMessage);
        logger('SingleVideoSelector invalid video selection', invalidMessage);
        setUploadStatus('error');
        return;
      }

      if (!validItems.length) {
        if (selection.hasError) {
          recordUploadError(selection.errorMessage ?? selection.errorDetail);
          setUploadStatus('error');
        } else {
          setUploadStatus('error');
        }
        return;
      }

      if (selection.hasError) {
        recordUploadError(selection.errorMessage ?? selection.errorDetail);
      }

      const [item] = validItems;
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
          extractErrorMessage(error) || (error instanceof Error ? error.message : String(error)),
        );
      }
    } catch (err) {
      recordUploadError(err);
      logger(
        'SingleVideoSelector selection error',
        extractErrorMessage(err) || (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    }
  }, [
    selectLocalVideo,
    isSupportedVideo,
    recordUploadError,
    runUploadPassOnce,
    logger,
    extractErrorMessage,
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
