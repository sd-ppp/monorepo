import { ImagePreviewFrame, SyncButton } from '@sdppp/ui-library';
import { Button } from 'antd';
import { Plus, Scan, Scissors } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useWidgetImageMaskActions,
  useWidgetLogger,
  useWidgetText,
} from '../context/WidgetImageMaskContext';
import type { BoundaryUri, ContentUri, FileUri, MaskUri } from '../features/realtime-thumbnail/types';
import { useThumbnail, type UseThumbnailParams } from '../features/realtime-thumbnail/useThumbnail';
import { DebugBadge } from './DebugBadge';
import { UploadIndicator } from './shared/UploadIndicator';

interface ImageSelectorProps {
  widgetableId: string;
  value: string[];
  showActionButtons?: boolean;
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
}

const SECTION_SIZE = 100;
const ACTION_BUTTON_SIZE = 50;
const SYNC_BUTTON_SIZE = SECTION_SIZE;
const DEFAULT_CONTENT_URI = 'uxp://content/canvas';

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  widgetableId,
  value = [],
  showActionButtons = true,
  workBoundary,
  onValueChange,
}) => {
  const t = useWidgetText();
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();

  const imageUrl = value?.[0] ?? '';
  const addPrimaryLabel = t('image.upload.primary.manual', { defaultValue: '使用主图' });
  const cutLabel = t('image.upload.primary.cut', { defaultValue: '裁剪' });
  const scanLabel = t('image.upload.primary.scan', { defaultValue: '扫描' });

  const [fileUri, setFileUri] = useState<string>('');
  const [boundaryUri, setBoundaryUri] = useState<string>(workBoundary);
  const [maskUri, setMaskUri] = useState<string>('');
  const [auto, setAuto] = useState<boolean>(false);
  const [pendingUploads, setPendingUploads] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const markUploadStart = useCallback(() => {
    setPendingUploads(prev => prev + 1);
    setUploadError(null);
  }, []);

  const markUploadEnd = useCallback(() => {
    setPendingUploads(prev => (prev <= 1 ? 0 : prev - 1));
  }, []);

  const runWithUploading = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      markUploadStart();
      try {
        return await operation();
      } finally {
        markUploadEnd();
      }
    },
    [markUploadStart, markUploadEnd],
  );

  const uploading = pendingUploads > 0;
  const uploadStatus = uploadError ? 'error' : uploading ? 'uploading' : 'idle';
  const handleDismissError = useCallback(() => {
    setUploadError(null);
  }, []);
  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
    },
    [onValueChange],
  );
  const curDocId = useMemo(() => {
    const match = /^uxp:\/\/boundary\/(\d+)/.exec(workBoundary);
    return match ? match[1] : 0;
  }, [workBoundary]);

  useEffect(() => {
    const incoming = (value?.[0] ?? '').trim();
    setFileUri(prev => (incoming !== prev ? incoming : prev));
  }, [value]);

  useEffect(() => {
    setBoundaryUri(workBoundary);
  }, [workBoundary]);

  const effectiveBoundaryUri = boundaryUri || workBoundary;
  const effectiveFileUri = (fileUri || '').trim();

  const derivedContentUri = useMemo(() => {
    if (!effectiveBoundaryUri) return DEFAULT_CONTENT_URI;
    return `uxp://content/${curDocId}/canvas`;
  }, [effectiveBoundaryUri]);

  const thumbnailParams = useMemo<UseThumbnailParams>(() => {
    const base: UseThumbnailParams = {
      contentUri: derivedContentUri as ContentUri,
      boundaryUri: effectiveBoundaryUri as BoundaryUri,
      maskUri: maskUri as MaskUri,
    };

    if (!auto && effectiveFileUri) {
      return { ...base, fileUri: effectiveFileUri as FileUri };
    }

    return base;
  }, [auto, derivedContentUri, effectiveBoundaryUri, maskUri, effectiveFileUri]);

  useEffect(() => {
    logger(
      'ImageSelector useThumbnail params',
      JSON.stringify({
        auto,
        params: thumbnailParams,
      }),
    );
  }, [logger, auto, thumbnailParams]);

  const { data: previewUrl } = useThumbnail(thumbnailParams);

  const displayUrl = previewUrl ?? imageUrl ?? '';

  useEffect(() => {
    logger(
      'ImageSelector display source',
      JSON.stringify({
        auto,
        previewUrl,
        imageUrl,
        fileUri: effectiveFileUri,
        displayUrl,
        source: previewUrl ? 'previewUrl' : imageUrl ? 'imageUrl' : effectiveFileUri ? 'fileUri' : 'empty',
      }),
    );
  }, [logger, auto, previewUrl, imageUrl, effectiveFileUri, displayUrl]);

  const debugDetails = useMemo(
    () => ({
      contentUri: derivedContentUri || '-',
      fileUri: effectiveFileUri || '-',
      boundaryUri: effectiveBoundaryUri || '-',
      maskUri: maskUri || '-',
      auto: auto ? 'true' : 'false',
    }),
    [derivedContentUri, effectiveFileUri, effectiveBoundaryUri, maskUri, auto],
  );

  const actionButtonStyle = useMemo(
    () => ({
      width: ACTION_BUTTON_SIZE,
      height: ACTION_BUTTON_SIZE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
    }),
    [],
  );

  const handleSyncBase = useCallback(
    async (overrides?: { maskUri?: string | null; boundaryUri?: string | null }) => {
      try {
        const overrideMaskUri = overrides?.maskUri ?? maskUri;
        const overrideBoundaryUri = overrides?.boundaryUri ?? effectiveBoundaryUri;
        const normalizedMaskUri = overrideMaskUri?.trim() || undefined;
        const normalizedBoundaryUri = overrideBoundaryUri?.trim() || undefined;

        const result = await actions['resource.file.createFromCBM']({
          contentUri: derivedContentUri,
          maskUri: normalizedMaskUri,
          boundaryUri: normalizedBoundaryUri,
        });
        if (result?.resource) {
          setFileUri(result.resource);
          emitValue([result.resource]);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger('ImageSelector sync error', msg);
        setUploadError(msg);
      }
    },
    [actions, derivedContentUri, maskUri, effectiveBoundaryUri, logger, emitValue],
  );

  const handleSync = useCallback(
    async (overrides?: { maskUri?: string | null; boundaryUri?: string | null }) => {
      await runWithUploading(() => handleSyncBase(overrides));
    },
    [handleSyncBase, runWithUploading],
  );

  const handleAutoToggle = useCallback(() => {
    setAuto(prev => !prev);
  }, []);

  const handleMaskRebuildBase = useCallback(async (): Promise<string | undefined> => {
    try {
      const result = await actions['resource.file.createFromCBM']({
        maskUri: `uxp://mask/${curDocId}/selection`,
        boundaryUri: effectiveBoundaryUri,
      });
      if (result?.resource) {
        setMaskUri(result.resource);
        return result.resource;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger('ImageSelector mask rebuild error', msg);
      setUploadError(msg);
    }
    return undefined;
  }, [actions, effectiveBoundaryUri, logger, curDocId]);

  const handleBoundaryNormalizeBase = useCallback(async (): Promise<string | undefined> => {
    if (!effectiveBoundaryUri) return undefined;
    try {
      const result = await actions['resource.boundary.normalize']({
        boundary: `uxp://boundary/${curDocId}/selection`,
      });
      if (result?.boundary) {
        setBoundaryUri(result.boundary);
        return result.boundary;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger('ImageSelector boundary normalize error', msg);
      setUploadError(msg);
    }
    return undefined;
  }, [actions, effectiveBoundaryUri, logger, curDocId]);

  const handleMaskRebuildWithSync = useCallback(async () => {
    await runWithUploading(async () => {
      const updatedMaskUri = await handleMaskRebuildBase();
      await handleSyncBase({ maskUri: updatedMaskUri });
    });
  }, [runWithUploading, handleMaskRebuildBase, handleSyncBase]);

  const handleBoundaryNormalizeWithSync = useCallback(async () => {
    await runWithUploading(async () => {
      const updatedBoundaryUri = await handleBoundaryNormalizeBase();
      await handleSyncBase({ boundaryUri: updatedBoundaryUri });
    });
  }, [runWithUploading, handleBoundaryNormalizeBase, handleSyncBase]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: '100%',
        minHeight: SECTION_SIZE,
        height: SECTION_SIZE,
      }}
    >
      <div
        style={{
          height: SECTION_SIZE,
          flex: '0 0 auto',
          width: ACTION_BUTTON_SIZE,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <SyncButton
          className="single-image-sync-button"
          direction="vertical"
          buttonSize={SYNC_BUTTON_SIZE}
          buttonSizeSub={ACTION_BUTTON_SIZE}
          collapseToAutoWhenEnabled
          style={{ height: '100%' }}
          isAutoSync={auto}
          onSync={() => {
            void handleSync();
          }}
          onAutoSyncToggle={() => {
            handleAutoToggle();
          }}
          tooltipPlacement="right"
          data-testid={`single-image-sync-${widgetableId}`}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
            title={addPrimaryLabel}
          >
            <Plus size={18} strokeWidth={2} />
          </span>
        </SyncButton>
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: SECTION_SIZE,
          height: SECTION_SIZE,
          position: 'relative',
        }}
      >
        <ImagePreviewFrame
          imageUrl={displayUrl}
          background="checkerboard"
          data-testid={`single-image-preview-${widgetableId}`}
        />
        <UploadIndicator
          status={uploadStatus}
          errorMessage={uploadError ?? undefined}
          onDismiss={uploadError ? handleDismissError : undefined}
        />
        <DebugBadge details={debugDetails} />
      </div>
      {showActionButtons ? (
        <div
          style={{
            flex: '0 0 auto',
            width: SECTION_SIZE,
            height: SECTION_SIZE,
            display: 'flex',
            alignItems: 'flex-start',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            borderRadius: 'var(--ant-border-radius-lg, 6px)',
            overflow: 'hidden',
          }}
        >
          <Button
            type="default"
            icon={<Scissors size={18} strokeWidth={2} />}
            aria-label={cutLabel}
            title={cutLabel}
            style={{ ...actionButtonStyle, margin: 0 }}
            onClick={() => {
              void handleMaskRebuildWithSync();
            }}
          />
          <Button
            type="default"
            icon={<Scan size={18} strokeWidth={2} />}
            aria-label={scanLabel}
            title={scanLabel}
            style={{ ...actionButtonStyle, margin: 0 }}
            onClick={() => {
              void handleBoundaryNormalizeWithSync();
            }}
          />
        </div>
      ) : null}
    </div>
  );
};
