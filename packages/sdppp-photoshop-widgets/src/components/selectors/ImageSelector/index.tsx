import { Button, Flex, Tag, theme } from 'antd';
import { FileUp, Layers, Layers2, Scroll } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useWidgetText, useBoundaryHoverHandler, useWidgetLogger } from '../../../context/PhotoshopWidgetContext';
import { useFileDropZone } from '../../../hooks/useFileDropZone';
import type { ResourceHandle } from '../../../context/PhotoshopWidgetContext';
import {
  buildBufferPayloadFromFile,
  getSuccessfulMaterializeRecord,
  isImageFile,
} from '../../../utils/fileUtils';
import { withAlpha } from '../../../utils/color';
import { ActionButtons } from './ActionButtons';
import { AutoSyncColumn } from './AutoSyncColumn';
import { PreviewPanelPresentation } from './PreviewPanelPresentation';
import { ACTION_BUTTON_MARGIN, ACTION_BUTTON_SIZE, SECTION_SIZE } from './constants';
import { useImageSelectorComputed } from './hooks/useImageSelectorComputed';
import { useImageSelectorState } from './hooks/useImageSelectorState';
import { useImageUploadWorkflow } from './hooks/useImageUploadWorkflow';
import { parseBoundaryRectFromUri } from './utils';
import type { ImageSelectorProps, ModeButtonDescriptor, SourceMode } from './types';

