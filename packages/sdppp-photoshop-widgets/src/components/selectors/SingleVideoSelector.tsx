import { Button, Spin, theme } from 'antd';
import { FileVideo, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  usePhotoshopWidgetActions,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/PhotoshopWidgetContext';
import {
  useLocalResourceSelection,
  type LocalResourceSelectionItem,
} from '../../hooks/useLocalResourceSelection';
import { useUploadCopy } from '../../hooks/useUploadCopy';
import { useWidgetValueEmitter } from '../../hooks/useWidgetValueEmitter';
import { UploadIndicator } from '../shared/UploadIndicator';
import { useFileDropZone } from '../../hooks/useFileDropZone';
import { useManagedResourceHandle } from '../../hooks/useManagedResourceHandle';
import { useManagedResourceCollection } from '../../hooks/useManagedResourceCollection';
import {
  buildBufferPayloadFromFile,
  getSuccessfulMaterializeRecord,
  isVideoFile,
} from '../../utils/fileUtils';
import { withAlpha } from '../../utils/color';

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
  types: [
    {
      description: 'Video Files',
      extensions: Array.from(ALLOWED_VIDEO_EXTENSIONS),
      accept: {
        'video/*': Array.from(ALLOWED_VIDEO_EXTENSIONS),
      },
    },
  ],
} as const;

const WRAPPER_GAP = 8;
const PANEL_HEIGHT = 128;
const ADD_BUTTON_HEIGHT = 100;
const TRASH_BUTTON_HEIGHT = 28;
const CONTROL_COLUMN_WIDTH = 120;
const BORDER_RADIUS = 'var(--sdppp-widget-border-radius, 4px)';

const PREVIEW_CONTENT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  textAlign: 'center',
};

const sanitizeText = (input?: string | null): string | undefined => {
  if (typeof input !== 'string') return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') {
    return undefined;
  }
  return trimmed;
};

