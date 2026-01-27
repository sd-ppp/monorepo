import { theme } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useWidgetText, useWidgetLogger, useSdpppWidgetUpload } from '../../context/SdpppWidgetContext';
import { useFileDropZone } from '../../hooks/useFileDropZone';
import { isImageFile } from '../../utils/fileUtils';
import { withAlpha } from '../../utils/color';
import { useImageSelectorState } from '../ImageSelector/hooks/useImageSelectorState';
import { useImageSelectorComputed } from '../ImageSelector/hooks/useImageSelectorComputed';
import {
  SdpppWidgetUploadSelectorPresentation,
  type SdpppWidgetUploadSelectorPresentationProps,
} from './SdpppWidgetUploadSelectorPresentation';
import { useSdpppWidgetUploadStatus } from './hooks/useSdpppWidgetUploadStatus';
import { useManualUploadHandlers } from './hooks/useManualUploadHandlers';
import { useCanvasSnapshotFetcher } from './hooks/useCanvasSnapshotFetcher';
import { useBoundaryAndPreviewActions } from './hooks/useBoundaryAndPreviewActions';
import { DEFAULT_PROGRESS, IDLE_PROGRESS } from './utils';
import type { SdpppWidgetUploadSelectorProps } from './types';

export const SdpppWidgetUploadSelector: React.FC<SdpppWidgetUploadSelectorProps> = ({
  widgetableId = 'sdppp-widget-upload',
  value = [],
  onChange,
  workBoundary,
  onValueChange,
  externalErrorDismissSignal,
  onUploadStateChange,
}) => {
  const t = useWidgetText();
  const logger = useWidgetLogger();
  const { token } = theme.useToken();
  const uploadResource = useSdpppWidgetUpload();

  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewResource, setPreviewResource] = useState<string>('');

  const state = useImageSelectorState({
    value,
    defaultAuto: false,
    workBoundary,
  });

  const {
    setContentUri,
    boundaryUri,
    setBoundaryUri,
    setMaskResource,
    setResultSnapshotResource,
    clearResultSnapshot,
    setDiskFileResource,
    setLayerInfo,
    setSourceMode,
    setInitialState,
    selectionBoundary,
    hasSelectionBoundary,
    imageMaskActions,
    pendingManualFileRef,
    lastKnownValueRef,
    curDocId,
    workBoundary: normalizedWorkBoundary,
    diskFileHandleRef,
  } = state;

  const computed = useImageSelectorComputed({
    state,
    translate: t,
    value,
    workBoundary,
    previewRevision,
  });

  const { displayUrl, overlayDisplayUrl, statusCurrentLabel } = computed;

  const defaultBoundaryUri = useMemo(() => (normalizedWorkBoundary ?? '').trim(), [normalizedWorkBoundary]);
  const documentIdForSelection = useMemo(() => {
    if (curDocId === undefined || curDocId === null) return undefined;
    if (curDocId < 0) return undefined;
    return curDocId;
  }, [curDocId]);

  useEffect(() => {
    logger?.('taskrouter:upload-selector document-id', {
      rawCurDocId: curDocId,
      normalizedDocumentId: documentIdForSelection,
    });
  }, [curDocId, documentIdForSelection, logger]);

  const effectivePreviewUrl = (displayUrl ?? '').trim() || (previewResource ?? '').trim();
  const hasPreview = Boolean(effectivePreviewUrl);

  const dropOverlayBackground = useMemo(
    () => withAlpha(token.colorPrimary, 0.12),
    [token.colorPrimary],
  );
  const dropOverlayBorder = useMemo(
    () => withAlpha(token.colorPrimary, 0.55),
    [token.colorPrimary],
  );
  const dropOverlayText = token.colorText;

  const { status, statusMessage, updateStatus, handleExternalDismiss } = useSdpppWidgetUploadStatus({
    onUploadStateChange,
  });

  const emitValue = useCallback(
    (url: string) => {
      const normalized = url.trim();
      lastKnownValueRef.current = normalized;
      const payload = normalized ? [normalized] : [''];
      onValueChange?.(payload);
      onChange?.(payload);
    },
    [lastKnownValueRef, onChange, onValueChange],
  );

  const resolvePreviewResource = useCallback(
    async (resource: string) => {
      const action = imageMaskActions['resource.thumbnail'];
      if (typeof action !== 'function') {
        return resource;
      }
      try {
        const result = await action({ resource, maxSize: 512 });
        const thumbnail = typeof result?.thumbnail === 'string' ? result.thumbnail.trim() : '';
        return thumbnail || resource;
      } catch (error) {
        logger?.('taskrouter:upload-selector thumbnail failed', String(error));
        return resource;
      }
    },
    [imageMaskActions, logger],
  );

  const performUpload = useCallback(
    async (resourceId: string, fileName?: string) => {
      const normalized = resourceId.trim();
      if (!normalized) {
        throw new Error(t('taskrouter.upload.error.noResource', { defaultValue: '未找到可上传的资源' }));
      }
      updateStatus(
        'uploading',
        t('taskrouter.upload.uploading', { defaultValue: '上传中...' }),
        DEFAULT_PROGRESS,
      );
      try {
        const uploaded = await uploadResource(normalized, { fileName });
        if (!uploaded || !uploaded.trim()) {
          const emptyMessage = t('taskrouter.upload.error.empty', { defaultValue: '上传结果为空' });
          updateStatus('error', emptyMessage, IDLE_PROGRESS);
          throw new Error(emptyMessage);
        }
        updateStatus('idle', null, IDLE_PROGRESS);
        return uploaded;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : t('taskrouter.upload.error.unknown', { defaultValue: '上传失败' });
        updateStatus('error', message, IDLE_PROGRESS);
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    [t, updateStatus, uploadResource],
  );

  const { handleSelectLocal, handleDroppedFiles } = useManualUploadHandlers({
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
    uploadResource: performUpload,
    emitValue,
    updateStatus,
    logger,
  });

  const { handleFetchFromCanvas } = useCanvasSnapshotFetcher({
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
    uploadResource: performUpload,
    emitValue,
    updateStatus,
  });

  const { handleClear, handlePreviewClick } = useBoundaryAndPreviewActions({
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
  });

  useEffect(() => {
    handleExternalDismiss(externalErrorDismissSignal);
  }, [externalErrorDismissSignal, handleExternalDismiss]);

  const { isDragging, handlers: dropHandlers } = useFileDropZone({
    onDropFiles: droppedFiles => {
      void handleDroppedFiles(droppedFiles);
    },
    accept: isImageFile,
    multiple: false,
  });

  const dropHint = t('image.upload.dropHint', {
    defaultValue: '拖放图片到此处以上传',
  });

  const presentationProps: SdpppWidgetUploadSelectorPresentationProps = {
    widgetableId,
    dropHint,
    isDragging,
    dropHandlers,
    dropOverlayBackground,
    dropOverlayBorder,
    dropOverlayText,
    previewUrl: effectivePreviewUrl,
    overlayUrl: overlayDisplayUrl,
    hasPreview,
    onPreviewClick: handlePreviewClick,
    placeholderLabel: t('taskrouter.upload.placeholder', { defaultValue: '暂无预览' }),
    onClear: handleClear,
    clearTooltip: t('taskrouter.upload.action.clear', { defaultValue: '清除已选图片' }),
    onFetchCanvas: handleFetchFromCanvas,
    fetchCanvasTooltip: t('taskrouter.upload.action.fromCanvas', { defaultValue: '从画布获取' }),
    onSelectLocal: handleSelectLocal,
    selectLocalTooltip: t('taskrouter.upload.action.fromLocal', { defaultValue: '选择本地图片' }),
    status,
    statusMessage,
    statusLabel: t('taskrouter.upload.status.currentMode', {
      defaultValue: '当前来源：{{label}}',
      label: statusCurrentLabel,
    }),
    onStatusDismiss: () => updateStatus('idle', null, IDLE_PROGRESS),
  };

  return <SdpppWidgetUploadSelectorPresentation {...presentationProps} />;
};

SdpppWidgetUploadSelector.displayName = 'SdpppWidgetUploadSelector';
