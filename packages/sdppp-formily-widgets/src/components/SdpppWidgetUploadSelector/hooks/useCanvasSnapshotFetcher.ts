import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { buildBoundaryRectUri } from '../../ImageSelector/utils';
import type { UploadStatus } from '../types';
import type { ResourceHandle } from '../../../../context/SdpppWidgetContext';

type TranslateOptions = Record<string, unknown> & { defaultValue?: string };

type Translator = (key: string, options?: TranslateOptions) => string;

type ImageMaskAction = (...args: any[]) => any;

type ImageMaskActions = Partial<Record<string, ImageMaskAction>>;

type UploadProgress = { current: number; total: number };

type UpdateStatus = (status: UploadStatus, message: string | null, progress?: UploadProgress) => void;

interface CanvasSnapshotDeps {
  t: Translator;
  logger?: (...args: unknown[]) => void;
  imageMaskActions: ImageMaskActions;
  pendingManualFileRef: MutableRefObject<boolean>;
  defaultBoundaryUri: string;
  curDocId?: number | null;
  hasSelectionBoundary: boolean;
  selectionBoundary: unknown;
  setInitialState: (active: boolean) => void;
  setSourceMode: (mode: string, payload?: unknown) => void;
  setLayerInfo: (info: unknown) => void;
  setMaskResource: (resource: string, handle: ResourceHandle | null) => void;
  setContentUri: (uri: string) => void;
  setBoundaryUri: (uri?: string) => void;
  setResultSnapshotResource: (resource: string, handle: ResourceHandle | null) => void;
  setPreviewResource: (resource: string) => void;
  setPreviewRevision: Dispatch<SetStateAction<number>>;
  resolvePreviewResource: (resource: string) => Promise<string>;
  uploadResource: (resource: string, fileName?: string) => Promise<string>;
  emitValue: (url: string) => void;
  updateStatus: UpdateStatus;
}

export const useCanvasSnapshotFetcher = ({
  t,
  logger,
  imageMaskActions,
  pendingManualFileRef,
  defaultBoundaryUri,
  curDocId,
  hasSelectionBoundary,
  selectionBoundary,
  setInitialState,
  setSourceMode,
  setLayerInfo,
  setMaskResource,
  setContentUri,
  setBoundaryUri,
  setResultSnapshotResource,
  setPreviewResource,
  setPreviewRevision,
  resolvePreviewResource,
  uploadResource,
  emitValue,
  updateStatus,
}: CanvasSnapshotDeps) => {
  const combineCanvasSnapshot = useCallback(
    async (content: string, boundary: string) => {
      const fn = imageMaskActions['resource.file.combineByCBM'];
      if (typeof fn !== 'function') {
        throw new Error('resource.file.combineByCBM unavailable');
      }
      const result = await fn({
        contentUri: content,
        boundaryUri: boundary,
        maskUri: undefined,
        thumbnail: true,
      });
      if (result?.error) {
        throw new Error(String(result.error));
      }
      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      if (!resource) {
        throw new Error('combineByCBM 未返回有效资源');
      }
      setResultSnapshotResource(resource, result?.handle ?? null);
      return resource;
    },
    [imageMaskActions, setResultSnapshotResource],
  );

  const handleFetchFromCanvas = useCallback(async () => {
    const docId = typeof curDocId === 'number' && curDocId > 0 ? curDocId : 0;
    const canvasUri = `uxp://content/${docId}/canvas`;
    // Always use full canvas boundary instead of selection
    const boundary = defaultBoundaryUri;

    if (!boundary) {
      updateStatus(
        'error',
        t('taskrouter.upload.error.boundaryMissing', { defaultValue: '未找到限定范围' }),
      );
      return;
    }

    const previousPending = pendingManualFileRef.current;
    pendingManualFileRef.current = true;

    try {
      setInitialState(false);
      setSourceMode('canvas', { manual: true });
      setLayerInfo(null);
      setMaskResource('', null);
      setContentUri(canvasUri);
      setBoundaryUri(boundary);

      const resource = await combineCanvasSnapshot(canvasUri, boundary);
      const preview = await resolvePreviewResource(resource);
      setPreviewResource(preview);
      setPreviewRevision(prev => prev + 1);

      const uploaded = await uploadResource(resource);
      emitValue(uploaded);
      logger?.('taskrouter:upload-selector canvas snapshot success', uploaded);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus('error', message);
      logger?.('taskrouter:upload-selector canvas snapshot failed', message);
    } finally {
      pendingManualFileRef.current = previousPending;
    }
  }, [
    combineCanvasSnapshot,
    curDocId,
    defaultBoundaryUri,
    emitValue,
    hasSelectionBoundary,
    logger,
    pendingManualFileRef,
    resolvePreviewResource,
    uploadResource,
    selectionBoundary,
    setBoundaryUri,
    setContentUri,
    setInitialState,
    setLayerInfo,
    setMaskResource,
    setPreviewRevision,
    setSourceMode,
    t,
    updateStatus,
  ]);

  return {
    handleFetchFromCanvas,
  };
};