export const ImageSelector: React.FC<ImageSelectorProps> = ({
  widgetableId,
  value = [],
  showActionButtons = true,
  workBoundary,
  onValueChange,
  defaultAuto = true,
  externalErrorDismissSignal,
  onUploadStateChange,
}) => {
  const t = useWidgetText();
  const logger = useWidgetLogger();
  const { token } = theme.useToken();
  const dropOverlayBackground = useMemo(
    () => withAlpha(token.colorPrimary, 0.12),
    [token.colorPrimary],
  );
  const dropOverlayBorder = useMemo(
    () => withAlpha(token.colorPrimary, 0.55),
    [token.colorPrimary],
  );
  const dropOverlayText = token.colorText;

  const state = useImageSelectorState({ value, defaultAuto, workBoundary });
  const {
    auto,
    applyAuto,
    setSourceMode,
    setDiskFileResource,
    setMaskResource,
    setContentUri,
    setBoundaryUri,
    clearResultSnapshot,
    setLayerInfo,
    pendingManualFileRef,
    lastKnownValueRef,
    imageMaskActions,
    gearHoverTimeoutRef,
    setIsGearButtonHovered,
    setIsMaskButtonHovered,
    maskUri,
    boundaryUri,
    hasSelectionBoundary,
    sourceMode,
    curDocId,
    workBoundary: normalizedWorkBoundaryString,
    isMaskButtonHovered,
    isInitialState,
    setInitialState,
    selectionBoundary,
  } = state;

  const [hoverHelpMessage, setHoverHelpMessage] = useState('');
  const [isBoundaryButtonHovered, setIsBoundaryButtonHovered] = useState(false);
  const [isMaskStatusTagHovered, setIsMaskStatusTagHovered] = useState(false);
  const [isBoundaryStatusTagHovered, setIsBoundaryStatusTagHovered] = useState(false);
  const [modeHoverLabel, setModeHoverLabel] = useState<string | null>(null);
  const [isModeSelectionActive, setIsModeSelectionActive] = useState(false);
  const [isPreviewCleared, setIsPreviewCleared] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const boundaryHoverHandler = useBoundaryHoverHandler();
  const isBoundaryHoverActive = isBoundaryButtonHovered || isBoundaryStatusTagHovered;
  const markInitialized = useCallback(() => {
    setInitialState(false);
  }, [setInitialState]);

  const handleBoundaryStatusHoverStart = useCallback(() => {
    setIsBoundaryStatusTagHovered(true);
  }, []);

  const handleBoundaryStatusHoverEnd = useCallback(() => {
    setIsBoundaryStatusTagHovered(false);
  }, []);

  const computed = useImageSelectorComputed({
    state,
    translate: t,
    value,
    workBoundary,
    previewRevision,
  });
  const {
    autoButtonIcon,
    syncButtonIcon,
    cutLabel,
    scanLabel,
    cutTooltipText,
    scanTooltipText,
    autoButtonTooltipText,
    manualSyncTooltipText,
    autoStatusLabel,
    statusCurrentLabel,
    displayUrl,
    overlayDisplayUrl,
    debugDetails,
  } = computed;

  const upload = useImageUploadWorkflow({
    state,
    onValueChange,
    onUploadStateChange,
    externalErrorDismissSignal,
    onPreviewInvalidate: () => {
      setPreviewRevision(prev => prev + 1);
    },
  });
  const {
    indicatorStatus,
    uploadingMessage,
    handleSync,
    handleResourceUpload,
    handleAutoToggle,
    handleMaskRebuildWithSync,
    handleBoundaryNormalizeWithSync,
    handleSourceModeChange,
  } = upload;

  const hasCustomMask = useMemo(() => Boolean((maskUri ?? '').trim()), [maskUri]);
  const defaultBoundaryForMode = useMemo(
    () => (normalizedWorkBoundaryString ?? '').trim(),
    [normalizedWorkBoundaryString],
  );

  const boundaryComparison = useMemo(() => {
    const activeBoundary = (boundaryUri ?? '').trim();
    const defaultBoundary = defaultBoundaryForMode;
    if (!defaultBoundary) {
      return {
        hasCustom: Boolean(activeBoundary),
        docMismatchOnly: false,
        activeBoundary,
        defaultBoundary,
      };
    }
    if (activeBoundary === defaultBoundary) {
      return {
        hasCustom: false,
        docMismatchOnly: false,
        activeBoundary,
        defaultBoundary,
      };
    }
    const parseBoundaryComponents = (uri: string) => {
      const match = /^uxp:\/\/boundary\/(\d+)(\/?.*)$/i.exec(uri);
      if (!match) {
        return { docId: null, remainder: uri ?? '' };
      }
      const [, docIdRaw, remainder] = match;
      const parsedId = Number(docIdRaw);
      return {
        docId: Number.isFinite(parsedId) ? parsedId : null,
        remainder: remainder ?? '',
      };
    };
    const activeComponents = parseBoundaryComponents(activeBoundary);
    const defaultComponents = parseBoundaryComponents(defaultBoundary);
    const docMismatchOnly =
      activeComponents.remainder === defaultComponents.remainder &&
      activeComponents.docId !== null &&
      defaultComponents.docId !== null &&
      activeComponents.docId !== defaultComponents.docId;
    return {
      hasCustom: true,
      docMismatchOnly,
      activeBoundary,
      defaultBoundary,
    };
  }, [boundaryUri, defaultBoundaryForMode]);

  const hasCustomBoundary = boundaryComparison.hasCustom;
  const isBoundaryDocMismatchOnly = boundaryComparison.docMismatchOnly;

  useEffect(() => {
    const activeBoundary = (boundaryUri ?? '').trim();
    const defaultBoundary = defaultBoundaryForMode;
    logger?.(
      'widgets:image-selector boundary status',
      `active=${activeBoundary || '-'}`,
      `default=${defaultBoundary || '-'}`,
      `hasCustom=${hasCustomBoundary ? 'true' : 'false'}`,
      `docMismatchOnly=${isBoundaryDocMismatchOnly ? 'true' : 'false'}`,
    );
  }, [boundaryUri, defaultBoundaryForMode, hasCustomBoundary, isBoundaryDocMismatchOnly, logger]);

  useEffect(() => {
    if (!hasCustomBoundary) {
      setIsBoundaryStatusTagHovered(false);
    }
  }, [hasCustomBoundary]);

  const resolveBoundaryHoverRect = useCallback(() => {
    const normalizedBoundary = (boundaryUri ?? '').trim();
    const fallbackBoundary = normalizedBoundary || (defaultBoundaryForMode ?? '').trim();
    if (fallbackBoundary) {
      const parsed = parseBoundaryRectFromUri(fallbackBoundary);
      if (parsed) {
        return parsed;
      }
      if (/\/selection(?:\/|\?|$)/.test(fallbackBoundary) && selectionBoundary) {
        return selectionBoundary;
      }
    }
    return null;
  }, [boundaryUri, defaultBoundaryForMode, selectionBoundary]);

  useEffect(() => {
    if (!isBoundaryHoverActive) {
      boundaryHoverHandler(null);
      return;
    }
    const rect = resolveBoundaryHoverRect();
    boundaryHoverHandler(rect);
    return () => {
      boundaryHoverHandler(null);
    };
  }, [isBoundaryHoverActive, resolveBoundaryHoverRect, boundaryHoverHandler]);

  const handleResetMask = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      event?.preventDefault();
      setMaskResource('', null);
      setIsMaskButtonHovered(false);
      setIsMaskStatusTagHovered(false);
      setHoverHelpMessage('');
      void handleSync({ maskUri: null });
    },
    [handleSync, setMaskResource, setIsMaskButtonHovered, setIsMaskStatusTagHovered, setHoverHelpMessage],
  );

  const handleResetBoundary = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      event?.preventDefault();
      const defaultBoundary = defaultBoundaryForMode;
      setBoundaryUri(defaultBoundary);
      setHoverHelpMessage('');
      setIsBoundaryButtonHovered(false);
      void handleSync({ boundaryUri: defaultBoundary || null });
    },
    [handleSync, defaultBoundaryForMode, setBoundaryUri, setHoverHelpMessage, setIsBoundaryButtonHovered],
  );

  useEffect(() => {
    if (!isPreviewCleared) {
      return;
    }
    const hasValue = ((value?.[0] ?? '').trim().length > 0);
    if (hasValue || sourceMode !== 'file') {
      setIsPreviewCleared(false);
    }
  }, [isPreviewCleared, sourceMode, value]);

  const getModeLabel = useCallback(
    (mode: SourceMode) => {
      switch (mode) {
        case 'file':
          return t('image.upload.mode.file.label', { defaultValue: '文件' });
        case 'layer':
          return t('image.upload.mode.layer.label', { defaultValue: '图层' });
        case 'canvas':
        default:
          return t('image.upload.mode.canvas.label', { defaultValue: '画布' });
      }
    },
    [t],
  );

  const isUploading = indicatorStatus === 'uploading';
  const resolvedUploadingStatusMessage = isUploading
    ? uploadingMessage ?? t('image.upload.uploading', { defaultValue: '上传中，如果图片过大，可能会卡顿...' })
    : null;

  const shouldShowAutoTag = sourceMode !== 'file' && auto;
  const statusBarLeftLabel = shouldShowAutoTag ? '\u00A0' : '';
  const currentModeLabel = modeHoverLabel ?? statusCurrentLabel;
  const shouldShowFileTag = sourceMode === 'file';
  const fileTagLabel = t('image.upload.status.file.active', { defaultValue: '正使用本地文件' });

  const shouldShowStatusTags =
    !resolvedUploadingStatusMessage &&
    sourceMode !== 'file' &&
    (!isMaskButtonHovered || isMaskStatusTagHovered) &&
    !isBoundaryButtonHovered &&
    !isModeSelectionActive;

  useEffect(() => {
    if (!shouldShowStatusTags) {
      setIsBoundaryStatusTagHovered(false);
    }
  }, [shouldShowStatusTags]);

  const handleMaskHoverStart = useCallback(() => {
    setIsMaskButtonHovered(true);
  }, [setIsMaskButtonHovered]);

  const handleMaskHoverEnd = useCallback(() => {
    setIsMaskButtonHovered(false);
  }, [setIsMaskButtonHovered]);

  const handleBoundaryHoverStart = useCallback(() => {
    setIsBoundaryButtonHovered(true);
  }, [setIsBoundaryButtonHovered]);

  const handleBoundaryHoverEnd = useCallback(() => {
    setIsBoundaryButtonHovered(false);
  }, [setIsBoundaryButtonHovered]);

  const clearHoverTimeout = useCallback(() => {
    if (gearHoverTimeoutRef.current) {
      clearTimeout(gearHoverTimeoutRef.current);
      gearHoverTimeoutRef.current = null;
    }
  }, [gearHoverTimeoutRef]);

  const scheduleHoverTimeout = useCallback(() => {
    clearHoverTimeout();
    gearHoverTimeoutRef.current = setTimeout(() => {
      setIsGearButtonHovered(false);
      setIsModeSelectionActive(false);
      setModeHoverLabel(null);
      gearHoverTimeoutRef.current = null;
    }, 400);
  }, [clearHoverTimeout, setIsGearButtonHovered, setIsModeSelectionActive, setModeHoverLabel]);

  const handleSyncHoverStart = useCallback(() => {
    clearHoverTimeout();
    setIsGearButtonHovered(true);
    setIsModeSelectionActive(true);
  }, [clearHoverTimeout, setIsGearButtonHovered, setIsModeSelectionActive]);

  const handleSyncHoverEnd = useCallback(() => {
    scheduleHoverTimeout();
  }, [scheduleHoverTimeout]);

  const handleModeSelectionAreaEnter = useCallback(() => {
    clearHoverTimeout();
    setIsGearButtonHovered(true);
    setIsModeSelectionActive(true);
  }, [clearHoverTimeout, setIsGearButtonHovered, setIsModeSelectionActive]);

  const handleModeSelectionAreaLeave = useCallback(() => {
    scheduleHoverTimeout();
  }, [scheduleHoverTimeout]);

  const handleModeIconHoverStart = useCallback(
    (mode: SourceMode) => {
      setModeHoverLabel(getModeLabel(mode));
    },
    [getModeLabel],
  );

  const handleModeIconHoverEnd = useCallback(() => {
    setModeHoverLabel(null);
  }, []);

  const modeButtons: ModeButtonDescriptor[] = useMemo(
    () => [
      {
        mode: 'file',
        icon: FileUp,
        activeIcon: FileUp,
        tooltip: t('image.upload.source.file.tooltip', {
          defaultValue: 'Upload from disk',
        }),
      },
      {
        mode: 'layer',
        icon: Layers,
        activeIcon: Layers2,
        tooltip: t('image.upload.source.layer.tooltip', {
          defaultValue: 'Use current layer',
        }),
      },
      {
        mode: 'canvas',
        icon: Scroll,
        activeIcon: Scroll,
        tooltip: t('image.upload.source.canvas.tooltip', {
          defaultValue: 'Use entire canvas',
        }),
      },
    ],
    [t],
  );

  const handleModeChange = useCallback(
    (mode: SourceMode) => {
      clearHoverTimeout();
      setIsGearButtonHovered(false);
      setIsModeSelectionActive(false);
      setModeHoverLabel(null);
      void handleSourceModeChange(mode);
    },
    [clearHoverTimeout, handleSourceModeChange, setIsGearButtonHovered, setIsModeSelectionActive, setModeHoverLabel],
  );

  const handleDroppedFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const [file] = files;
      if (!file || !isImageFile(file)) {
        return;
      }
      const createFromBuffer = imageMaskActions['resource.file.createFromBuffer'];
      if (typeof createFromBuffer !== 'function') {
        return;
      }
      const previousPendingManual = pendingManualFileRef.current;
      pendingManualFileRef.current = true;
      let tempHandle: ResourceHandle | null = null;
      try {
        const payload = await buildBufferPayloadFromFile(file);
        const result = await createFromBuffer({ files: [payload] });
        const record = getSuccessfulMaterializeRecord(result);
        const resource = record?.resource ? record.resource.trim() : '';
        tempHandle = record?.handle ?? null;
        if (!resource) {
          tempHandle?.dispose();
          tempHandle = null;
          pendingManualFileRef.current = previousPendingManual;
          return;
        }
        applyAuto(false, { manual: true });
        const success = await handleResourceUpload({
          resource,
          handle: tempHandle ?? undefined,
        });
        if (success) {
          tempHandle = null;
          setLayerInfo(null);
          setSourceMode('file', { manual: true });
          markInitialized();
          pendingManualFileRef.current = previousPendingManual;
        } else {
          tempHandle?.dispose();
          tempHandle = null;
          pendingManualFileRef.current = previousPendingManual;
        }
      } catch (error) {
        pendingManualFileRef.current = previousPendingManual;
      } finally {
        if (tempHandle) {
          tempHandle.dispose();
          tempHandle = null;
        }
      }
    },
    [
      applyAuto,
      handleResourceUpload,
      imageMaskActions,
      pendingManualFileRef,
      setLayerInfo,
      setSourceMode,
      markInitialized,
    ],
  );

  const dropHint = t('image.upload.dropHint', {
    defaultValue: 'Drag images here and release to upload',
  });

  const clearButtonTooltipText = t('image.upload.tooltip.clear_action', {
    defaultValue: 'Clear selection',
  });

  const { isDragging, handlers: dropHandlers } = useFileDropZone({
    onDropFiles: files => {
      void handleDroppedFiles(files);
    },
    accept: isImageFile,
    multiple: false,
  });

  const handleClearSelection = useCallback(async () => {
    applyAuto(false, { manual: true });
    setDiskFileResource('', null);
    setMaskResource('', null);
    setContentUri('');
    setBoundaryUri(normalizedWorkBoundaryString);
    clearResultSnapshot();
    setLayerInfo(null);
    pendingManualFileRef.current = false;
    lastKnownValueRef.current = '';
    setIsPreviewCleared(true);
    onValueChange?.(['']);
    setInitialState(true);
    setPreviewRevision(prev => prev + 1);
  }, [
    applyAuto,
    setSourceMode,
    clearResultSnapshot,
    setInitialState,
    lastKnownValueRef,
    normalizedWorkBoundaryString,
    onValueChange,
    pendingManualFileRef,
    setBoundaryUri,
    setContentUri,
    setDiskFileResource,
    setLayerInfo,
    setMaskResource,
  ]);

  const handleFileTagReset = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      event?.preventDefault();
      if (sourceMode !== 'file') {
        return;
      }
      pendingManualFileRef.current = false;
      lastKnownValueRef.current = '';
      setDiskFileResource('', null);
      void handleSourceModeChange('canvas');
    },
    [
      handleSourceModeChange,
      lastKnownValueRef,
      pendingManualFileRef,
      setDiskFileResource,
      sourceMode,
    ],
  );

  const effectiveDisplayUrl = isPreviewCleared ? '' : displayUrl;
  const effectiveOverlayDisplayUrl = isPreviewCleared ? '' : overlayDisplayUrl;
  const actionAreaWidth = ACTION_BUTTON_SIZE + ACTION_BUTTON_MARGIN * 2;

  const renderActionArea = () => {
    if (!showActionButtons) {
      return null;
    }

    if (sourceMode === 'file') {
      return (
        <div
          style={{
            flex: '0 0 auto',
            width: actionAreaWidth,
            height: '100%',
          }}
        />
      );
    }

    if (hasSelectionBoundary) {
      return (
        <ActionButtons
          mode="selection"
          cutLabel={cutLabel}
          scanLabel={scanLabel}
          cutTooltipText={cutTooltipText}
          scanTooltipText={scanTooltipText}
          onCut={() => {
            void handleMaskRebuildWithSync();
          }}
          onScan={() => {
            void handleBoundaryNormalizeWithSync();
          }}
          onMaskHoverStart={handleMaskHoverStart}
          onMaskHoverEnd={handleMaskHoverEnd}
          onBoundaryHoverStart={handleBoundaryHoverStart}
          onBoundaryHoverEnd={handleBoundaryHoverEnd}
          onHelpHintChange={setHoverHelpMessage}
        />
      );
    }

    return (
      <ActionButtons
        mode="sync"
        auto={auto}
        autoButtonTooltip={autoButtonTooltipText}
        manualSyncTooltipText={manualSyncTooltipText}
        autoSyncIcon={autoButtonIcon}
        onManualSync={_event => {
          void handleSync();
        }}
        onAutoToggle={_event => {
          handleAutoToggle();
        }}
        onHelpHintChange={setHoverHelpMessage}
      />
    );
  };

  return (
    <Flex vertical style={{ width: '100%' }} gap={0}>
      <div
        style={{
          width: '100%',
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <Flex
          style={{
            width: '100%',
            minHeight: SECTION_SIZE,
            height: SECTION_SIZE,
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
            clearButtonTooltip={clearButtonTooltipText}
            syncButtonIcon={syncButtonIcon}
            onSyncHoverStart={handleSyncHoverStart}
            onSyncHoverEnd={handleSyncHoverEnd}
            onClear={() => {
              void handleClearSelection();
            }}
          />
          <PreviewPanelPresentation
            widgetableId={widgetableId}
            displayUrl={effectiveDisplayUrl}
            overlayDisplayUrl={effectiveOverlayDisplayUrl}
            overlayVisible={isMaskButtonHovered || isMaskStatusTagHovered}
            debugDetails={debugDetails}
          />
          {renderActionArea()}
        </Flex>
        <div
          style={{
            height: 28,
            borderTop: `1px solid ${token.colorBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            gap: 12,
            boxSizing: 'border-box',
            color: token.colorText,
            fontSize: 12,
            lineHeight: '28px',
          }}
        >
          {resolvedUploadingStatusMessage ? (
            <span
              style={{
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {resolvedUploadingStatusMessage}
            </span>
          ) : isModeSelectionActive ? (
            <>
              <div
                onMouseEnter={handleModeSelectionAreaEnter}
                onMouseLeave={handleModeSelectionAreaLeave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 6,
                  }}
                >
                  {modeButtons.map(({ mode, icon: InactiveIcon, activeIcon }) => {
                    const isActive = sourceMode === mode;
                    const IconComponent = isActive && activeIcon ? activeIcon : InactiveIcon;
                    const iconColor = isActive ? token.colorPrimary : token.colorText;
                    return (
                      <Button
                        key={mode}
                        type={isActive ? 'default' : 'text'}
                        shape="circle"
                        size="small"
                        onClick={() => handleModeChange(mode)}
                        onMouseEnter={() => handleModeIconHoverStart(mode)}
                        onMouseLeave={handleModeIconHoverEnd}
                        aria-pressed={isActive}
                        aria-label={getModeLabel(mode)}
                        title={getModeLabel(mode)}
                        style={{
                          width: 24,
                          height: 24,
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: iconColor,
                        }}
                        icon={<IconComponent size={14} strokeWidth={2} color={iconColor} />}
                      />
                    );
                  })}
                </div>
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    color: token.colorText,
                    textTransform: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentModeLabel}
                </span>
              </div>
              <div
                style={{ flex: '0 0 auto' }}
                onMouseEnter={handleModeSelectionAreaEnter}
                onMouseLeave={handleModeSelectionAreaLeave}
              />
            </>
          ) : (
            <>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {shouldShowFileTag ? (
                  <Tag
                    closable
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={handleFileTagReset}
                    onClose={handleFileTagReset}
                    title={t('image.upload.status.file.resetHint', {
                      defaultValue: '点击移除本地文件',
                    })}
                  >
                    {fileTagLabel}
                  </Tag>
                ) : null}
                {shouldShowAutoTag ? (
                  <Tag
                    closable
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => {
                      handleAutoToggle();
                    }}
                    onClose={event => {
                      event.preventDefault();
                      handleAutoToggle();
                    }}
                    title={t('image.upload.status.auto.resetHint', {
                      defaultValue: '点击退出自动同步模式',
                    })}
                  >
                    {autoStatusLabel}
                  </Tag>
                ) : null}
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {statusBarLeftLabel || (shouldShowFileTag ? '' : '\u00A0')}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {shouldShowStatusTags ? (
                  <>
                    {hasCustomMask ? (
                      <Tag
                        closable
                        style={{ margin: 0, cursor: 'pointer' }}
                        onClick={handleResetMask}
                        onClose={handleResetMask}
                        onMouseEnter={() => {
                          setIsMaskStatusTagHovered(true);
                          handleMaskHoverStart();
                        }}
                        onMouseLeave={() => {
                          setIsMaskStatusTagHovered(false);
                          handleMaskHoverEnd();
                        }}
                        title={t('image.upload.status.mask.resetHint', {
                          defaultValue: '点击恢复默认遮罩',
                        })}
                      >
                        {t('image.upload.status.mask.modified', { defaultValue: '已添加遮罩' })}
                      </Tag>
                    ) : null}
                    {hasCustomBoundary ? (
                      <Tag
                        closable
                        style={{ margin: 0, cursor: 'pointer' }}
                        onClick={handleResetBoundary}
                        onClose={handleResetBoundary}
                        onMouseEnter={handleBoundaryStatusHoverStart}
                        onMouseLeave={handleBoundaryStatusHoverEnd}
                        title={t('image.upload.status.boundary.resetHint', {
                          defaultValue: '点击恢复默认边界',
                        })}
                      >
                        {t(
                          isBoundaryDocMismatchOnly
                            ? 'image.upload.status.boundary.docMismatch'
                            : 'image.upload.status.boundary.modified',
                          {
                            defaultValue: isBoundaryDocMismatchOnly ? '非当前文档' : '已限定范围',
                          },
                        )}
                      </Tag>
                    ) : null}
                  </>
                ) : null}
                {hoverHelpMessage ? (
                  <span
                    style={{
                      color: token.colorTextSecondary ?? token.colorText,
                    }}
                  >
                    {hoverHelpMessage}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </Flex>
  );
};
