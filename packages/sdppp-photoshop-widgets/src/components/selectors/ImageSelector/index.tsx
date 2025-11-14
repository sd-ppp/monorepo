import { Flex, theme } from 'antd';
import { FileUp, Layers, Layers2, Scroll } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { useWidgetText } from '../../../context/WidgetImageMaskContext';
import { UploadIndicator } from '../../shared/UploadIndicator';
import { ActionButtons } from './ActionButtons';
import { AutoSyncColumn } from './AutoSyncColumn';
import { PreviewPanel } from './PreviewPanel';
import { SECTION_SIZE } from './constants';
import { useImageSelectorComputed } from './hooks/useImageSelectorComputed';
import { useImageSelectorState } from './hooks/useImageSelectorState';
import { useImageUploadWorkflow } from './hooks/useImageUploadWorkflow';
import type { ImageSelectorProps, ModeButtonDescriptor, SourceMode } from './types';
import { useFileDropZone } from '../../../hooks/useFileDropZone';
import {
  buildBufferPayloadFromFile,
  getSuccessfulMaterializeRecord,
  isImageFile,
} from '../../../utils/fileUtils';
import { withAlpha } from '../../../utils/color';

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  widgetableId,
  value = [],
  showActionButtons = true,
  workBoundary,
  onValueChange,
  showUploadIndicator = true,
  defaultAuto = true,
  externalErrorDismissSignal,
  onUploadStateChange,
}) => {
  const t = useWidgetText();
  const { token } = theme.useToken();
  const dropOverlayBackground = useMemo(() => withAlpha(token.colorPrimary, 0.12), [token.colorPrimary]);
  const dropOverlayBorder = useMemo(() => withAlpha(token.colorPrimary, 0.55), [token.colorPrimary]);
  const dropOverlayText = token.colorText;

  const state = useImageSelectorState({ value, defaultAuto, workBoundary });
  const computed = useImageSelectorComputed({
    state,
    translate: t,
    value,
    workBoundary,
  });
  const upload = useImageUploadWorkflow({
    state,
    onValueChange,
    onUploadStateChange,
    externalErrorDismissSignal,
  });

  const {
    gearHoverTimeoutRef,
    setIsGearButtonHovered,
    setIsStatusBarHovered,
    isStatusBarVisible,
    sourceMode,
    applyAuto,
    setSourceMode,
    setContentUri,
    setLayerInfo,
    pendingManualFileRef,
    imageMaskActions,
    logger,
  } = state;

  const {
    autoButtonIcon,
    syncButtonIcon,
    cutLabel,
    scanLabel,
    cutTooltipText,
    scanTooltipText,
    renderTooltipLines,
    shouldShowFallbackActionButton,
    displayUrl,
    debugDetails,
    statusCurrentLabel,
  } = computed;

  const {
    uploadError,
    uploadProgress,
    uploadStatus,
    handleDismissError,
    sync,
    handleResourceUpload,
    handleAutoToggle,
    handleMaskRebuildWithSync,
    handleBoundaryNormalizeWithSync,
    handleSourceModeChange,
  } = upload;

  const handleSyncHoverStart = useCallback(() => {
    if (gearHoverTimeoutRef.current) {
      clearTimeout(gearHoverTimeoutRef.current);
      gearHoverTimeoutRef.current = null;
    }
    setIsGearButtonHovered(true);
  }, [gearHoverTimeoutRef, setIsGearButtonHovered]);

  const handleSyncHoverEnd = useCallback(() => {
    if (gearHoverTimeoutRef.current) {
      clearTimeout(gearHoverTimeoutRef.current);
    }
    gearHoverTimeoutRef.current = setTimeout(() => {
      setIsGearButtonHovered(false);
      gearHoverTimeoutRef.current = null;
    }, 250);
  }, [gearHoverTimeoutRef, setIsGearButtonHovered]);

  const handleStatusBarHoverChange = useCallback(
    (hovered: boolean) => {
      setIsStatusBarHovered(hovered);
    },
    [setIsStatusBarHovered],
  );

  const handleFallback = useCallback(async () => {
    const resource = await sync({});
    await handleResourceUpload(resource);
  }, [handleResourceUpload, sync]);

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const [file] = files;
      if (!file || !isImageFile(file)) {
        return;
      }
      const createFromBuffer = imageMaskActions['resource.file.createFromBuffer'];
      if (typeof createFromBuffer !== 'function') {
        logger(
          'ImageSelector createFromBuffer unavailable',
          JSON.stringify({ reason: 'handler_missing' }),
        );
        return;
      }
      const previousPendingManual = pendingManualFileRef.current;
      pendingManualFileRef.current = true;
      try {
        const payload = await buildBufferPayloadFromFile(file);
        const result = await createFromBuffer({ files: [payload] });
        const record = getSuccessfulMaterializeRecord(result);
        const resource = record?.resource ? record.resource.trim() : '';
        logger(
          'ImageSelector createFromBuffer result',
          JSON.stringify({
            resource,
            error: record?.error ?? (result as any)?.error ?? null,
            width: record?.width ?? null,
            height: record?.height ?? null,
            mime: record?.mime ?? null,
          }),
        );
        if (!resource) {
          pendingManualFileRef.current = previousPendingManual;
          return;
        }
        applyAuto(false, { manual: true });
        const success = await handleResourceUpload(resource);
        if (success) {
          setLayerInfo(null);
          setContentUri('');
          setSourceMode('file', { manual: true });
        } else {
          pendingManualFileRef.current = previousPendingManual;
        }
      } catch (error) {
        pendingManualFileRef.current = previousPendingManual;
        logger(
          'ImageSelector drop upload error',
          JSON.stringify({
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }),
        );
      }
    },
    [
      applyAuto,
      handleResourceUpload,
      imageMaskActions,
      logger,
      pendingManualFileRef,
      setContentUri,
      setLayerInfo,
      setSourceMode,
    ],
  );

  const modeButtons: ModeButtonDescriptor[] = useMemo(
    () => [
      {
        mode: 'file',
        icon: FileUp,
        activeIcon: FileUp,
        tooltip: t('image.upload.source.file.tooltip', {
          defaultValue: '磁盘上传',
        }),
      },
      {
        mode: 'layer',
        icon: Layers,
        activeIcon: Layers2,
        tooltip: t('image.upload.source.layer.tooltip', {
          defaultValue: '以图层选择',
        }),
      },
      {
        mode: 'canvas',
        icon: Scroll,
        activeIcon: Scroll,
        tooltip: t('image.upload.source.canvas.tooltip', {
          defaultValue: '以画布选择',
        }),
      },
    ],
    [t],
  );

  const handleModeChange = useCallback(
    (mode: SourceMode) => {
      void handleSourceModeChange(mode);
    },
    [handleSourceModeChange],
  );

  const dropHint = t('image.upload.dropHint', {
    defaultValue: '拖拽图片到此区域释放以上传',
  });

  const { isDragging, handlers: dropHandlers } = useFileDropZone({
    onDropFiles: files => {
      void handleDroppedFiles(files);
    },
    accept: isImageFile,
    multiple: false,
  });

  return (
    <Flex vertical style={{ width: '100%' }} gap={8}>
      <Flex
        style={{
          width: '100%',
          minHeight: SECTION_SIZE,
          height: SECTION_SIZE,
          border: '1px solid var(--sdppp-widget-border-color)',
          borderRadius: 6,
          position: 'relative',
        }}
        align="stretch"
        gap={0}
        {...dropHandlers}
      >
        {isDragging ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: dropOverlayBackground,
              border: `2px dashed ${dropOverlayBorder}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: dropOverlayText,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 0.5,
              pointerEvents: 'none',
              backdropFilter: 'blur(1px)',
              zIndex: 5,
              textAlign: 'center',
              padding: '0 24px',
            }}
          >
            {dropHint}
          </div>
        ) : null}
        <AutoSyncColumn
          widgetableId={widgetableId}
          autoButtonIcon={autoButtonIcon}
          syncButtonIcon={syncButtonIcon}
          onAutoToggle={handleAutoToggle}
          onSyncHoverStart={handleSyncHoverStart}
          onSyncHoverEnd={handleSyncHoverEnd}
        />
        <PreviewPanel
          widgetableId={widgetableId}
          displayUrl={displayUrl}
          debugDetails={debugDetails}
          isStatusBarVisible={isStatusBarVisible}
          onStatusBarHoverChange={handleStatusBarHoverChange}
          modeButtons={modeButtons}
          activeMode={sourceMode}
          onModeChange={handleModeChange}
          statusCurrentLabel={statusCurrentLabel}
        />
        {showActionButtons ? (
          <ActionButtons
            shouldShowFallbackActionButton={shouldShowFallbackActionButton}
            cutLabel={cutLabel}
            scanLabel={scanLabel}
            cutTooltipText={cutTooltipText}
            scanTooltipText={scanTooltipText}
            renderTooltipLines={renderTooltipLines}
            onFallback={handleFallback}
            onCut={() => {
              void handleMaskRebuildWithSync();
            }}
            onScan={() => {
              void handleBoundaryNormalizeWithSync();
            }}
          />
        ) : null}
      </Flex>
      {showUploadIndicator ? (
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
      ) : null}
    </Flex>
  );
};
