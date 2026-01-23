import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 } from 'uuid';

import {
  useWidgetText,
  useWidgetUploadPassHandlers,
  type MaterializedResourceRef,
  type WidgetUploadPass,
  type ResourceHandle,
} from '../../../../context/PhotoshopWidgetContext';
import { sdpppSDK } from '@sdppp/common';
import { useManagedUploadTracker } from '../../../../hooks/useManagedUploadTracker';
import { useUploadCopy } from '../../../../hooks/useUploadCopy';
import { useWidgetValueEmitter } from '../../../../hooks/useWidgetValueEmitter';
import { getSuccessfulMaterializeRecord } from '../../../../utils/fileUtils';
import type { UploadIndicatorStatus } from '../../../shared/UploadIndicator';
import type { ImageSelectorProps, SourceMode } from '../types';
import type { ImageSelectorState } from './useImageSelectorState';
import type { DocScopedUriSnapshot } from './useImageResourceState';
import { buildBoundaryRectUri } from '../utils';

interface UseImageUploadWorkflowParams
  extends Pick<
    ImageSelectorProps,
    'onValueChange' | 'onUploadStateChange' | 'externalErrorDismissSignal'
  > {
  state: ImageSelectorState;
  onPreviewInvalidate?: () => void;
}

export interface ImageUploadWorkflow {
  indicatorStatus: UploadIndicatorStatus;
  uploadingMessage?: string | null;
  uploadError: string | null;
  uploadProgress: { current: number; total: number };
  uploadStatus: 'idle' | 'uploading' | 'error';
  handleDismissError: () => void;
  withUploadIndicator: <T>(operation: () => Promise<T>, options?: { message?: string }) => Promise<T>;
  sync: (
    overrides?: { contentUri?: string | null; maskUri?: string | null; boundaryUri?: string | null },
    docSyncContext?: Pick<DocScopedUriSnapshot, 'contentUri' | 'maskUri' | 'boundaryUri'>,
  ) => Promise<MaterializedResourceRef | undefined>;
  rebuildMask: () => Promise<MaterializedResourceRef | undefined>;
  handleResourceUpload: (resource?: MaterializedResourceRef | null) => Promise<boolean>;
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
  onPreviewInvalidate,
}: UseImageUploadWorkflowParams): ImageUploadWorkflow => {
  const t = useWidgetText();
  const {
    imageMaskActions: actions,
    applyAuto,
    auto,
    autoRef,
    setDiskFileResource,
    diskFileUri,
    setResultSnapshotResource,
    clearResultSnapshot,
    setPreparedContentResource,
    setMaskResource,
    setBoundaryUri,
    selectionBoundary,
    layerInfo,
    setLayerInfo,
    setContentUri,
    contentUri,
    boundaryUri,
    setSourceMode,
    sourceModeRef,
    pendingManualFileRef,
    lastKnownValueRef,
    resolveCurrentLayer,
    maskUri,
    curDocId,
    diskFileHandleRef,
    contentHandleRef,
    maskHandleRef,
    workBoundary,
    setInitialState,
    syncDocScopedUrisIfNeeded,
  } = state;

  const markInitialized = useCallback(() => {
    setInitialState(false);
  }, [setInitialState]);

  const { errorLabel: uploadErrorLabel } = useUploadCopy();

  const makePerfLogger = useCallback(
    (label: string) => {
      void label;
      return () => undefined;
    },
    [],
  );

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
  });

  const pendingAutoOverridesRef = useRef<{
    contentUri?: string | null;
    maskUri?: string | null;
    boundaryUri?: string | null;
  } | null>(null);

  const { addUploadPass, removeUploadPass, runUploadPassOnce } = useWidgetUploadPassHandlers();
  const autoUploadPassRef = useRef<{ pass: WidgetUploadPass } | null>(null);  const autoUploadInFlightRef = useRef<boolean>(false);
  const lastResolvedHandleRef = useRef<ResourceHandle | null>(null);
  const preparedContentResourceRef = useRef<string | null>(null);
  const preparedMaskResourceRef = useRef<string | null>(null);

  const resolveDefaultMaskUri = useCallback((): string => {
    const normalizedDocId =
      typeof curDocId === 'number' && Number.isFinite(curDocId) && curDocId > 0
        ? Math.trunc(curDocId)
        : 0;
    return `uxp://mask/${normalizedDocId}/canvas`;
  }, [curDocId]);

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

  const prepareContentHandle = useCallback(
    async (rawUri: string): Promise<string> => {
      const normalized = (rawUri ?? '').trim();
      if (!normalized) {
        throw new Error('Content source unavailable');
      }
      if (normalized === preparedContentResourceRef.current) {
        return normalized;
      }
      if (normalized.startsWith('uxp://file/')) {
        preparedContentResourceRef.current = normalized;
        setPreparedContentResource(normalized, contentHandleRef.current ?? null);
        return normalized;
      }
      const fn = actions['resource.file.createByContent'];
      if (typeof fn !== 'function') {
        throw new Error('resource.file.createByContent unavailable');
      }
      const result = await fn({ contentUri: normalized });
      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      if (!resource) {
        throw new Error('Content handle unavailable');
      }
      preparedContentResourceRef.current = resource;
      setPreparedContentResource(resource, result?.handle ?? null);
      return resource;
    },
    [actions, contentHandleRef, setPreparedContentResource],
  );

  const prepareMaskHandle = useCallback(
    async (rawUri?: string | null): Promise<string | null> => {
      const normalized = (rawUri ?? '').trim();
      if (!normalized) {
        preparedMaskResourceRef.current = null;
        setMaskResource('', null);
        return null;
      }
      if (/\/empty(?:\/|\?|#|$)/.test(normalized)) {
        preparedMaskResourceRef.current = null;
        setMaskResource('', null);
        return null;
      }
      if (normalized === preparedMaskResourceRef.current) {
        return normalized;
      }
      if (normalized.startsWith('uxp://file/')) {
        preparedMaskResourceRef.current = normalized;
        setMaskResource(normalized, maskHandleRef.current ?? null);
        return normalized;
      }
      const fn = actions['resource.file.createByMask'];
      if (typeof fn !== 'function') {
        throw new Error('resource.file.createByMask unavailable');
      }
      const result = await fn({ maskUri: normalized });
      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      if (!resource) {
        preparedMaskResourceRef.current = null;
        setMaskResource('', null);
        return null;
      }
      preparedMaskResourceRef.current = resource;
      setMaskResource(resource, result?.handle ?? null);
      return resource;
    },
    [actions, maskHandleRef, setMaskResource],
  );

  const combineComposite = useCallback(
    async (params: {
      contentUri: string;
      boundaryUri: string;
      maskUri?: string | null;
      meta?: Record<string, unknown>;
    }) => {
      const fn = actions['resource.file.combineByCBM'];
      if (typeof fn !== 'function') {
        throw new Error('resource.file.combineByCBM unavailable');
      }
      const payload = {
        contentUri: params.contentUri,
        boundaryUri: params.boundaryUri,
        maskUri: params.maskUri ? params.maskUri : undefined,
        meta: params.meta,
      };
      console.info('[ImageUploadWorkflow] combineComposite invoke', payload);
      const result = await fn(payload);
      if ((result as any)?.error) {
        throw new Error((result as any)?.error ?? 'combine failed');
      }
      return result ?? null;
    },
    [actions],
  );

  const rebuildMask = useCallback(async (): Promise<MaterializedResourceRef | undefined> => {
    const selectionUri = curDocId > 0 ? `uxp://mask/${curDocId}/selection` : '';
    if (!selectionUri) {
      return undefined;
    }
    const resource = await prepareMaskHandle(selectionUri);
    if (!resource) {
      return undefined;
    }
    return {
      resource,
      handle: maskHandleRef.current ?? undefined,
    };
  }, [curDocId, maskHandleRef, prepareMaskHandle]);

  useEffect(() => {
    preparedContentResourceRef.current = null;
  }, [contentUri]);

  useEffect(() => {
    preparedMaskResourceRef.current = null;
  }, [maskUri]);

  const sync = useCallback(
    async (
      overrides?: { contentUri?: string | null; maskUri?: string | null; boundaryUri?: string | null },
      docSyncContext?: Pick<DocScopedUriSnapshot, 'contentUri' | 'maskUri' | 'boundaryUri'>,
    ) => {
      try {
        const snapshot = docSyncContext ?? syncDocScopedUrisIfNeeded();
        const normalizedOverrides = overrides ?? undefined;
        const overrideContent =
          typeof normalizedOverrides?.contentUri === 'string'
            ? normalizedOverrides.contentUri.trim()
            : undefined;
        const overrideBoundary =
          typeof normalizedOverrides?.boundaryUri === 'string'
            ? normalizedOverrides.boundaryUri.trim()
            : undefined;
        const overrideMaskRaw =
          Object.prototype.hasOwnProperty.call(normalizedOverrides ?? {}, 'maskUri') &&
          normalizedOverrides
            ? normalizedOverrides.maskUri
            : undefined;

        const baseContent = (snapshot.contentUri ?? '').trim();
        const baseBoundary = (snapshot.boundaryUri ?? '').trim();
        const fallbackBoundary =
          baseBoundary || (boundaryUri ?? '').trim() || (workBoundary ?? '').trim();
        const fallbackMask = (snapshot.maskUri ?? '').trim();

        const effectiveContent = (
          overrideContent && overrideContent.length > 0
            ? overrideContent
            : baseContent
        );
        const effectiveBoundary = (overrideBoundary ?? fallbackBoundary).trim();

        let effectiveMask: string | null | undefined;
        if (overrideMaskRaw === null) {
          effectiveMask = resolveDefaultMaskUri();
        } else if (typeof overrideMaskRaw === 'string') {
          effectiveMask = overrideMaskRaw.trim();
        } else {
          const maskFallback = fallbackMask.length ? fallbackMask : (maskUri ?? '').trim();
          const sanitizedFallback = maskFallback.length ? maskFallback : resolveDefaultMaskUri();
          effectiveMask = sanitizedFallback.length ? sanitizedFallback : undefined;
        }

        if (!effectiveContent) {
          return undefined;
        }
        if (!effectiveBoundary) {
          return undefined;
        }

        const result = await combineComposite({
          contentUri: effectiveContent,
          boundaryUri: effectiveBoundary,
          maskUri: effectiveMask ?? null,
        });

        lastResolvedHandleRef.current = result?.handle ?? null;

        if (result?.resource) {
          setResultSnapshotResource(result.resource, result?.handle ?? null);
        }
        return result ?? undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setUploadError(message);
        return undefined;
      }
    },
    [
      boundaryUri,
      combineComposite,
      resolveDefaultMaskUri,
      maskUri,
      setResultSnapshotResource,
      setUploadError,
      syncDocScopedUrisIfNeeded,
      workBoundary,
    ],
  );

  const syncRef = useRef(sync);
  syncRef.current = sync;

  const applyUploadSuccess = useCallback(
    (uploaded: string | null | undefined, resource: string, mode: 'auto' | 'manual') => {
      const normalizedUploaded = typeof uploaded === 'string' ? uploaded.trim() : '';
      if (!normalizedUploaded) {
        return false;
      }

      if (mode === 'manual') {
        setUploadProgress({ current: 1, total: 1 });
      }
      setUploadError(null);
      lastKnownValueRef.current = normalizedUploaded;
      const pendingHandle = lastResolvedHandleRef.current;
      if (sourceModeRef.current === 'file' || pendingManualFileRef.current) {
        setDiskFileResource(resource, pendingHandle ?? undefined);
      }
      if (pendingHandle) {
        lastResolvedHandleRef.current = null;
      }
      emitValue([normalizedUploaded]);
      return true;
    },
    [emitValue, lastKnownValueRef, pendingManualFileRef, setDiskFileResource, setUploadError, setUploadProgress, lastResolvedHandleRef, sourceModeRef],
  );

  const applyUploadError = useCallback(
    (error: unknown, resource: string, mode: 'auto' | 'manual') => {
      const message = error instanceof Error ? error.message : String(error);
      const resolvedMessage = message?.trim() ? message.trim() : uploadErrorLabel;
      setUploadError(resolvedMessage);
      if (lastResolvedHandleRef.current) {
        lastResolvedHandleRef.current.dispose();
        lastResolvedHandleRef.current = null;
      }
    },
    [setUploadError, uploadErrorLabel, lastResolvedHandleRef],
  );

  const [customUploadingMessage, setCustomUploadingMessage] = useState<string | null>(null);
  const [customUploading, setCustomUploading] = useState<boolean>(false);
  const beginCustomUploading = useCallback(
    (message?: string | null) => {
      setCustomUploading(true);
      setCustomUploadingMessage(
        message ?? t('image.upload.syncing', { defaultValue: '素材同步中' }),
      );
    },
    [t],
  );
  const endCustomUploading = useCallback(() => {
    setCustomUploading(false);
    setCustomUploadingMessage(null);
  }, []);

  const withUploadIndicator = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: { message?: string },
    ): Promise<T> => {
      beginCustomUploading(options?.message ?? null);
      try {
        return await operation();
      } finally {
        endCustomUploading();
      }
    },
    [beginCustomUploading, endCustomUploading],
  );

  const createUploadPass = useCallback(
    (
      resolveResource: () => Promise<MaterializedResourceRef | null | undefined>,
      mode: 'auto' | 'manual',
    ): WidgetUploadPass => {
      const passLog = makePerfLogger(`ImageSelector uploadPass.${mode}`);
      let lastResolvedResource = '';
      const uploadPass: WidgetUploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          passLog('getUploadFile.start');
          if (signal?.aborted) {
            passLog('getUploadFile.aborted');
            throw new DOMException('Upload aborted', 'AbortError');
          }
          if (mode === 'auto') {
            beginCustomUploading();
            markUploadStart(1);
            setUploadProgress({ current: 0, total: 1 });
            autoUploadInFlightRef.current = true;
          }
          passLog('resolveResource.start');
          const resolved = await resolveResource();
          const normalizedResource =
            typeof resolved?.resource === 'string' ? resolved.resource.trim() : '';
          lastResolvedResource = normalizedResource;
          lastResolvedHandleRef.current = resolved?.handle ?? null;
          if (!normalizedResource) {
            passLog('resolveResource.empty');
            throw new Error('Upload resource unavailable');
          }
          passLog('resolveResource.completed', { resource: normalizedResource });
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
          passLog('onUploaded', { uploaded });
          const isCurrentPass = autoUploadPassRef.current?.pass === uploadPass;
          if (!isCurrentPass) {
            return;
          }

          const handled = applyUploadSuccess(uploaded, lastResolvedResource, 'auto');
          if (!handled) {
            applyUploadError(uploadErrorLabel, lastResolvedResource, 'auto');
            passLog('onUploaded.applyFailed', { resource: lastResolvedResource });
          } else {
            passLog('onUploaded.completed', { resource: lastResolvedResource });
          }
          endCustomUploading();
          markUploadEnd();
          setUploadProgress(prev => (prev.total === 0 ? prev : { current: 0, total: 0 }));
          autoUploadInFlightRef.current = false;
        };

        uploadPass.onUploadError = error => {
          passLog('onUploadError', {
            resource: lastResolvedResource,
            message: error instanceof Error ? error.message : String(error),
          });
          const isCurrentPass = autoUploadPassRef.current?.pass === uploadPass;
          if (!isCurrentPass) {
            return;
          }
          applyUploadError(error, lastResolvedResource, 'auto');
          endCustomUploading();
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
      beginCustomUploading,
      endCustomUploading,
      makePerfLogger,
      markUploadEnd,
      markUploadStart,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );

  const tryRegisterAutoUploadPass = useCallback(() => {
    if (!autoRef.current) return;
    if (autoUploadPassRef.current) return;

    const resolveResource = async (): Promise<MaterializedResourceRef | null> => {
      const overrides = pendingAutoOverridesRef.current ?? undefined;
      pendingAutoOverridesRef.current = null;
      const maskOverride = maskHandleRef.current?.resourceId ?? undefined;
      const nextOverrides =
        overrides || maskOverride
          ? {
              ...(overrides ?? {}),
              maskUri: overrides?.maskUri ?? maskOverride,
            }
          : undefined;
      const resource = await syncRef.current(nextOverrides);
      return resource ?? null;
    };

    const uploadPass = createUploadPass(resolveResource, 'auto');
    autoUploadPassRef.current = { pass: uploadPass };
    addUploadPass(uploadPass);
  }, [addUploadPass, createUploadPass, maskHandleRef]);

  const handleResourceUpload = useCallback(
    async (resource?: MaterializedResourceRef | null) => {
      const normalizedResource = (resource?.resource ?? '').trim();
      if (!normalizedResource) return false;

      if (autoRef.current) {
        return false;
      }

      const uploadLog = makePerfLogger('ImageSelector manualUpload');
      uploadLog('start', { resource: normalizedResource });
      endCustomUploading();
      const incomingHandle = resource?.handle ?? null;
      if (pendingManualFileRef.current) {
        setDiskFileResource(normalizedResource, incomingHandle ?? undefined);
      }
      uploadLog('resourceRegistered', { hasHandle: Boolean(incomingHandle) });

      const uploadPass = createUploadPass(async () => resource ?? { resource: normalizedResource, handle: incomingHandle ?? null }, 'manual');
      markUploadStart(1);
      setUploadProgress({ current: 0, total: 1 });
      uploadLog('uploadPass.created');
      let success = false;
      try {
        uploadLog('runUploadPassOnce.start');
        const uploaded = await runUploadPassOnce(uploadPass);
        uploadLog('runUploadPassOnce.completed', {
          uploaded: typeof uploaded === 'string' ? uploaded : null,
        });
        const handled = applyUploadSuccess(uploaded, normalizedResource, 'manual');
        success = handled;
        if (!handled) {
          applyUploadError(uploadErrorLabel, normalizedResource, 'manual');
        }
      } catch (error) {
        uploadLog('runUploadPassOnce.error', {
          message: error instanceof Error ? error.message : String(error),
        });
        applyUploadError(error, normalizedResource, 'manual');
      } finally {
        markUploadEnd();
        uploadLog('completed', { success });
      }
      return success;
    },
    [
      applyUploadError,
      applyUploadSuccess,
      autoRef,
      createUploadPass,
      endCustomUploading,
      makePerfLogger,
      markUploadEnd,
      markUploadStart,
      runUploadPassOnce,
      setUploadProgress,
      setDiskFileResource,
      pendingManualFileRef,
      uploadErrorLabel,
    ],
  );

  const runManualComposite = useCallback(
    async (
      overrides?: { contentUri?: string | null; maskUri?: string | null; boundaryUri?: string | null } | null,
      options?: { refreshMask?: boolean; maskOverride?: string | null },
      docSyncContext?: Pick<DocScopedUriSnapshot, 'contentUri' | 'maskUri' | 'boundaryUri'>,
    ) => {
      console.info('[ImageUploadWorkflow] runManualComposite start', {
        overrides,
        options,
        docSnapshot: docSyncContext,
        sourceMode: sourceModeRef.current,
      });
      const normalizedOverrides = overrides ?? undefined;
      const overrideBoundary =
        typeof normalizedOverrides?.boundaryUri === 'string'
          ? normalizedOverrides.boundaryUri.trim()
          : undefined;
      const normalizedWorkBoundary = (workBoundary ?? '').trim();
      const baseBoundary = (docSyncContext?.boundaryUri ?? boundaryUri ?? '').trim();
      const fallbackBoundary = baseBoundary || normalizedWorkBoundary;
      const effectiveBoundary = (overrideBoundary ?? fallbackBoundary).trim();
      if (!effectiveBoundary) {
        console.warn('[ImageUploadWorkflow] runManualComposite missing boundary, abort');
        throw new Error('Boundary unavailable');
      }

      if (sourceModeRef.current === 'file') {
        console.info('[ImageUploadWorkflow] runManualComposite short-circuit: file mode upload');
        const normalizedUpload = (diskFileUri ?? '').trim();
        if (!normalizedUpload) {
          throw new Error('Upload resource unavailable');
        }
        await handleResourceUpload({
          resource: normalizedUpload,
          handle: diskFileHandleRef.current ?? undefined,
        });
        return;
      }

      const overrideContentValue =
        typeof normalizedOverrides?.contentUri === 'string'
          ? normalizedOverrides.contentUri.trim()
          : undefined;

      const baseContentCandidate = (docSyncContext?.contentUri ?? contentUri).trim();
      const targetContentCandidate =
        overrideContentValue && overrideContentValue.length > 0
          ? overrideContentValue
          : baseContentCandidate;
      if (!targetContentCandidate) {
        throw new Error('Content source unavailable');
      }

      const preparedContentResource = await prepareContentHandle(targetContentCandidate);

      const hasMaskOverride =
        normalizedOverrides &&
        Object.prototype.hasOwnProperty.call(normalizedOverrides, 'maskUri');
      const hasMaskOption =
        options && Object.prototype.hasOwnProperty.call(options, 'maskOverride');

      let maskResource: string | null | undefined;

      if (hasMaskOption) {
        const override = (options?.maskOverride ?? '').trim();
        if (override) {
          maskResource = override;
          preparedMaskResourceRef.current = override;
          setMaskResource(override, maskHandleRef.current ?? null);
        } else {
          maskResource = resolveDefaultMaskUri();
          preparedMaskResourceRef.current = null;
          setMaskResource('', null);
        }
      } else if (hasMaskOverride) {
        const overrideValue = normalizedOverrides?.maskUri ?? undefined;
        if (overrideValue === null) {
          maskResource = resolveDefaultMaskUri();
          preparedMaskResourceRef.current = null;
          setMaskResource('', null);
        } else if (typeof overrideValue === 'string') {
          maskResource = await prepareMaskHandle(overrideValue);
        }
      } else if (preparedMaskResourceRef.current) {
        maskResource = preparedMaskResourceRef.current;
      } else if (maskHandleRef.current?.resourceId) {
        maskResource = maskHandleRef.current.resourceId.trim();
      } else {
        const baseMaskUri = (docSyncContext?.maskUri ?? maskUri ?? '').trim();
        if (baseMaskUri) {
          maskResource = await prepareMaskHandle(baseMaskUri);
        } else {
          maskResource = resolveDefaultMaskUri();
        }
      }

      if (options?.refreshMask) {
        const refreshed = await prepareMaskHandle(`uxp://mask/${curDocId}/selection`);
        maskResource = refreshed ?? maskResource;
      }

      if (!maskResource) {
        maskResource = resolveDefaultMaskUri();
      }

      const finalResult = await combineComposite({
        contentUri: preparedContentResource,
        boundaryUri: effectiveBoundary,
        maskUri: maskResource ?? null,
      });

      lastResolvedHandleRef.current = finalResult?.handle ?? null;

      if (finalResult?.resource) {
        setResultSnapshotResource(finalResult.resource, finalResult?.handle ?? null);
      }
      await handleResourceUpload(finalResult);
    },
    [
      boundaryUri,
      combineComposite,
      contentUri,
      curDocId,
      diskFileHandleRef,
      diskFileUri,
      handleResourceUpload,
      maskHandleRef,
      maskUri,
      prepareContentHandle,
      prepareMaskHandle,
      resolveDefaultMaskUri,
      setMaskResource,
      setResultSnapshotResource,
      sourceModeRef,
      workBoundary,
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
      const flowLog = makePerfLogger('ImageSelector syncFlow');
      flowLog('invoked', { auto, trigger: overrides ? 'override' : 'default' });
      markInitialized();
      const docSnapshot = syncDocScopedUrisIfNeeded();

      const hasPreviewOverride =
        overrides &&
        (Object.prototype.hasOwnProperty.call(overrides, 'maskUri') ||
          Object.prototype.hasOwnProperty.call(overrides, 'boundaryUri'));
      if (hasPreviewOverride) {
        onPreviewInvalidate?.();
      }

      if (auto) {
        if (overrides) {
          pendingAutoOverridesRef.current = {
            ...(pendingAutoOverridesRef.current ?? {}),
            ...overrides,
          };
        }
        tryRegisterAutoUploadPass();
        flowLog('delegatedToAuto', { hasOverrides: Boolean(overrides) });
        return;
      }

      try {
        await withUploadIndicator(
          () => runManualComposite(overrides ?? null, { refreshMask: false }, docSnapshot),
          { message: t('image.upload.syncing', { defaultValue: '素材同步中' }) },
        );
        onPreviewInvalidate?.();
        flowLog('uploadCompleted', { success: true });
        flowLog('completed');
      } catch (error) {
        flowLog('failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [
      auto,
      makePerfLogger,
      runManualComposite,
      syncDocScopedUrisIfNeeded,
      t,
      tryRegisterAutoUploadPass,
      onPreviewInvalidate,
      markInitialized,
      withUploadIndicator,
    ],
  );

  const flushAutoModeOnce = useCallback(async () => {
    const overrides = pendingAutoOverridesRef.current
      ? { ...pendingAutoOverridesRef.current }
      : undefined;
    pendingAutoOverridesRef.current = null;
    clearAutoUploadPass();
    try {
      const maskOverride = maskHandleRef.current?.resourceId ?? undefined;
      const nextOverrides =
        overrides || maskOverride
          ? {
              ...(overrides ?? {}),
              maskUri: overrides?.maskUri ?? maskOverride,
            }
          : undefined;
      const docSnapshot = syncDocScopedUrisIfNeeded();
      const resource = await withUploadIndicator(() => sync(nextOverrides ?? undefined, docSnapshot));
      await handleResourceUpload(resource);
    } catch (_error) {
      // ignore errors after best-effort flush
    }
  }, [clearAutoUploadPass, handleResourceUpload, maskHandleRef, sync, syncDocScopedUrisIfNeeded, withUploadIndicator]);

  const handleAutoToggle = useCallback(() => {
    const wasAuto = autoRef.current;
    const nextAuto = !wasAuto;
    markInitialized();
    applyAuto(nextAuto, { manual: true });
    if (wasAuto && !nextAuto) {
      void flushAutoModeOnce();
    }
  }, [applyAuto, autoRef, flushAutoModeOnce, markInitialized]);

  const handleMaskRebuildWithSync = useCallback(async () => {
    markInitialized();
    const docSnapshot = syncDocScopedUrisIfNeeded();
    const updatedMask = await withUploadIndicator(() => rebuildMask(), {
      message: t('image.upload.syncing', { defaultValue: '素材同步中' }),
    });
    const updatedMaskUri = updatedMask?.resource ?? null;
    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, maskUri: updatedMaskUri };
      tryRegisterAutoUploadPass();
      onPreviewInvalidate?.();
      return;
    }
    await withUploadIndicator(
      () =>
        runManualComposite(
          { maskUri: updatedMaskUri },
          { refreshMask: false, maskOverride: updatedMaskUri ?? null },
          docSnapshot,
        ),
      { message: t('image.upload.syncing', { defaultValue: '素材同步中' }) },
    );
    onPreviewInvalidate?.();
  }, [
    auto,
    onPreviewInvalidate,
    rebuildMask,
    tryRegisterAutoUploadPass,
    runManualComposite,
    syncDocScopedUrisIfNeeded,
    withUploadIndicator,
    t,
  ]);

  const handleBoundaryNormalizeWithSync = useCallback(async () => {
    markInitialized();
    const docSnapshot = syncDocScopedUrisIfNeeded();
    if (!selectionBoundary) {
      return;
    }
    const updatedBoundaryUri = buildBoundaryRectUri(selectionBoundary, curDocId);
    setBoundaryUri(updatedBoundaryUri);

    if (auto) {
      const overrides = pendingAutoOverridesRef.current ?? {};
      pendingAutoOverridesRef.current = { ...overrides, boundaryUri: updatedBoundaryUri };
      tryRegisterAutoUploadPass();
      onPreviewInvalidate?.();
      return;
    }

    await withUploadIndicator(
      () =>
        runManualComposite({ boundaryUri: updatedBoundaryUri }, { refreshMask: false }, docSnapshot),
      { message: t('image.upload.syncing', { defaultValue: '素材同步中' }) },
    );
    onPreviewInvalidate?.();
  }, [
    auto,
    onPreviewInvalidate,
    runManualComposite,
    selectionBoundary,
    setBoundaryUri,
    syncDocScopedUrisIfNeeded,
    tryRegisterAutoUploadPass,
    withUploadIndicator,
    t,
  ]);

  const handleSourceModeChange = useCallback(
    async (nextMode: SourceMode) => {
      markInitialized();
      const previousMode = sourceModeRef.current;
      if (nextMode === 'file') {
        const previousPendingManual = pendingManualFileRef.current;
        pendingManualFileRef.current = true;
        lastKnownValueRef.current = '';
        const createFromLocal = actions['resource.file.createFromLocal'];
        if (typeof createFromLocal !== 'function') {
          pendingManualFileRef.current = previousPendingManual;
          return;
        }
        try {
          const result = await createFromLocal();
          const record = getSuccessfulMaterializeRecord(result);
          const normalized = record?.resource ? record.resource.trim() : '';
          const handle = record?.handle ?? null;
          if (!normalized) {
            handle?.dispose();
            pendingManualFileRef.current = previousPendingManual;
            return;
          }
          applyAuto(false, { manual: true });
          const success = await handleResourceUpload({
            resource: normalized,
            handle: handle ?? undefined,
          });
          if (success) {
            setLayerInfo(null);
            setSourceMode('file', { manual: true });
            clearResultSnapshot();
            markInitialized();
            pendingManualFileRef.current = previousPendingManual;
          } else {
            handle?.dispose();
            pendingManualFileRef.current = previousPendingManual;
          }
        } catch (error) {
          // consume errors silently; UI will remain on previous mode
          pendingManualFileRef.current = previousPendingManual;
        }
        return;
      }

      if (nextMode === previousMode) {
        return;
      }

      markInitialized();
      setSourceMode(nextMode, { manual: true });

      if (nextMode === 'canvas') {
        pendingManualFileRef.current = false;
        setLayerInfo(null);
        setDiskFileResource('', null);
        const normalizedDocId =
          typeof curDocId === 'number' && Number.isFinite(curDocId) && curDocId > 0
            ? Math.trunc(curDocId)
            : 0;
        const canvasUri = `uxp://content/${normalizedDocId}/canvas`;
        setContentUri(canvasUri);
        void handleSync({ contentUri: canvasUri });
        return;
      }
      if (nextMode === 'layer') {
        pendingManualFileRef.current = false;
        setDiskFileResource('', null);
        const {
          contentUri: resolvedContent,
          boundaryUri: resolvedBoundary,
        } = await resolveCurrentLayer();
        if (resolvedContent) {
          await handleSync({
            contentUri: resolvedContent,
            boundaryUri: resolvedBoundary ?? undefined,
            maskUri: maskUri ?? null,
          });
          if (sourceModeRef.current === 'layer') {
            const refresh = await resolveCurrentLayer();
            if (refresh.contentUri) {
              setContentUri(refresh.contentUri);
            }
          }
        } else {
          await handleSync({});
          if (sourceModeRef.current === 'layer') {
            const refresh = await resolveCurrentLayer();
            if (refresh.contentUri) {
              setContentUri(refresh.contentUri);
            }
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
      maskUri,
      pendingManualFileRef,
      layerInfo,
      resolveCurrentLayer,
      setContentUri,
      setDiskFileResource,
      clearResultSnapshot,
      setLayerInfo,
      setSourceMode,
      sourceModeRef,
      setBoundaryUri,
      markInitialized,
    ],
  );

  useEffect(() => {
    if (uploadStatus === 'uploading') {
      if (customUploading) {
        setCustomUploading(false);
      }
      if (customUploadingMessage) {
        setCustomUploadingMessage(null);
      }
    }
  }, [uploadStatus, customUploading, customUploadingMessage]);

  const indicatorStatus: UploadIndicatorStatus =
    uploadStatus !== 'idle' ? uploadStatus : customUploading ? 'uploading' : 'idle';

  const uploadingMessage =
    indicatorStatus === 'uploading' && uploadStatus === 'idle' ? customUploadingMessage : null;

  return {
    indicatorStatus,
    uploadingMessage,
    uploadError,
    uploadProgress,
    uploadStatus,
    handleDismissError,
    withUploadIndicator,
    sync,
    rebuildMask,
    handleResourceUpload,
    handleSync,
    handleAutoToggle,
    handleMaskRebuildWithSync,
    handleBoundaryNormalizeWithSync,
    handleSourceModeChange,
  };
};
