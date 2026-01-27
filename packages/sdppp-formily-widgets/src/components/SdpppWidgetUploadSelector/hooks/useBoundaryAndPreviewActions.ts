import { useCallback } from 'react';
import type { Dispatch, MouseEvent, MutableRefObject, SetStateAction } from 'react';

import type { UploadStatus } from '../types';
import { IDLE_PROGRESS, resetHandle } from '../utils';
import type { ResourceHandle } from '../../../../context/SdpppWidgetContext';

type TranslateOptions = Record<string, unknown> & { defaultValue?: string };

type Translator = (key: string, options?: TranslateOptions) => string;

type ImageMaskAction = (...args: any[]) => any;

type ImageMaskActions = Partial<Record<string, ImageMaskAction>>;

type UploadProgress = { current: number; total: number };

type UpdateStatus = (status: UploadStatus, message: string | null, progress?: UploadProgress) => void;

interface BoundaryAndPreviewDeps {
  t: Translator;
  imageMaskActions: ImageMaskActions;
  boundaryUri: string | undefined;
  defaultBoundaryUri: string;
  documentIdForSelection: number | undefined;
  diskFileHandleRef: MutableRefObject<ResourceHandle | null>;
  pendingManualFileRef: MutableRefObject<boolean>;
  lastKnownValueRef: MutableRefObject<string>;
  setMaskResource: (resource: string, handle: ResourceHandle | null) => void;
  setDiskFileResource: (resource: string, handle: ResourceHandle | null) => void;
  setContentUri: (uri: string) => void;
  setBoundaryUri: (uri?: string) => void;
  clearResultSnapshot: () => void;
  setLayerInfo: (info: unknown) => void;
  setInitialState: (active: boolean) => void;
  setPreviewRevision: Dispatch<SetStateAction<number>>;
  setPreviewResource: (resource: string) => void;
  emitValue: (value: string) => void;
  updateStatus: UpdateStatus;
}

export const useBoundaryAndPreviewActions = ({
  t,
  imageMaskActions,
  boundaryUri,
  defaultBoundaryUri,
  documentIdForSelection,
  diskFileHandleRef,
  pendingManualFileRef,
  lastKnownValueRef,
  setMaskResource,
  setDiskFileResource,
  setContentUri,
  setBoundaryUri,
  clearResultSnapshot,
  setLayerInfo,
  setInitialState,
  setPreviewRevision,
  setPreviewResource,
  emitValue,
  updateStatus,
}: BoundaryAndPreviewDeps) => {
  const handleClear = useCallback(() => {
    setMaskResource('', null);
    setDiskFileResource('', null);
    setContentUri('');
    setBoundaryUri(defaultBoundaryUri);
    clearResultSnapshot();
    setLayerInfo(null);
    setInitialState(true);
    if (diskFileHandleRef.current) {
      resetHandle(diskFileHandleRef.current);
      diskFileHandleRef.current = null;
    }
    pendingManualFileRef.current = false;
    lastKnownValueRef.current = '';
    setPreviewRevision(prev => prev + 1);
    setPreviewResource('');
    emitValue('');
    updateStatus('idle', null, IDLE_PROGRESS);
  }, [
    clearResultSnapshot,
    defaultBoundaryUri,
    diskFileHandleRef,
    emitValue,
    lastKnownValueRef,
    pendingManualFileRef,
    setBoundaryUri,
    setContentUri,
    setDiskFileResource,
    setInitialState,
    setLayerInfo,
    setMaskResource,
    setPreviewResource,
    setPreviewRevision,
    updateStatus,
  ]);

  const restoreBoundarySelection = useCallback(async () => {
    const normalizedBoundary = (boundaryUri ?? '').trim() || defaultBoundaryUri;
    if (!normalizedBoundary) {
      updateStatus(
        'error',
        t('taskrouter.upload.error.boundaryRestoreUnavailable', { defaultValue: '当前没有可恢复的限定范围' }),
      );
      return;
    }
    const action = imageMaskActions['selection.selectFromBoundaryUri'];
    if (typeof action !== 'function') {
      updateStatus(
        'error',
        t('taskrouter.upload.error.boundaryRestoreFailed', { defaultValue: '无法恢复限定范围选区' }),
      );
      return;
    }
    try {
      const result = await action({
        boundaryUri: normalizedBoundary,
        documentId: documentIdForSelection,
      });
      if (result && result.success === false) {
        const message = result.error ?? '';
        updateStatus(
          'error',
          message || t('taskrouter.upload.error.boundaryRestoreFailed', { defaultValue: '恢复限定范围失败' }),
        );
        return;
      }
      updateStatus('idle', null, IDLE_PROGRESS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus(
        'error',
        message || t('taskrouter.upload.error.boundaryRestoreFailed', { defaultValue: '恢复限定范围失败' }),
      );
    }
  }, [
    boundaryUri,
    defaultBoundaryUri,
    documentIdForSelection,
    imageMaskActions,
    t,
    updateStatus,
  ]);

  const handlePreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        void restoreBoundarySelection();
      }
    },
    [restoreBoundarySelection],
  );

  return {
    handleClear,
    handlePreviewClick,
    restoreBoundarySelection,
  };
};
