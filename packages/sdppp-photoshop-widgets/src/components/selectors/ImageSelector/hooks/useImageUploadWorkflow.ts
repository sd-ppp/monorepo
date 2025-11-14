import { useCallback, useEffect, useRef } from 'react';
import { v4 } from 'uuid';

import {
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../../../context/WidgetImageMaskContext';
import { useImageCbmActions } from '../../../../hooks/useImageCbmActions';
import { useManagedUploadTracker } from '../../../../hooks/useManagedUploadTracker';
import { useUploadCopy } from '../../../../hooks/useUploadCopy';
import { useWidgetValueEmitter } from '../../../../hooks/useWidgetValueEmitter';
import { DEFAULT_CONTENT_URI } from '../../../../utils/resolveThumbnailParams';
import { inferSourceModeFromContent } from '../utils';
import type { ImageSelectorProps, SourceMode } from '../types';
import type { ImageSelectorState } from './useImageSelectorState';

interface UseImageUploadWorkflowParams
  extends Pick<
    ImageSelectorProps,
    'onValueChange' | 'onUploadStateChange' | 'externalErrorDismissSignal'
  > {
  state: ImageSelectorState;
}

export interface ImageUploadWorkflow {
  uploadError: string | null;
  uploadProgress: { current: number; total: number };
  uploadStatus: 'idle' | 'uploading' | 'error';
  handleDismissError: () => void;
  sync: ReturnType<typeof useImageCbmActions>['sync'];
  rebuildMask: ReturnType<typeof useImageCbmActions>['rebuildMask'];
  normalizeBoundary: ReturnType<typeof useImageCbmActions>['normalizeBoundary'];
  handleResourceUpload: (resource?: string | null) => Promise<boolean>;
  handleSync: (
    overrides?: {
      contentUri?: string | null;
      maskUri?: string | null;
      boundaryUri?: string | null;
    } | null,
  ) => Promise<void>;
  handleAutoToggle: () => void;
  handleMaskRebuildWithSync: () => Promise<void>;
  handleBoundaryNormalizeWithSync: () => Promise<void>;
  handleSourceModeChange: (mode: SourceMode) => Promise<void>;
}

export const useImageUploadWorkflow = ({
  state,
  onValueChange,
  onUploadStateChange,
  externalErrorDismissSignal,
}: UseImageUploadWorkflowParams): ImageUploadWorkflow => {
  const {
    imageMaskActions: actions,
    logger,
    applyAuto,
    auto,
    autoRef,
    setFileUri,
    setMaskUri,
    setBoundaryUri,
    layerInfo,
    setLayerInfo,
    setContentUri,
    contentUri,
    setSourceMode,
    sourceModeRef,
    pendingManualFileRef,
    lastKnownValueRef,
    ensureContentUri,
    resolveCurrentLayer,
    derivedContentUri,
    effectiveBoundaryUri,
    maskUri,
    curDocId,
  } = state;

  const { errorLabel: uploadErrorLabel } = useUploadCopy();

  const {
    uploadError,
    uploadProgress,
    uploadStatus,
    setUploadError,
    setUploadProgress,
    markUploadStart,
    markUploadEnd,
    dismissUploadError,
  } = useManagedUploadTracker();

  const emitValue = useWidgetValueEmitter({
    onValueChange,
    logger,
    logLabel: 'ImageSelector emitValue',
  });

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

  const pendingAutoOverridesRef = useRef<{
    contentUri?: string | null;
    maskUri?: string | null;
    boundaryUri?: string | null;
  } | null>(null);

  const { addUploadPass, removeUploadPass, runUploadPassOnce } = useWidgetUploadPassHandlers();
  const autoUploadPassRef = useRef<{ pass: WidgetUploadPass } | null>(null);
  const autoUploadInFlightRef = useRef<boolean>(false);

  const handleDismissError = useCallback(() => {
    dismissUploadError();
  }, [dismissUploadError]);

  const clearAutoUploadPass = useCallback(() => {
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
  }, [markUploadEnd, removeUploadPass, setUploadProgress]);

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
      lastKnownValueRef.current = normalizedUploaded;
      setFileUri(resource);
      emitValue([normalizedUploaded]);
      logger(
        'ImageSelector upload pass success',
        JSON.stringify({ resource, uploaded: normalizedUploaded, mode }),
      );
      return true;
    },
    [emitValue, lastKnownValueRef, logger, setFileUri, setUploadError, setUploadProgress],
  );

  const applyUploadError = useCallback(
    (error: unknown, resource: string, mode: 'auto' | 'manual') => {
      const message = error instanceof Error ? error.message : String(error);
      const resolvedMessage = message?.trim() ? message.trim() : uploadErrorLabel;
      setUploadError(resolvedMessage);
      logger(
        'ImageSelector upload pass error',
        JSON.stringify({
          resource,
          mode,
          message: resolvedMessage,
          stack: error instanceof Error ? error.stack : undefined,
        }),
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
            fileName: `${v4()}.png`,
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
    [
      applyUploadError,
      applyUploadSuccess,
      logger,
      markUploadEnd,
      markUploadStart,
      setUploadProgress,
      uploadErrorLabel,
    ],
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
      if (!normalizedResource) return false;

      if (autoRef.current) {
        return false;
      }

      setFileUri(normalizedResource);

      const uploadPass = createUploadPass(async () => normalizedResource, 'manual');
      markUploadStart(1);
      setUploadProgress({ current: 0, total: 1 });
      let success = false;
      try {
        const uploaded = await runUploadPassOnce(uploadPass);
        const handled = applyUploadSuccess(uploaded, normalizedResource, 'manual');
        success = handled;
        if (!handled) {
          applyUploadError(uploadErrorLabel, normalizedResource, 'manual');
        }
      } catch (error) {
        applyUploadError(error, normalizedResource, 'manual');
      } finally {
        markUploadEnd();
      }
      return success;
    },
    [
      applyUploadError,
      applyUploadSuccess,
      autoRef,
      createUploadPass,
      markUploadEnd,
      markUploadStart,
      runUploadPassOnce,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );

  const lastReportedStateRef = useRef<string>('');
  useEffect(() => {
    if (!onUploadStateChange) return;
    const serialized = JSON.stringify({
      status: uploadStatus,
      errorMessage: uploadError,
      progress: uploadProgress,
    });
    if (serialized === lastReportedStateRef.current) return;
    lastReportedStateRef.current = serialized;
    onUploadStateChange({
      status: uploadStatus,
      errorMessage: uploadError,
      progress: uploadProgress,
    });
  }, [onUploadStateChange, uploadError, uploadProgress, uploadStatus]);

  const lastExternalDismissRef = useRef<number | undefined>(externalErrorDismissSignal);
  useEffect(() => {
    if (externalErrorDismissSignal === undefined) {
      lastExternalDismissRef.current = externalErrorDismissSignal;
      return;
    }
    if (lastExternalDismissRef.current === undefined) {
      lastExternalDismissRef.current = externalErrorDismissSignal;
      return;
    }
    if (externalErrorDismissSignal !== lastExternalDismissRef.current) {
      lastExternalDismissRef.current = externalErrorDismissSignal;
      if (uploadError) {
        handleDismissError();
      }
    }
  }, [externalErrorDismissSignal, handleDismissError, uploadError]);

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
      clearAutoUploadPass();
    },
    [clearAutoUploadPass],
  );

  const handleSync = useCallback(
    async (overrides?: {
      contentUri?: string | null;
      maskUri?: string | null;
      boundaryUri?: string | null;
    }) => {
      if (auto) {
        if (overrides) {
          pendingAutoOverridesRef.current = {
            ...(pendingAutoOverridesRef.current ?? {}),
            ...overrides,
          };
        }
        tryRegisterAutoUploadPass();
        return;
      }
      const resource = await sync(overrides);
      await handleResourceUpload(resource);
    },
    [auto, handleResourceUpload, sync, tryRegisterAutoUploadPass],
  );

  const flushAutoModeOnce = useCallback(async () => {
    const overrides = pendingAutoOverridesRef.current
      ? { ...pendingAutoOverridesRef.current }
      : undefined;
    pendingAutoOverridesRef.current = null;
    clearAutoUploadPass();
    try {
      const resource = await sync(overrides ?? undefined);
      await handleResourceUpload(resource);
    } catch (error) {
      logger(
        'ImageSelector flushAutoModeOnce error',
        JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    }
  }, [clearAutoUploadPass, handleResourceUpload, logger, sync]);

  const handleAutoToggle = useCallback(() => {
    const wasAuto = autoRef.current;
    const nextAuto = !wasAuto;
    applyAuto(nextAuto, { manual: true });
    if (nextAuto && sourceModeRef.current === 'file') {
      const inferredMode = inferSourceModeFromContent({
        contentUri,
        derivedContentUri,
      });
      if (inferredMode !== 'file') {
        setSourceMode(inferredMode);
      }
    }
    if (wasAuto && !nextAuto) {
      void flushAutoModeOnce();
    }
  }, [applyAuto, autoRef, contentUri, derivedContentUri, flushAutoModeOnce, setSourceMode, sourceModeRef]);

  const handleMaskRebuildWithSync = useCallback(async () => {
    ensureContentUri();
    const updatedMaskUri = await rebuildMask();
    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, maskUri: updatedMaskUri };
      tryRegisterAutoUploadPass();
      return;
    }
    const resource = await sync({ maskUri: updatedMaskUri });
    await handleResourceUpload(resource);
  }, [
    auto,
    ensureContentUri,
    handleResourceUpload,
    rebuildMask,
    sync,
    tryRegisterAutoUploadPass,
  ]);

  const handleBoundaryNormalizeWithSync = useCallback(async () => {
    ensureContentUri();
    const updatedBoundaryUri = await normalizeBoundary();
    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, boundaryUri: updatedBoundaryUri };
      tryRegisterAutoUploadPass();
      return;
    }
    const resource = await sync({ boundaryUri: updatedBoundaryUri });
    await handleResourceUpload(resource);
  }, [
    auto,
    ensureContentUri,
    handleResourceUpload,
    normalizeBoundary,
    sync,
    tryRegisterAutoUploadPass,
  ]);

  const handleSourceModeChange = useCallback(
    async (nextMode: SourceMode) => {
      const previousMode = sourceModeRef.current;
      if (nextMode === 'file') {
        const previousPendingManual = pendingManualFileRef.current;
        pendingManualFileRef.current = true;
        lastKnownValueRef.current = '';
        const createFromLocal = actions['resource.file.createFromLocal'];
        if (typeof createFromLocal !== 'function') {
          logger(
            'ImageSelector createFromLocal unavailable',
            JSON.stringify({ reason: 'handler_missing' }),
          );
          pendingManualFileRef.current = previousPendingManual;
          return;
        }
        try {
          const result = await createFromLocal();
          const normalized =
            typeof result?.resource === 'string' ? result.resource.trim() : '';
          if (!normalized) {
            pendingManualFileRef.current = previousPendingManual;
            return;
          }
          applyAuto(false, { manual: true });
          const success = await handleResourceUpload(normalized);
          if (success) {
            setLayerInfo(null);
            setContentUri('');
            setSourceMode('file', { manual: true });
          } else {
            pendingManualFileRef.current = previousPendingManual;
          }
        } catch (error) {
          logger(
            'ImageSelector createFromLocal error',
            JSON.stringify({
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            }),
          );
          pendingManualFileRef.current = previousPendingManual;
        }
        return;
      }

      if (nextMode === previousMode) {
        return;
      }

      setSourceMode(nextMode, { manual: true });

      if (nextMode === 'canvas') {
        pendingManualFileRef.current = false;
        setLayerInfo(null);
        setFileUri('');
        const canvasUri =
          curDocId && String(curDocId).trim()
            ? `uxp://content/${curDocId}/canvas`
            : DEFAULT_CONTENT_URI;
        setContentUri(canvasUri);
        void handleSync({ contentUri: canvasUri });
        return;
      }
      if (nextMode === 'layer') {
        pendingManualFileRef.current = false;
        setFileUri('');
        console.debug(
          '[ImageSelector] layer mode resolve start',
          JSON.stringify({
            boundaryUri: effectiveBoundaryUri,
            contentUri,
          }),
        );
        logger(
          'ImageSelector layer mode resolve start',
          JSON.stringify({
            boundaryUri: effectiveBoundaryUri,
            contentUri,
          }),
        );
        const resolved = await resolveCurrentLayer();
        console.debug(
          '[ImageSelector] layer mode resolve result',
          JSON.stringify({ resolved, layerInfo }),
        );
        logger(
          'ImageSelector layer mode resolve result',
          JSON.stringify({
            resolved,
            layerInfo,
          }),
        );
        if (resolved) {
          void handleSync({ contentUri: resolved });
          if (sourceModeRef.current === 'layer') {
            void resolveCurrentLayer();
          }
        } else {
          void handleSync({});
          if (sourceModeRef.current === 'layer') {
            void resolveCurrentLayer();
          }
        }
        return;
      }
    },
    [
      actions,
      applyAuto,
      curDocId,
      handleResourceUpload,
      handleSync,
      lastKnownValueRef,
      contentUri,
      effectiveBoundaryUri,
      logger,
      pendingManualFileRef,
      layerInfo,
      resolveCurrentLayer,
      setContentUri,
      setFileUri,
      setLayerInfo,
      setSourceMode,
      sourceModeRef,
    ],
  );

  return {
    uploadError,
    uploadProgress,
    uploadStatus,
    handleDismissError,
    sync,
    rebuildMask,
    normalizeBoundary,
    handleResourceUpload,
    handleSync,
    handleAutoToggle,
    handleMaskRebuildWithSync,
    handleBoundaryNormalizeWithSync,
    handleSourceModeChange,
  };
};
