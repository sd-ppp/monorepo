import { ImagePreviewFrame, SyncButton } from '@sdppp/ui-library';
import { Button } from 'antd';
import { Plus, Scan, Scissors } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useWidgetImageMaskActions,
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../context/WidgetImageMaskContext';
import { useThumbnail, type UseThumbnailParams } from '../features/realtime-thumbnail/useThumbnail';
import { UploadIndicator } from './common/UploadIndicator';
import { DebugBadge } from './DebugBadge';
import {
  DEFAULT_CONTENT_URI,
  resolveThumbnailParams,
} from './hooks/resolveThumbnailParams';
import { useImageCbmActions } from './hooks/useImageCbmActions';
import { useImageSelectorDebug } from './hooks/useImageSelectorDebug';
import { useUploadTracker } from './hooks/useUploadTracker';

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
  const uploadErrorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );

  const [fileUri, setFileUri] = useState<string>('');
  const [boundaryUri, setBoundaryUri] = useState<string>(workBoundary);
  const [maskUri, setMaskUri] = useState<string>('');
  const [auto, setAuto] = useState<boolean>(false);
  const autoRef = useRef<boolean>(auto);
  autoRef.current = auto;
  const {
    uploadError,
    uploadProgress,
    uploadStatus,
    resetProgress,
    setUploadError,
    setUploadProgress,
    markUploadStart,
    markUploadEnd,
  } = useUploadTracker();

  useEffect(() => {
    if (uploadStatus === 'idle' && uploadError === null) {
      resetProgress();
    }
  }, [uploadStatus, uploadError, resetProgress]);

  const handleDismissError = useCallback(() => {
    resetProgress();
  }, [resetProgress]);
  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      logger('ImageSelector emitValue', JSON.stringify(next));
      onValueChange(next);
    },
    [logger, onValueChange],
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

  const thumbnailParams = useMemo<UseThumbnailParams>(
    () =>
      resolveThumbnailParams({
        isAutoEnabled: auto,
        contentUri: derivedContentUri,
        boundaryUri: effectiveBoundaryUri,
        maskUri,
        fileUri: effectiveFileUri,
        defaultContentUri: DEFAULT_CONTENT_URI,
      }),
    [auto, derivedContentUri, effectiveBoundaryUri, maskUri, effectiveFileUri],
  );

  const { data: previewUrl } = useThumbnail(thumbnailParams);

  const displayUrl = previewUrl ?? imageUrl ?? '';

  const { debugDetails } = useImageSelectorDebug({
    auto,
    displayUrl,
    imageUrl,
    fileUri: effectiveFileUri,
    contentUri: derivedContentUri,
    boundaryUri: effectiveBoundaryUri,
    maskUri,
    thumbnailParams,
    logger,
  });

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

  const { sync, rebuildMask, normalizeBoundary } = useImageCbmActions({
    actions,
    contentUri: derivedContentUri,
    boundaryUri: effectiveBoundaryUri,
    maskUri,
    documentId: curDocId,
    onFileResource: setFileUri,
    onMaskUri: setMaskUri,
    onBoundaryUri: setBoundaryUri,
    setUploadError,
    logger,
  });

  const syncRef = useRef(sync);
  syncRef.current = sync;
  const pendingAutoOverridesRef = useRef<{ maskUri?: string | null; boundaryUri?: string | null } | null>(null);

  const { addUploadPass, removeUploadPass, runUploadPassOnce } = useWidgetUploadPassHandlers();
  const autoUploadPassRef = useRef<{ pass: WidgetUploadPass } | null>(null);
  const autoUploadInFlightRef = useRef<boolean>(false);

  const clearAutoUploadPass = useCallback(
    (options?: { markEnd?: boolean }) => {
      const current = autoUploadPassRef.current;
      if (!current) return;
      removeUploadPass(current.pass);
      autoUploadPassRef.current = null;
      pendingAutoOverridesRef.current = null;
      if (autoUploadInFlightRef.current) {
        markUploadEnd();
        setUploadProgress(prev => (prev.total === 0 ? prev : { current: 0, total: 0 }));
      }
      autoUploadInFlightRef.current = false;
    },
    [markUploadEnd, removeUploadPass, setUploadProgress],
  );

  const applyUploadSuccess = useCallback(
    (uploaded: string | null | undefined, resource: string, mode: 'auto' | 'manual') => {
      const normalizedUploaded = typeof uploaded === 'string' ? uploaded.trim() : '';
      if (!normalizedUploaded) {
        logger(
          'ImageSelector upload pass empty result',
          JSON.stringify({ resource, mode }),
        );
        return false;
      }

      if (mode === 'manual') {
        setUploadProgress({ current: 1, total: 1 });
      }
      setUploadError(null);
      setFileUri(normalizedUploaded);
      emitValue([normalizedUploaded]);
      logger(
        'ImageSelector upload pass success',
        JSON.stringify({ resource, uploaded: normalizedUploaded, mode }),
      );
      return true;
    },
    [emitValue, logger, setFileUri, setUploadProgress],
  );

  const applyUploadError = useCallback(
    (error: unknown, resource: string, mode: 'auto' | 'manual') => {
      const message = error instanceof Error ? error.message : String(error);
      const resolvedMessage = message?.trim() ? message.trim() : uploadErrorLabel;
      setUploadError(resolvedMessage);
      logger(
        'ImageSelector upload pass error',
        JSON.stringify({ resource, mode, message: resolvedMessage }),
      );
    },
    [logger, setUploadError, uploadErrorLabel],
  );

  const createUploadPass = useCallback(
    (resolveResource: () => Promise<string | null | undefined>, mode: 'auto' | 'manual'): WidgetUploadPass => {
      let lastResolvedResource = '';
      const uploadPass: WidgetUploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          if (signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }
          if (mode === 'auto') {
            markUploadStart(1);
            setUploadProgress({ current: 0, total: 1 });
            autoUploadInFlightRef.current = true;
          }
          const resolved = await resolveResource();
          const normalizedResource = typeof resolved === 'string' ? resolved.trim() : '';
          lastResolvedResource = normalizedResource;
          if (!normalizedResource) {
            throw new Error('Upload resource unavailable');
          }
          return {
            type: 'resource',
            resource: normalizedResource,
            resourceId: normalizedResource,
          };
        },
      };

      if (mode === 'auto') {
        uploadPass.onUploaded = async uploaded => {
          const isCurrentPass = autoUploadPassRef.current?.pass === uploadPass;
          if (!isCurrentPass) {
            logger(
              'ImageSelector auto upload pass ignored',
              JSON.stringify({ resource: lastResolvedResource, uploaded }),
            );
            return;
          }

          const handled = applyUploadSuccess(uploaded, lastResolvedResource, 'auto');
          if (!handled) {
            applyUploadError(uploadErrorLabel, lastResolvedResource, 'auto');
          }
          markUploadEnd();
          setUploadProgress(prev => (prev.total === 0 ? prev : { current: 0, total: 0 }));
          autoUploadInFlightRef.current = false;
        };

        uploadPass.onUploadError = error => {
          const isCurrentPass = autoUploadPassRef.current?.pass === uploadPass;
          if (!isCurrentPass) {
            logger(
              'ImageSelector auto upload pass error ignored',
              JSON.stringify({ resource: lastResolvedResource, error }),
            );
            return;
          }
          applyUploadError(error, lastResolvedResource, 'auto');
          markUploadEnd();
          setUploadProgress(prev => (prev.total === 0 ? prev : { current: 0, total: 0 }));
          autoUploadInFlightRef.current = false;
        };
      }

      return uploadPass;
    },
    [applyUploadError, applyUploadSuccess, logger, markUploadEnd, setUploadProgress, uploadErrorLabel,
      markUploadStart],
  );

  const tryRegisterAutoUploadPass = useCallback(() => {
    if (!autoRef.current) return;

    if (autoUploadPassRef.current) return;

    const resolveResource = async () => {
      const overrides = pendingAutoOverridesRef.current ?? undefined;
      pendingAutoOverridesRef.current = null;
      const resource = await syncRef.current(overrides);
      return resource ?? '';
    };

    const uploadPass = createUploadPass(resolveResource, 'auto');
    autoUploadPassRef.current = { pass: uploadPass };
    addUploadPass(uploadPass);
    logger('ImageSelector auto upload pass added');
  }, [addUploadPass, createUploadPass, logger]);

  const handleResourceUpload = useCallback(
    async (resource?: string | null) => {
      const normalizedResource = (resource ?? '').trim();
      if (!normalizedResource) return;

      if (autoRef.current) {
        return;
      }

      const uploadPass = createUploadPass(async () => normalizedResource, 'manual');
      markUploadStart(1);
      setUploadProgress({ current: 0, total: 1 });
      try {
        const uploaded = await runUploadPassOnce(uploadPass);
        const handled = applyUploadSuccess(uploaded, normalizedResource, 'manual');
        if (!handled) {
          applyUploadError(uploadErrorLabel, normalizedResource, 'manual');
        }
      } catch (error) {
        applyUploadError(error, normalizedResource, 'manual');
      } finally {
        markUploadEnd();
      }
    },
    [
      applyUploadError,
      applyUploadSuccess,
      createUploadPass,
      markUploadEnd,
      markUploadStart,
      runUploadPassOnce,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );

  useEffect(() => {
    if (auto) {
      pendingAutoOverridesRef.current = null;
      tryRegisterAutoUploadPass();
    } else {
      clearAutoUploadPass();
    }
  }, [auto, clearAutoUploadPass, tryRegisterAutoUploadPass]);

  useEffect(
    () => () => {
      clearAutoUploadPass({ markEnd: false });
    },
    [clearAutoUploadPass],
  );

  const handleSync = useCallback(
    async (overrides?: { maskUri?: string | null; boundaryUri?: string | null }) => {
      if (auto) {
        pendingAutoOverridesRef.current = overrides ?? null;
        tryRegisterAutoUploadPass();
        return;
      }
      const resource = await sync(overrides);
      await handleResourceUpload(resource);
    },
    [auto, handleResourceUpload, tryRegisterAutoUploadPass, sync],
  );

  const handleAutoToggle = useCallback(() => {
    setAuto(prev => !prev);
  }, []);

  const handleMaskRebuildWithSync = useCallback(async () => {
    const updatedMaskUri = await rebuildMask();
    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, maskUri: updatedMaskUri };
      tryRegisterAutoUploadPass();
      return;
    }
    const resource = await sync({ maskUri: updatedMaskUri });
    await handleResourceUpload(resource);
  }, [auto, handleResourceUpload, rebuildMask, tryRegisterAutoUploadPass, sync]);

  const handleBoundaryNormalizeWithSync = useCallback(async () => {
    const updatedBoundaryUri = await normalizeBoundary();
    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, boundaryUri: updatedBoundaryUri };
      tryRegisterAutoUploadPass();
      return;
    }
    const resource = await sync({ boundaryUri: updatedBoundaryUri });
    await handleResourceUpload(resource);
  }, [auto, handleResourceUpload, normalizeBoundary, tryRegisterAutoUploadPass, sync]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        gap: 8,
      }}
    >
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
      <UploadIndicator
        status={uploadStatus}
        errorMessage={uploadError ?? undefined}
        onDismiss={uploadError ? handleDismissError : undefined}
        progressCurrent={uploadProgress.current}
        progressTotal={uploadProgress.total}
        containerStyle={{
          position: 'static',
          width: '100%',
          marginTop: 4,
        }}
      />
    </div>
  );
};
