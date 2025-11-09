import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import { LocalImagePackLayout } from './local-image-pack/LocalImagePackLayout';
import { useLocalImagePackSelection } from '../../hooks/useLocalImagePackSelection';
import type { LocalImagePackPreviewCell } from '../../utils/localImagePackLayout';

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
  const selectLocalImages = useLocalImagePackSelection();
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();

  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
    },
    [onValueChange],
  );

  const [pendingItems, setPendingItems] = useState<LocalImagePackPreviewCell[]>([]);
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const uploadErrorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );

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
    setUploadProgress({ current: 0, total: 0 });
    try {
      const selection = await selectLocalImages();
      if (!selection.items.length && !selection.hasError) {
        return;
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

      if (selection.hasError) {
        recordUploadError();
      }

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
            logger('LocalImagePackSelector emitValue', JSON.stringify([...base, ...appended]));
            emitValue([...base, ...appended]);
          } else {
            encounteredError = true;
            setPendingItems(curr => curr.filter(entry => entry.id !== item.resource));
            recordUploadError();
          }
          completedCount += 1;
          if (totalForProgress > 0) {
            const nextCurrent = Math.min(completedCount, totalForProgress);
            setUploadProgress({ current: nextCurrent, total: totalForProgress });
          }
        } catch (error) {
          encounteredError = true;
          setPendingItems(curr => curr.filter(entry => entry.id !== item.resource));
          recordUploadError(error);
          logger(
            'LocalImagePackSelector upload error',
            error instanceof Error ? error.message : String(error),
          );
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
    } catch (error) {
      recordUploadError(error);
      logger(
        'LocalImagePackSelector selection error',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setUploadStatus(prev => (prev === 'error' ? 'error' : 'idle'));
    }
  }, [
    selectLocalImages,
    runUploadPassOnce,
    value,
    emitValue,
    logger,
    recordUploadError,
    setUploadProgress,
  ]);

  const buttonLabel = t('image.pack.local.button', { defaultValue: '本地图片包' });
  const emptyLabel = t('image.pack.local.empty', { defaultValue: '暂无图片' });
  const handleClearImages = useCallback(() => {
    setPendingItems([]);
    setPreviewCache({});
    logger('LocalImagePackSelector clearImages');
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

  return (
    <LocalImagePackLayout
      widgetableId={widgetableId}
      items={combinedItems}
      buttonLabel={buttonLabel}
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
      onAdd={() => {
        void handleAddFromFile();
      }}
      onClear={handleClearImages}
    />
  );
};
