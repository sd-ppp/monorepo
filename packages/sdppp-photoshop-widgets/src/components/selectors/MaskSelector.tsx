import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ImagePreviewSplitList, SyncButton } from '@sdppp/ui-library';

import {
  useWidgetImageMaskActions,
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import { useMaskPreviewParams } from '../../hooks/useMaskPreviewParams';
import { useThumbnail } from '../../hooks/useThumbnail';
import type { BoundaryUri, ContentUri, MaskUri } from '../../hooks/useThumbnail/types';
import { useUploadTracker } from '../../hooks/useUploadTracker';
import { UploadableImagePreviewSplit } from '../shared/UploadableImagePreviewSplit';
import { UploadIndicator } from '../shared/UploadIndicator';

interface MaskSelectorProps {
  widgetableId: string;
  value: string[];
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
}

const BUTTON_SIZE = 160;
type MaskSourceKind = 'selection' | 'curlayer' | 'canvas';

export const MaskSelector: React.FC<MaskSelectorProps> = ({ widgetableId, value = [], workBoundary, onValueChange }) => {
  const t = useWidgetText();
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();

  const uploadErrorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );
  const selectionMaskLabel = useMemo(
    () => t('image.upload.mask.selection', { defaultValue: '选区遮罩' }),
    [t],
  );
  const layerMaskLabel = useMemo(
    () => t('image.upload.mask.layer', { defaultValue: '图层遮罩' }),
    [t],
  );
  const resetLabel = useMemo(
    () => t('image.upload.primary.advanced.reset', { defaultValue: '重置' }),
    [t],
  );

  const imageUrl = useMemo(() => (value?.[0] ?? '').trim(), [value]);
  const [maskResource, setMaskResource] = useState<string>('');
  const [docIdFallback, setDocIdFallback] = useState<number | null>(null);
  const [lastSourceMode, setLastSourceMode] = useState<MaskSourceKind>('selection');

  const {
    uploadStatus,
    uploadError,
    uploadProgress,
    markUploadStart,
    markUploadEnd,
    setUploadError,
    setUploadProgress,
    resetProgress,
  } = useUploadTracker();

  useEffect(() => {
    if (uploadStatus === 'idle' && uploadError === null) {
      resetProgress();
    }
  }, [uploadStatus, uploadError, resetProgress]);

  useEffect(() => {
    setMaskResource(prev => {
      if (imageUrl && imageUrl !== prev) return imageUrl;
      if (!imageUrl && prev !== '') return '';
      return prev;
    });
  }, [imageUrl]);

  const boundaryUri = useMemo(() => (typeof workBoundary === 'string' ? workBoundary.trim() : ''), [workBoundary]);

  const docIdFromValue = useMemo<number | null>(() => {
    if (!imageUrl.startsWith('uxp://mask/')) return null;
    const match = /^uxp:\/\/mask\/(\d+)\//.exec(imageUrl);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }, [imageUrl]);

  useEffect(() => {
    if (docIdFromValue !== null && !Number.isNaN(docIdFromValue)) {
      setDocIdFallback(docIdFromValue);
    }
  }, [docIdFromValue]);

  const docIdFromBoundary = useMemo<number>(() => {
    const match = /^uxp:\/\/boundary\/(\d+)/.exec(boundaryUri);
    const parsed = match ? Number(match[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }, [boundaryUri]);

  useEffect(() => {
    if (docIdFromBoundary > 0) {
      setDocIdFallback(docIdFromBoundary);
    }
  }, [docIdFromBoundary]);

  const effectiveDocId = useMemo<number>(() => {
    if (docIdFromBoundary > 0) return docIdFromBoundary;
    if (docIdFallback && docIdFallback > 0) return docIdFallback;
    return 0;
  }, [docIdFromBoundary, docIdFallback]);

  const maskSourceAvailable = effectiveDocId > 0;

  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      onValueChange(next);
      logger('MaskSelector emitValue', JSON.stringify(next));
    },
    [logger, onValueChange],
  );

  const lastRequestedModeRef = useRef<MaskSourceKind>('selection');

  const buildMaskUri = useCallback(
    (mode: MaskSourceKind, docId: number) => `uxp://mask/${docId}/${mode}`,
    [],
  );

  const requestMaskResource = useCallback(
    async (mode: MaskSourceKind, docId: number) => {
      const maskUri = buildMaskUri(mode, docId);
      lastRequestedModeRef.current = mode;
      const result = await actions['resource.file.createFromCBM']({
        maskUri,
        boundaryUri: boundaryUri || undefined,
      });
      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      const reportedError =
        typeof result?.error === 'string' && result.error.trim().length > 0
          ? result.error.trim()
          : null;

      if (!resource) {
        throw new Error(reportedError ?? 'resource.file.createFromCBM returned empty resource');
      }

      return resource;
    },
    [actions, boundaryUri, buildMaskUri],
  );

  const applyUploadSuccess = useCallback(
    (uploaded: string | null | undefined, mode: MaskSourceKind): boolean => {
      const normalized = typeof uploaded === 'string' ? uploaded.trim() : '';
      if (!normalized) return false;
      setMaskResource(normalized);
      setUploadError(null);
      setLastSourceMode(mode);
      emitValue([normalized]);
      logger('MaskSelector upload success', JSON.stringify({ mode, resource: normalized }));
      return true;
    },
    [emitValue, logger, setMaskResource, setUploadError],
  );

  const applyUploadError = useCallback(
    (error: unknown, mode: MaskSourceKind) => {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const resolved = message && message.trim().length > 0 ? message.trim() : uploadErrorLabel;
      setUploadError(resolved);
      logger('MaskSelector upload error', JSON.stringify({ mode, message: resolved }));
    },
    [logger, setUploadError, uploadErrorLabel],
  );

  const resolveDocIdOrEmitError = useCallback(
    (maskType: MaskSourceKind): number | null => {
      if (maskSourceAvailable) {
        return effectiveDocId;
      }
      setUploadError(uploadErrorLabel);
      setUploadProgress({ current: 0, total: 0 });
      logger('MaskSelector docId missing', JSON.stringify({ maskType, boundaryUri }));
      return null;
    },
    [boundaryUri, effectiveDocId, logger, maskSourceAvailable, setUploadError, setUploadProgress, uploadErrorLabel],
  );

  const manualUploadInFlightRef = useRef(false);

  const createManualUploadPass = useCallback(
    (mode: MaskSourceKind, docId: number): WidgetUploadPass => ({
      getUploadFile: async (signal?: AbortSignal) => {
        if (signal?.aborted) {
          throw new DOMException('Upload aborted', 'AbortError');
        }
        const resource = await requestMaskResource(mode, docId);
        return {
          type: 'resource',
          resource,
          resourceId: resource,
        };
      },
    }),
    [requestMaskResource],
  );

  const runManualMask = useCallback(
    async (mode: MaskSourceKind) => {
      const docId = resolveDocIdOrEmitError(mode);
      if (docId === null) return;
      const uploadPass = createManualUploadPass(mode, docId);
      setUploadError(null);
      markUploadStart(1);
      setUploadProgress({ current: 0, total: 1 });
      manualUploadInFlightRef.current = true;
      try {
        const uploaded = await runUploadPassOnce(uploadPass);
        const handled = applyUploadSuccess(uploaded, mode);
        if (!handled) {
          applyUploadError(uploadErrorLabel, mode);
        } else {
          setUploadProgress({ current: 1, total: 1 });
        }
      } catch (error) {
        applyUploadError(error, mode);
      } finally {
        manualUploadInFlightRef.current = false;
        markUploadEnd();
      }
    },
    [
      applyUploadError,
      applyUploadSuccess,
      createManualUploadPass,
      markUploadEnd,
      markUploadStart,
      resolveDocIdOrEmitError,
      runUploadPassOnce,
      setUploadError,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );

  const handleSelectionMask = useCallback(() => {
    void runManualMask('selection');
  }, [runManualMask]);

  const handleLayerMask = useCallback(() => {
    void runManualMask('curlayer');
  }, [runManualMask]);

  const handleReset = useCallback(() => {
    setLastSourceMode('canvas');
    void runManualMask('canvas');
  }, [runManualMask]);

  const handleRetry = useCallback(() => {
    void runManualMask(lastRequestedModeRef.current);
  }, [runManualMask]);

  const handleDismissError = useCallback(() => {
    setUploadError(null);
    resetProgress();
  }, [resetProgress, setUploadError]);

  const derivedDocId = effectiveDocId > 0 ? effectiveDocId : 0;
  const derivedBoundaryUri = useMemo<BoundaryUri>(() => {
    if (boundaryUri) return boundaryUri as BoundaryUri;
    if (derivedDocId > 0) return `uxp://boundary/${derivedDocId}/canvas` as BoundaryUri;
    return 'uxp://boundary/0/canvas' as BoundaryUri;
  }, [boundaryUri, derivedDocId]);

  const derivedContentUri = useMemo<ContentUri>(() => {
    if (derivedDocId > 0) return `uxp://content/${derivedDocId}/canvas` as ContentUri;
    return 'uxp://content/canvas' as ContentUri;
  }, [derivedDocId]);

  const activeMaskUri = useMemo(() => {
    if (derivedDocId <= 0) return null;
    return buildMaskUri(lastSourceMode, derivedDocId) as MaskUri;
  }, [buildMaskUri, derivedDocId, lastSourceMode]);

  const previewParams = useMaskPreviewParams({
    isAutoEnabled: false,
    contentUri: derivedContentUri,
    boundaryUri: derivedBoundaryUri,
    maskUri: activeMaskUri ?? '',
    fileUri: maskResource,
  });

  const { data: previewUrl } = useThumbnail(previewParams);
  const displayUrl = previewUrl ?? maskResource ?? '';

  const disableButtons = manualUploadInFlightRef.current;

  const items = useMemo(() => {
    const leftNode = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <SyncButton
            buttonSize={BUTTON_SIZE}
            disabled={disableButtons}
            isAutoSync={false}
            autoSyncEnabled={false}
            onSync={() => {
              void handleSelectionMask();
            }}
            onAutoSyncToggle={undefined}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={16} strokeWidth={2} />
              {selectionMaskLabel}
            </span>
          </SyncButton>
        </div>
        <div>
          <SyncButton
            buttonSize={BUTTON_SIZE}
            disabled={disableButtons}
            isAutoSync={false}
            autoSyncEnabled={false}
            onSync={() => {
              void handleLayerMask();
            }}
            onAutoSyncToggle={undefined}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Plus size={16} strokeWidth={2} />
              {layerMaskLabel}
            </span>
          </SyncButton>
        </div>
        <div>
          <SyncButton
            buttonSize={BUTTON_SIZE}
            disabled={disableButtons}
            isAutoSync={false}
            autoSyncEnabled={false}
            onSync={() => {
              handleReset();
            }}
            onAutoSyncToggle={undefined}
          >
            {resetLabel}
          </SyncButton>
        </div>
      </div>
    );

    return [
      <div
        key={`mask-selector-${widgetableId}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <UploadableImagePreviewSplit
          left={leftNode}
          imageUrl={displayUrl}
          background="white"
          uploadStatus="idle"
        />
        <UploadIndicator
          status={uploadStatus}
          errorMessage={uploadError ?? uploadErrorLabel}
          onRetry={uploadStatus === 'error' ? handleRetry : undefined}
          onDismiss={uploadStatus === 'error' ? handleDismissError : undefined}
          progressCurrent={uploadProgress.current}
          progressTotal={uploadProgress.total}
        />
      </div>,
    ];
  }, [
    disableButtons,
    displayUrl,
    handleDismissError,
    handleLayerMask,
    handleReset,
    handleRetry,
    handleSelectionMask,
    layerMaskLabel,
    resetLabel,
    selectionMaskLabel,
    uploadError,
    uploadErrorLabel,
    uploadProgress.current,
    uploadProgress.total,
    uploadStatus,
    widgetableId,
  ]);

  return <ImagePreviewSplitList items={items} />;
};

export default MaskSelector;
