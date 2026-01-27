import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  buildBufferPayloadFromFile,
  getSuccessfulMaterializeRecord,
  isImageFile,
} from '../../../utils/fileUtils';
import { resetHandle } from '../utils';
import type { UploadStatus } from '../types';
import type { ResourceHandle } from '../../../context/SdpppWidgetContext';

type TranslateOptions = Record<string, unknown> & { defaultValue?: string };

type Translator = (key: string, options?: TranslateOptions) => string;

type ImageMaskAction = (...args: any[]) => any;

type ImageMaskActions = Partial<Record<string, ImageMaskAction>>;

type UploadProgress = { current: number; total: number };

type UpdateStatus = (status: UploadStatus, message: string | null, progress?: UploadProgress) => void;

interface ManualUploadDeps {
  t: Translator;
  imageMaskActions: ImageMaskActions;
  pendingManualFileRef: MutableRefObject<boolean>;
  diskFileHandleRef: MutableRefObject<ResourceHandle | null>;
  setInitialState: (active: boolean) => void;
  setSourceMode: (mode: string, payload?: unknown) => void;
  setLayerInfo: (info: unknown) => void;
  setMaskResource: (resource: string, handle: ResourceHandle | null) => void;
  setBoundaryUri: (uri?: string) => void;
  setDiskFileResource: (resource: string, handle?: ResourceHandle) => void;
  setResultSnapshotResource: (resource: string, handle: ResourceHandle | null) => void;
  setPreviewResource: (resource: string) => void;
  setPreviewRevision: Dispatch<SetStateAction<number>>;
  resolvePreviewResource: (resource: string) => Promise<string>;
  defaultBoundaryUri: string;
  uploadResource: (resource: string, fileName?: string) => Promise<string>;
  emitValue: (url: string) => void;
  updateStatus: UpdateStatus;
  logger?: (...args: unknown[]) => void;
}

const NO_FILE_ERROR_KEY = 'taskrouter.upload.error.noFile';
const LOCAL_UNAVAILABLE_KEY = 'taskrouter.upload.error.localUnavailable';

export const useManualUploadHandlers = ({
  t,
  imageMaskActions,
  pendingManualFileRef,
  diskFileHandleRef,
  setInitialState,
  setSourceMode,
  setLayerInfo,
  setMaskResource,
  setBoundaryUri,
  setDiskFileResource,
  setResultSnapshotResource,
  setPreviewResource,
  setPreviewRevision,
  resolvePreviewResource,
  defaultBoundaryUri,
  uploadResource,
  emitValue,
  updateStatus,
  logger,
}: ManualUploadDeps) => {
  const applyManualResource = useCallback(
    async (resource: string, handle: ResourceHandle | null, fileName?: string) => {
      setSourceMode('file', { manual: true });
      setLayerInfo(null);
      setMaskResource('', null);
      setBoundaryUri(defaultBoundaryUri);
      setDiskFileResource(resource, handle ?? undefined);
      setResultSnapshotResource(resource, handle ?? null);
      diskFileHandleRef.current = handle ?? null;
      const preview = await resolvePreviewResource(resource);
      setPreviewResource(preview);
      setPreviewRevision(prev => prev + 1);
      const uploaded = await uploadResource(resource, fileName);
      emitValue(uploaded);
    },
    [
      defaultBoundaryUri,
      diskFileHandleRef,
      emitValue,
      uploadResource,
      setBoundaryUri,
      setDiskFileResource,
      setLayerInfo,
      resolvePreviewResource,
      setMaskResource,
      setPreviewResource,
      setPreviewRevision,
      setResultSnapshotResource,
      setSourceMode,
    ],
  );

  const handleSelectLocal = useCallback(async () => {
    const createFromLocal = imageMaskActions['resource.file.createFromLocal'];
    if (typeof createFromLocal !== 'function') {
      updateStatus(
        'error',
        t(LOCAL_UNAVAILABLE_KEY, { defaultValue: '当前环境不支持本地上传' }),
      );
      return;
    }

    const previousPending = pendingManualFileRef.current;
    pendingManualFileRef.current = true;

    let tempHandle: ResourceHandle | null = null;
    try {
      const result = await createFromLocal();
      const record = getSuccessfulMaterializeRecord(result);
      const resource = record?.resource ? record.resource.trim() : '';
      tempHandle = record?.handle ?? null;
      if (!resource) {
        resetHandle(tempHandle);
        pendingManualFileRef.current = previousPending;
        updateStatus(
          'error',
          t(NO_FILE_ERROR_KEY, { defaultValue: '未选择有效图片' }),
        );
        return;
      }
      // 🎯 修复：只有在成功获取文件资源后才设置 initialState 为 false
      setInitialState(false);
      const recordMeta = record as Record<string, any> | undefined;
      const fileName =
        typeof recordMeta?.meta?.fileName === 'string'
          ? String(recordMeta.meta.fileName)
          : typeof record?.nativePath === 'string' && record.nativePath
          ? record.nativePath.split(/[\\/]/).pop()
          : undefined;
      await applyManualResource(resource, tempHandle, fileName);
      tempHandle = null;
      logger?.('taskrouter:upload-selector local file success', resource);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateStatus('error', message);
      logger?.('taskrouter:upload-selector local file failed', message);
    } finally {
      pendingManualFileRef.current = previousPending;
      resetHandle(tempHandle);
    }
  }, [
    applyManualResource,
    imageMaskActions,
    logger,
    pendingManualFileRef,
    setInitialState,
    t,
    updateStatus,
  ]);

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const [file] = files;
      if (!file || !isImageFile(file)) return;

      const createFromBuffer = imageMaskActions['resource.file.createFromBuffer'];
      if (typeof createFromBuffer !== 'function') {
        updateStatus(
          'error',
          t(LOCAL_UNAVAILABLE_KEY, { defaultValue: '当前环境不支持本地上传' }),
        );
        return;
      }

      const previousPending = pendingManualFileRef.current;
      pendingManualFileRef.current = true;

      let tempHandle: ResourceHandle | null = null;
      try {
        const payload = await buildBufferPayloadFromFile(file);
        const result = await createFromBuffer({ files: [payload] });
        const record = getSuccessfulMaterializeRecord(result);
        const resource = record?.resource ? record.resource.trim() : '';
        tempHandle = record?.handle ?? null;
        if (!resource) {
          resetHandle(tempHandle);
          updateStatus(
            'error',
            t(NO_FILE_ERROR_KEY, { defaultValue: '未选择有效图片' }),
          );
          return;
        }
        // 🎯 修复：只有在成功获取文件资源后才设置 initialState 为 false
        setInitialState(false);
        const recordMeta = record as Record<string, any> | undefined;
        const fileName =
          typeof recordMeta?.meta?.fileName === 'string'
            ? String(recordMeta.meta.fileName)
            : typeof record?.nativePath === 'string' && record.nativePath
            ? record.nativePath.split(/[\\/]/).pop()
            : file.name;
        await applyManualResource(resource, tempHandle, fileName);
        tempHandle = null;
        logger?.('taskrouter:upload-selector drop file success', resource);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        updateStatus('error', message);
        logger?.('taskrouter:upload-selector drop file failed', message);
      } finally {
        pendingManualFileRef.current = previousPending;
        resetHandle(tempHandle);
      }
    },
    [
      applyManualResource,
      imageMaskActions,
      logger,
      pendingManualFileRef,
      setInitialState,
      t,
      updateStatus,
    ],
  );

  return {
    handleSelectLocal,
    handleDroppedFiles,
  };
};