export const SingleVideoSelector: React.FC<{
  widgetableId: string;
  value: string[];
  onValueChange?: (value: string[]) => void;
}> = ({ widgetableId, value = [], onValueChange }) => {
  const t = useWidgetText();
  const actions = usePhotoshopWidgetActions();
  const { token } = theme.useToken();
  const dropOverlayBackground = useMemo(() => withAlpha(token.colorPrimary, 0.12), [token.colorPrimary]);
  const dropOverlayBorder = useMemo(() => withAlpha(token.colorPrimary, 0.55), [token.colorPrimary]);
  const dropOverlayText = token.colorText;
  const borderColor = token.colorBorder;
  const borderStyle = `1px solid ${borderColor}`;
  const selectLocalVideo = useLocalResourceSelection({
    actionParams: VIDEO_SELECTION_PARAMS as unknown as Record<string, unknown>,
    maxItems: 1,
    disablePreviewCapture: true,
  });
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();
  const {
    setResource: setPendingResourceHandle,
    clear: clearPendingResourceHandle,
  } = useManagedResourceHandle();
  const {
    retain: retainSelectionHandle,
    release: releaseSelectionHandle,
    clear: clearSelectionHandles,
  } = useManagedResourceCollection();

  const emitValue = useWidgetValueEmitter({
    onValueChange,
  });

  const { errorLabel: uploadErrorLabel } = useUploadCopy();

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
  const [displayInfoCache, setDisplayInfoCache] = useState<
    Record<string, { fileName?: string; nativePath?: string | null }>
  >({});
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const currentResource = useMemo(() => {
    if (!Array.isArray(value) || !value.length) return '';
    const first = value[0];
    return sanitizeText(typeof first === 'string' ? first : undefined) ?? '';
  }, [value]);

  const hasVideo = currentResource.length > 0;
  const currentDisplayInfo = hasVideo ? displayInfoCache[currentResource] : undefined;
  const displayLabel = useMemo(() => {
    if (!hasVideo) return '';
    const nativePath = sanitizeText(currentDisplayInfo?.nativePath);
    if (nativePath) return nativePath;
    const fileName = sanitizeText(currentDisplayInfo?.fileName);
    if (fileName) return fileName;
    return currentResource;
  }, [hasVideo, currentDisplayInfo, currentResource]);

  const recordUploadError = useCallback(
    (reason?: unknown) => {
      const normalizedMessage = extractErrorMessage(reason);
      setUploadStatus('error');
      setUploadErrorMessage(prev => {
        if (prev) return prev;
        if (normalizedMessage.trim().length) return normalizedMessage;
        return uploadErrorLabel;
      });
    },
    [extractErrorMessage, uploadErrorLabel],
  );

  const handleDropFiles = useCallback(
    async (files: File[]) => {
      const createFromBuffer = actions['resource.file.createFromBuffer'];
      if (typeof createFromBuffer !== 'function') {
        return;
      }
      const accepted = files.filter(isVideoFile);
      if (!accepted.length) return;
      const file = accepted[0];
      if (!file) return;

      setUploadErrorMessage(null);
      setUploadStatus('uploading');
      setUploadProgress({ current: 0, total: 1 });

      try {
        const payload = await buildBufferPayloadFromFile(file);
        const result = await createFromBuffer({ files: [payload] });
        const record = getSuccessfulMaterializeRecord(result);
        const resource = record?.resource ? record.resource.trim() : '';
        const handle = record?.handle ?? null;
        if (!resource) {
          handle?.dispose();
          recordUploadError('视频处理失败');
          return;
        }

        setPendingResourceHandle(resource, handle ?? null);

        const previousValue = currentResource;
        const uploadPass: WidgetUploadPass = {
          getUploadFile: async (signal?: AbortSignal) => {
            if (signal?.aborted) {
              throw new DOMException('Upload aborted', 'AbortError');
            }
            return {
              type: 'resource',
              resource,
              resourceId: resource,
              fileName: file.name,
              mimeType: record?.mime ?? payload.mime ?? file.type ?? undefined,
            };
          },
        };

        const uploaded = await runUploadPassOnce(uploadPass);
        const normalized = typeof uploaded === 'string' ? uploaded.trim() : '';
        if (normalized) {
          const safeFileName = sanitizeText(file.name);
          setDisplayInfoCache(prev => {
            const next = { ...prev };
            if (previousValue && previousValue !== normalized) {
              delete next[previousValue];
            }
            next[normalized] = {
              ...(safeFileName ? { fileName: safeFileName } : {}),
              nativePath: null,
            };
            return next;
          });
          emitValue([normalized]);
          setUploadProgress({ current: 1, total: 1 });
          setUploadStatus('idle');
        } else {
          recordUploadError();
        }
      } catch (error) {
        recordUploadError(error);
      } finally {
        clearPendingResourceHandle();
        setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
      }
    },
    [
      actions,
      currentResource,
      emitValue,
      extractErrorMessage,
      recordUploadError,
      runUploadPassOnce,
      setDisplayInfoCache,
      setUploadErrorMessage,
      setUploadProgress,
      setUploadStatus,
      clearPendingResourceHandle,
      setPendingResourceHandle,
    ],
  );

  const dropHint = t('video.local.dropHint', { defaultValue: '拖拽视频到此区域释放以上传' });

  const { isDragging, handlers: dropHandlers } = useFileDropZone({
    onDropFiles: files => {
      void handleDropFiles(files);
    },
    accept: isVideoFile,
    multiple: false,
  });

  const handleAddFromFile = useCallback(async () => {
    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: 1 });
    try {
      const selection = await selectLocalVideo();
      selection.items.forEach(item => {
        retainSelectionHandle(item.resource, item.handle ?? null);
      });
      const validItems = selection.items.filter(isSupportedVideo);
      const invalidItems = selection.items.filter(item => !validItems.includes(item));
      const totalForProgress = Math.max(validItems.length, selection.hasError ? 1 : 0);
      if (totalForProgress > 0) {
        setUploadProgress({ current: 0, total: totalForProgress });
      } else {
        setUploadProgress({ current: 0, total: 0 });
      }

      if (selection.hasError) {
        recordUploadError(selection.errorDetail ?? selection.errorMessage);
      }

      if (invalidItems.length) {
        const invalidNames = invalidItems.map(item => item.fileName).filter(Boolean);
        const invalidMessage =
          invalidNames.length > 0
            ? `不支持的视频格式：${invalidNames.join(', ')}`
            : '所选文件不是支持的视频格式';
        invalidItems.forEach(item => releaseSelectionHandle(item.resource));
        recordUploadError(invalidMessage);
        setUploadStatus('error');
        clearSelectionHandles();
        return;
      }

      if (!validItems.length) {
        if (selection.hasError) {
          recordUploadError(selection.errorMessage ?? selection.errorDetail);
          setUploadStatus('error');
        } else {
          setUploadStatus('error');
        }
        selectionHandles.clear();
        return;
      }

      if (selection.hasError) {
        recordUploadError(selection.errorMessage ?? selection.errorDetail);
      }

      const [item] = validItems;
      if (!item) {
        setUploadStatus(selection.hasError ? 'error' : 'idle');
        clearSelectionHandles();
        return;
      }

      const previousValue = currentResource;

      try {
        setPendingResourceHandle(
          item.resource,
          retainSelectionHandle(item.resource, item.handle ?? null),
        );
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
          const safeNativePath = sanitizeText(item.nativePath) ?? null;
          const safeFileName = sanitizeText(item.fileName);
          setDisplayInfoCache(prev => {
            const next = { ...prev };
            if (previousValue && previousValue !== normalized) {
              delete next[previousValue];
            }
            next[normalized] = {
              ...(safeFileName ? { fileName: safeFileName } : {}),
              nativePath: safeNativePath,
            };
            return next;
          });
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
      } finally {
        releaseSelectionHandle(item.resource);
      }
    } catch (err) {
      recordUploadError(err);
    } finally {
      clearSelectionHandles();
      clearPendingResourceHandle();
      setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    }
  }, [
    selectLocalVideo,
    isSupportedVideo,
    recordUploadError,
    runUploadPassOnce,
    extractErrorMessage,
    emitValue,
    currentResource,
    setUploadProgress,
    retainSelectionHandle,
    releaseSelectionHandle,
    clearSelectionHandles,
    setPendingResourceHandle,
    clearPendingResourceHandle,
  ]);

  const buttonLabel = t('video.local.button', { defaultValue: '本地视频' });
  const emptyLabel = t('video.local.empty', { defaultValue: '暂无视频' });

  const handleClearVideo = useCallback(() => {
    setDisplayInfoCache({});
    setUploadErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress({ current: 0, total: 0 });
    emitValue([]);
  }, [emitValue, setUploadProgress]);

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
      flexDirection: 'row-reverse',
      gap: WRAPPER_GAP,
      width: '100%',
      height: PANEL_HEIGHT,
    }),
    [],
  );

  const controlsColumnStyle = useMemo<React.CSSProperties>(
    () => ({
      width: CONTROL_COLUMN_WIDTH,
      minWidth: CONTROL_COLUMN_WIDTH,
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
      border: borderStyle,
      borderColor,
      borderRadius: hasVideo ? `${BORDER_RADIUS} ${BORDER_RADIUS} 0 0` : BORDER_RADIUS,
    }),
    [borderColor, borderStyle, hasVideo],
  );

  const trashButtonStyle = useMemo<React.CSSProperties>(
    () => ({
      height: TRASH_BUTTON_HEIGHT,
      lineHeight: `${TRASH_BUTTON_HEIGHT}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      border: borderStyle,
      borderColor,
      borderTop: 'none',
      borderRadius: `0 0 ${BORDER_RADIUS} ${BORDER_RADIUS}`,
    }),
    [borderColor, borderStyle],
  );

  const previewWrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      flex: '1 1 0%',
      height: PANEL_HEIGHT,
      minHeight: PANEL_HEIGHT,
      border: borderStyle,
      borderRadius: BORDER_RADIUS,
      padding: 16,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }),
    [borderStyle],
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

  const dropOverlayStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      inset: 0,
      background: dropOverlayBackground,
      border: `2px dashed ${dropOverlayBorder}`,
      borderRadius: BORDER_RADIUS,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: dropOverlayText,
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: 0.5,
      pointerEvents: 'none',
      backdropFilter: 'blur(1px)',
      textAlign: 'center',
      padding: '0 24px',
      zIndex: 5,
    }),
    [dropOverlayBackground, dropOverlayBorder, dropOverlayText],
  );

  const handleIndicatorDismiss = useCallback(() => {
    setUploadErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress({ current: 0, total: 0 });
  }, [setUploadErrorMessage, setUploadProgress, setUploadStatus]);

  return (
    <div data-widgetable-id={widgetableId} style={containerStyle}>
      <div
        style={{ position: 'relative', width: '100%' }}
        {...dropHandlers}
      >
        {isDragging ? <div style={dropOverlayStyle}>{dropHint}</div> : null}
        <div style={panelStyle}>
          <div style={controlsColumnStyle}>
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
            </Button>
            {hasVideo ? (
              <Button
                block
                type="default"
                icon={<Trash2 size={16} />}
                style={trashButtonStyle}
                onClick={handleClearVideo}
              >
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
