import { theme } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 } from 'uuid';
import {
    useWidgetImageMaskActions,
    useWidgetLogger,
    useWidgetText,
    useWidgetUploadPassHandlers,
    useWorkBoundary,
    type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import { useFileDropZone } from '../../hooks/useFileDropZone';
import {
    useLocalImagePackSelection,
    type LocalImagePackSelectionResult,
} from '../../hooks/useLocalImagePackSelection';
import { useUploadCopy } from '../../hooks/useUploadCopy';
import { useWidgetValueEmitter } from '../../hooks/useWidgetValueEmitter';
import { withAlpha } from '../../utils/color';
import { resolveDocContext } from '../../utils/docContext';
import {
    buildBufferPayloadFromFile,
    getSuccessfulMaterializeRecord,
    isImageFile,
    readFileAsDataUrl,
} from '../../utils/fileUtils';
import {
    buildUploadFileName,
    type LocalImagePackPreviewCell,
} from '../../utils/localImagePackLayout';
import { LocalImagePackLayout } from './local-image-pack/LocalImagePackLayout';

interface LocalImagePackSelectorProps {
  widgetableId: string;
  value: string[];
  onValueChange?: (value: string[]) => void;
}

export const LocalImagePackSelector: React.FC<LocalImagePackSelectorProps> = ({
  widgetableId,
  value,
  onValueChange,
}) => {
  const t = useWidgetText();
  const logger = useWidgetLogger();
  const { token } = theme.useToken();
  const dropOverlayBackground = useMemo(() => withAlpha(token.colorPrimary, 0.12), [token.colorPrimary]);
  const dropOverlayBorder = useMemo(() => withAlpha(token.colorPrimary, 0.55), [token.colorPrimary]);
  const dropOverlayText = token.colorText;
  const selectLocalImages = useLocalImagePackSelection();
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();
  const actions = useWidgetImageMaskActions();
  const workBoundaryUri = useWorkBoundary();

  const emitValue = useWidgetValueEmitter({
    onValueChange,
    logger,
    logLabel: 'LocalImagePackSelector emitValue',
  });

  const [pendingItems, setPendingItems] = useState<LocalImagePackPreviewCell[]>([]);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const { errorLabel: uploadErrorLabel } = useUploadCopy();

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

  const processSelection = useCallback(
    async (selection: LocalImagePackSelectionResult) => {
      if (!selection.items.length && !selection.hasError) {
        return;
      }

      if (selection.hasError) {
        recordUploadError(selection.errorDetail ?? selection.errorMessage);
      }

      const totalForProgress = Math.max(selection.items.length, selection.hasError ? 1 : 0);
      if (totalForProgress > 0) {
        setUploadProgress({ current: 0, total: totalForProgress });
      }

      if (selection.items.length) {
        setPendingItems(curr => [
          ...curr,
          ...selection.items.map(item => ({
            id: item.resource,
            url: item.preview ?? '',
            status: 'pending' as const,
          })),
        ]);
      }

      const base = Array.isArray(value) ? value.filter(Boolean) : [];
      const appended: string[] = [];
      let encounteredError = selection.hasError;
      let completedCount = 0;

      for (const item of selection.items) {
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
            appended.push(normalized);
            setPendingItems(curr => curr.filter(entry => entry.id !== item.resource));
            if (item.preview) {
              setPreviewCache(prev => ({ ...prev, [normalized]: item.preview as string }));
            }
            emitValue([...base, ...appended]);
          } else {
            encounteredError = true;
            setPendingItems(curr => curr.filter(entry => entry.id !== item.resource));
            recordUploadError();
          }
        } catch (error) {
          encounteredError = true;
          setPendingItems(curr => curr.filter(entry => entry.id !== item.resource));
          recordUploadError(error);
          logger(
            'LocalImagePackSelector upload error',
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          completedCount += 1;
          if (totalForProgress > 0) {
            const nextCurrent = Math.min(completedCount, totalForProgress);
            setUploadProgress({ current: nextCurrent, total: totalForProgress });
          }
        }
      }

      if (encounteredError) {
        setUploadStatus('error');
      } else {
        setUploadStatus('idle');
        if (totalForProgress > 0) {
          setUploadProgress({ current: totalForProgress, total: totalForProgress });
        }
      }
    },
    [
      emitValue,
      logger,
      recordUploadError,
      runUploadPassOnce,
      setPendingItems,
      setPreviewCache,
      setUploadProgress,
      setUploadStatus,
      value,
    ],
  );

  const runSelectionOperation = useCallback(
    async (resolver: () => Promise<LocalImagePackSelectionResult>) => {
      setUploadErrorMessage(null);
      setUploadStatus('uploading');
      setUploadProgress({ current: 0, total: 0 });
      try {
        const selection = await resolver();
        await processSelection(selection);
      } catch (error) {
        recordUploadError(error);
        logger(
          'LocalImagePackSelector selection error',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
      }
    },
    [
      logger,
      processSelection,
      recordUploadError,
      setUploadErrorMessage,
      setUploadProgress,
      setUploadStatus,
    ],
  );

  const handleAddFromFile = useCallback(() => {
    void runSelectionOperation(() => selectLocalImages());
  }, [runSelectionOperation, selectLocalImages]);

  const createSelectionFromFiles = useCallback(
    async (files: File[]): Promise<LocalImagePackSelectionResult> => {
      const createFromBuffer = actions['resource.file.createFromBuffer'];
      const getThumbnail = actions['resource.thumbnail'];
      if (typeof createFromBuffer !== 'function') {
        return {
          items: [],
          hasError: true,
          errorMessage: 'fileResource.createFromBuffer unavailable',
        };
      }

      const acceptedFiles = files.filter(isImageFile);
      if (!acceptedFiles.length) {
        return { items: [], hasError: false };
      }

      const items: LocalImagePackSelectionResult['items'] = [];
      let hasError = false;
      let firstErrorMessage: string | undefined;
      let firstErrorDetail: unknown;

      const captureError = (detail: unknown, message?: unknown) => {
        if (firstErrorDetail === undefined && detail !== undefined) {
          firstErrorDetail = detail;
        }
        if (typeof message === 'string' && !firstErrorMessage && message.trim().length) {
          firstErrorMessage = message.trim();
        } else if (!firstErrorMessage && typeof detail === 'string' && detail.trim().length) {
          firstErrorMessage = detail.trim();
        } else if (
          !firstErrorMessage &&
          detail instanceof Error &&
          detail.message?.trim().length
        ) {
          firstErrorMessage = detail.message.trim();
        }
      };

      for (const file of acceptedFiles) {
        try {
          const payload = await buildBufferPayloadFromFile(file);
          const result = await createFromBuffer({ files: [payload] });
          const record = getSuccessfulMaterializeRecord(result);
          logger(
            'LocalImagePackSelector createFromBuffer result',
            JSON.stringify({
              file: file.name,
              resource: record?.resource ?? null,
              error: record?.error ?? (result as any)?.error ?? null,
              mime: record?.mime ?? payload.mime ?? file.type ?? null,
            }),
          );
          const resource = record?.resource ? record.resource.trim() : '';
          if (!resource) {
            hasError = true;
            captureError(record ?? result, record?.error);
            continue;
          }
          let preview = record?.thumbnail ?? null;
          if (!preview) {
            if (typeof getThumbnail === 'function') {
              try {
                const thumb = await getThumbnail({ resource });
                if (thumb?.thumbnail) {
                  preview = thumb.thumbnail;
                }
              } catch (thumbnailError) {
                hasError = true;
                captureError(
                  thumbnailError,
                  thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
                );
                logger(
                  'LocalImagePackSelector drop thumbnail error',
                  thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
                );
              }
            }
          }
          if (!preview) {
            try {
              preview = await readFileAsDataUrl(file);
            } catch {
              preview = null;
            }
          }
          const mime = record?.mime ?? payload.mime ?? file.type ?? null;
          items.push({
            resource,
            preview,
            mime,
            fileName: file.name || buildUploadFileName(resource, mime),
          });
        } catch (error) {
          hasError = true;
          captureError(error, error instanceof Error ? error.message : String(error));
          logger(
            'LocalImagePackSelector drop materialize error',
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      return {
        items,
        hasError,
        errorMessage: firstErrorMessage,
        errorDetail: firstErrorDetail,
      };
    },
    [actions, logger],
  );

  const handleDropFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(isImageFile);
      if (!accepted.length) return;
      void runSelectionOperation(() => createSelectionFromFiles(accepted));
    },
    [createSelectionFromFiles, runSelectionOperation],
  );

  const uploadButtonLabel = t('image.pack.local.button', { defaultValue: '本地图片包' });
  const canvasButtonLabel = t('image.pack.local.canvas.button', { defaultValue: '画布内容' });
  const canvasFetchErrorLabel = t('image.pack.local.canvas.error', {
    defaultValue: '无法获取画布内容',
  });
  const emptyLabel = t('image.pack.local.empty', { defaultValue: '暂无图片' });
  const handleClearImages = useCallback(() => {
    setPendingItems([]);
    setPreviewCache({});
    setUploadErrorMessage(null);
    setUploadStatus('idle');
    setUploadProgress({ current: 0, total: 0 });
    emitValue([]);
  }, [logger, emitValue]);

  useEffect(() => {
    if (uploadStatus === 'idle' && uploadErrorMessage === null) {
      setUploadProgress({ current: 0, total: 0 });
    }
  }, [uploadStatus, uploadErrorMessage]);

  const successItems = useMemo<LocalImagePackPreviewCell[]>(
    () =>
      (Array.isArray(value) ? value.filter(Boolean) : []).map((url, index) => ({
        id: `success-${index}`,
        url: previewCache[url] ?? url,
        status: 'success' as const,
      })),
    [previewCache, value],
  );

  const combinedItems = useMemo(
    () => [...successItems, ...pendingItems],
    [successItems, pendingItems],
  );

  const dropHint = t('image.pack.local.dropHint', {
    defaultValue: '拖拽图片到此区域释放以上传',
  });

  const { isDragging, handlers: dropHandlers } = useFileDropZone({
    onDropFiles: files => {
      handleDropFiles(files);
    },
    accept: isImageFile,
    multiple: true,
  });

  const handleAddFromCanvas = useCallback(async () => {
    const normalizedBoundary = typeof workBoundaryUri === 'string' ? workBoundaryUri.trim() : '';
    const boundaryContext = resolveDocContext(normalizedBoundary);
    const resolvedBoundaryUri = boundaryContext.hasDocument
      ? boundaryContext.canvasBoundaryUri
      : boundaryContext.normalizedBoundaryUri;
    const resolvedContentUri = boundaryContext.hasDocument ? boundaryContext.canvasContentUri : '';
    if (!resolvedBoundaryUri || !resolvedContentUri) {
      recordUploadError(canvasFetchErrorLabel);
      logger('LocalImagePackSelector canvas invalid boundary', canvasFetchErrorLabel);
      return;
    }

    const placeholderId = `canvas-${Date.now()}`;
    setPendingItems(curr => [
      ...curr,
      {
        id: placeholderId,
        url: '',
        status: 'pending',
      },
    ]);

    setUploadErrorMessage(null);
    setUploadStatus('uploading');
    setUploadProgress({ current: 0, total: 1 });

    try {
      const result = await actions['resource.file.createFromCBM']({
        contentUri: resolvedContentUri,
        boundaryUri: resolvedBoundaryUri,
      });

      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      const reportedError =
        typeof result?.error === 'string' && result.error.trim().length > 0
          ? result.error.trim()
          : null;

      if (!resource) {
        recordUploadError(reportedError ?? canvasFetchErrorLabel);
        return;
      }

      const uploadPass: WidgetUploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          if (signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }
          return {
            type: 'resource',
            resource,
            resourceId: resource,
            fileName: `${v4()}.png`,
            mimeType: typeof result?.mime === 'string' ? result.mime : undefined,
          };
        },
      };
      const uploaded = await runUploadPassOnce(uploadPass);
      const normalizedUploaded = typeof uploaded === 'string' ? uploaded.trim() : '';
      if (!normalizedUploaded) {
        recordUploadError(reportedError ?? canvasFetchErrorLabel);
        return;
      }

      const thumbnail =
        typeof result?.thumbnail === 'string' && result.thumbnail.trim().length > 0
          ? result.thumbnail.trim()
          : null;
      const filePreview =
        typeof result?.fileUri === 'string' && result.fileUri.trim().length > 0
          ? result.fileUri.trim()
          : null;

      const base = Array.isArray(value) ? value.filter(Boolean) : [];
      const nextValue = [...base, normalizedUploaded];
      setPendingItems(curr => curr.filter(entry => entry.id !== placeholderId));
      if (thumbnail) {
        setPreviewCache(prev => ({ ...prev, [normalizedUploaded]: thumbnail }));
      } else if (filePreview) {
        setPreviewCache(prev => ({ ...prev, [normalizedUploaded]: filePreview }));
      }
      logger('LocalImagePackSelector canvas emitValue', JSON.stringify(nextValue));
      emitValue(nextValue);
      setUploadProgress({ current: 1, total: 1 });
      setUploadStatus('idle');
    } catch (error) {
      recordUploadError(error);
      logger(
        'LocalImagePackSelector canvas error',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setPendingItems(curr => curr.filter(entry => entry.id !== placeholderId));
      setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    }
  }, [
    actions,
    canvasFetchErrorLabel,
    emitValue,
    logger,
    recordUploadError,
    setUploadProgress,
    runUploadPassOnce,
    value,
    workBoundaryUri,
  ]);

  return (
    <div
      style={{ position: 'relative', width: '100%' }}
      {...dropHandlers}
    >
      {isDragging ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: dropOverlayBackground,
            border: `2px dashed ${dropOverlayBorder}`,
            borderRadius: 'var(--sdppp-widget-border-radius, 4px)',
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
      <LocalImagePackLayout
        widgetableId={widgetableId}
        items={combinedItems}
        uploadButtonLabel={uploadButtonLabel}
        canvasButtonLabel={canvasButtonLabel}
        emptyLabel={emptyLabel}
        uploadStatus={uploadStatus}
        uploadErrorMessage={uploadErrorMessage ?? undefined}
        uploadProgress={uploadProgress}
        onUploadDismiss={
          uploadStatus === 'error'
            ? () => {
                setUploadErrorMessage(null);
                setUploadStatus('idle');
                setUploadProgress({ current: 0, total: 0 });
              }
            : undefined
        }
        onUploadClick={() => {
          void handleAddFromFile();
        }}
        onCanvasClick={() => {
          void handleAddFromCanvas();
        }}
        onClear={handleClearImages}
      />
    </div>
  );
};
