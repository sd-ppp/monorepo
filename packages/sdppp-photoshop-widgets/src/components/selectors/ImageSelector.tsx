import { ImagePreviewFrame, SyncButton } from '@sdppp/ui-library';
import { Button, Tooltip } from 'antd';
import type { LucideIcon } from 'lucide-react';
import { Layers, Plus, Scan, Scissors, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useSelectAdvancedContentSource,
  useWidgetImageMaskActions,
  useWidgetLogger,
  useWidgetText,
  useWidgetUploadPassHandlers,
  type WidgetUploadPass,
} from '../../context/WidgetImageMaskContext';
import { useImageCbmActions } from '../../hooks/useImageCbmActions';
import { useImageSelectorDebug } from '../../hooks/useImageSelectorDebug';
import { useThumbnail, type UseThumbnailParams } from '../../hooks/useThumbnail';
import { useUploadTracker } from '../../hooks/useUploadTracker';
import {
  DEFAULT_CONTENT_URI,
  resolveThumbnailParams,
} from '../../utils/resolveThumbnailParams';
import { DebugBadge } from '../shared/DebugBadge';
import { UploadIndicator } from '../shared/UploadIndicator';

interface ImageSelectorProps {
  widgetableId: string;
  value: string[];
  showActionButtons?: boolean;
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
  showUploadIndicator?: boolean;
  defaultAuto?: boolean;
  externalErrorDismissSignal?: number;
  onUploadStateChange?: (state: {
    status: 'idle' | 'uploading' | 'error';
    errorMessage: string | null;
    progress: { current: number; total: number };
  }) => void;
}

const SECTION_SIZE = 120;
const ACTION_BUTTON_SIZE = 60;
const SYNC_BUTTON_SIZE = SECTION_SIZE;

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const resolveContentTooltip = (uri: string, translate: TranslateFn): string | undefined => {
  const normalized = uri?.trim();
  if (!normalized) return undefined;

  const resolveLayerTooltip = (layerName?: string | null) => {
    const trimmed = layerName?.trim();
    if (trimmed) {
      return translate('image.upload.tooltip.current.layer_named', {
        defaultValue: `当前选项：图层 ${trimmed}`,
        layerName: trimmed,
      });
    }
    return translate('image.upload.tooltip.current.layer', {
      defaultValue: '当前选项：图层',
    });
  };

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment === 'canvas') {
      return translate('image.upload.tooltip.current.canvas', {
        defaultValue: '当前选项：画布',
      });
    }
    if (lastSegment === 'layer') {
      return resolveLayerTooltip(parsed.searchParams.get('layername'));
    }
  } catch {
    // ignore parsing errors and fallback to string checks
  }

  if (normalized.endsWith('/canvas')) {
    return translate('image.upload.tooltip.current.canvas', {
      defaultValue: '当前选项：画布',
    });
  }
  if (/\/layer(?:\/|\?|$)/.test(normalized)) {
    const match = /layername=([^&#]+)/.exec(normalized);
    const layerName = match ? decodeURIComponent(match[1]) : undefined;
    return resolveLayerTooltip(layerName);
  }

  return undefined;
};

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
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();

  const imageUrl = value?.[0] ?? '';
  const addPrimaryLabel = t('image.upload.primary.manual', { defaultValue: '使用主图' });
  const cutLabel = t('image.upload.primary.cut', { defaultValue: '裁剪' });
  const scanLabel = t('image.upload.primary.scan', { defaultValue: '扫描' });
  const cutTooltipText = t('image.upload.tooltip.cut_action', {
    defaultValue: '获取图像+\n裁剪选区遮罩',
  });
  const scanTooltipText = t('image.upload.tooltip.scan_action', {
    defaultValue: '获取图像+\n限制图像范围',
  });
  const uploadErrorLabel = useMemo(
    () => t('image.upload.error', { defaultValue: '上传失败，请重试' }),
    [t],
  );

  const [fileUri, setFileUri] = useState<string>('');
  const [contentUri, setContentUri] = useState<string>('');
  const [boundaryUri, setBoundaryUri] = useState<string>(workBoundary);
  const [maskUri, setMaskUri] = useState<string>('');
  const [auto, setAuto] = useState<boolean>(defaultAuto);
  const autoRef = useRef<boolean>(auto);
  autoRef.current = auto;
  const pendingManualFileRef = useRef(false);
  const lastKnownValueRef = useRef<string>((value?.[0] ?? '').trim());
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
    if (!incoming) {
      return;
    }
    if (pendingManualFileRef.current) {
      if (incoming === lastKnownValueRef.current && incoming.length > 0) {
        pendingManualFileRef.current = false;
      } else {
        return;
      }
    }
    lastKnownValueRef.current = incoming;
  }, [value]);

  useEffect(() => {
    setBoundaryUri(workBoundary);
    setContentUri('');
  }, [workBoundary]);

  const effectiveBoundaryUri = boundaryUri || workBoundary;
  const effectiveFileUri = (fileUri || '').trim();

  const derivedContentUri = useMemo(() => {
    const normalizedContentUri = contentUri.trim();
    if (normalizedContentUri) return normalizedContentUri;
    if (!effectiveBoundaryUri) return DEFAULT_CONTENT_URI;
    return `uxp://content/${curDocId}/canvas`;
  }, [contentUri, effectiveBoundaryUri, curDocId]);

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

  const ensureContentUri = useCallback(() => {
    const normalized = contentUri.trim();
    if (normalized) {
      return normalized;
    }
    const fallback = derivedContentUri.trim() ? derivedContentUri : DEFAULT_CONTENT_URI;
    setContentUri(fallback);
    return fallback;
  }, [contentUri, derivedContentUri]);

  const mainButtonTooltip = useMemo(() => {
    const tooltipFromContent = resolveContentTooltip(contentUri, t);
    if (tooltipFromContent) {
      return tooltipFromContent;
    }

    if (!contentUri.trim() && effectiveFileUri) {
      return t('image.upload.tooltip.current.file', {
        defaultValue: '当前选项：文件',
      });
    }

    const tooltipFromDerived = resolveContentTooltip(derivedContentUri, t);
    if (tooltipFromDerived) {
      return tooltipFromDerived;
    }

    if (effectiveFileUri) {
      return t('image.upload.tooltip.current.file', {
        defaultValue: '当前选项：文件',
      });
    }

    return undefined;
  }, [contentUri, derivedContentUri, effectiveFileUri, t]);

  const renderTooltipLines = useCallback((text: string) => {
    const lines = text.split('\n');
    return (
      <>
        {lines.map((line, index) => (
          <React.Fragment key={`${line}-${index}`}>
            {line}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </>
    );
  }, []);

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

  const selectAdvancedContentSource = useSelectAdvancedContentSource();

  const syncButtonIcon = useMemo(
    () => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Plus size={16} strokeWidth={2} />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            backgroundColor: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
          }}
        />
        <Layers size={16} strokeWidth={2} />
        <span
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            backgroundColor: 'var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45))',
          }}
        />
        <Upload size={16} strokeWidth={2} />
      </div>
    ),
    [],
  );

  const createIconWithPlusOverlay = useCallback(
    (BaseIcon: LucideIcon) => (
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
        }}
      >
        <Plus size={20} strokeWidth={2} />
        <BaseIcon
          size={14}
          strokeWidth={2}
          style={{
            position: 'absolute',
            right: -5,
            bottom: -5,
          }}
        />
      </span>
    ),
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
  const pendingAutoOverridesRef = useRef<{
    contentUri?: string | null;
    maskUri?: string | null;
    boundaryUri?: string | null;
  } | null>(null);

  const { addUploadPass, removeUploadPass, runUploadPassOnce } = useWidgetUploadPassHandlers();
  const autoUploadPassRef = useRef<{ pass: WidgetUploadPass } | null>(null);
  const autoUploadInFlightRef = useRef<boolean>(false);

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
    [auto, handleResourceUpload, tryRegisterAutoUploadPass, sync],
  );

  const handlePrimarySync = useCallback(async () => {
    try {
      const selection = await selectAdvancedContentSource();
      if (selection?.contentUri) {
        const normalized = selection.contentUri.trim();
        if (normalized) {
          pendingManualFileRef.current = false;
          setContentUri(normalized);
          setFileUri('');
          await handleSync({ contentUri: normalized });
        }
      } else if (selection?.fileUri) {
        const normalized = selection.fileUri.trim();
        if (normalized) {
          pendingManualFileRef.current = true;
          lastKnownValueRef.current = '';
          setContentUri('');
          setAuto(false);
          setFileUri(normalized);
          await handleResourceUpload(normalized);
        }
      }
    } catch (error) {
      logger(
        'ImageSelector selectAdvancedContentSource error',
        JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    }
  }, [handleResourceUpload, handleSync, logger, selectAdvancedContentSource]);

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
    setAuto(nextAuto);
    if (wasAuto && !nextAuto) {
      autoRef.current = false;
      void flushAutoModeOnce();
    }
  }, [flushAutoModeOnce]);

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
  }, [auto, ensureContentUri, handleResourceUpload, rebuildMask, tryRegisterAutoUploadPass, sync]);

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
  }, [auto, ensureContentUri, handleResourceUpload, normalizeBoundary, tryRegisterAutoUploadPass, sync]);

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
              void handlePrimarySync();
            }}
            onAutoSyncToggle={() => {
              handleAutoToggle();
            }}
            tooltipPlacement="right"
            syncButtonTooltip={mainButtonTooltip}
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
              {syncButtonIcon}
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
              display: 'flex',
              alignItems: 'flex-start',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              borderRadius: 'var(--ant-border-radius-lg, 6px)',
              overflow: 'hidden',
            }}
          >
            <Tooltip
              placement="left"
              autoAdjustOverflow={false}
              title={renderTooltipLines(cutTooltipText)}
            >
              <Button
                type="default"
                icon={createIconWithPlusOverlay(Scissors)}
                aria-label={cutLabel}
                title={cutLabel}
                style={{ ...actionButtonStyle, margin: 0 }}
                onClick={() => {
                  void handleMaskRebuildWithSync();
                }}
              />
            </Tooltip>
            <Tooltip
              placement="left"
              autoAdjustOverflow={false}
              title={renderTooltipLines(scanTooltipText)}
            >
              <Button
                type="default"
                icon={createIconWithPlusOverlay(Scan)}
                aria-label={scanLabel}
                title={scanLabel}
                style={{ ...actionButtonStyle, margin: 0 }}
                onClick={() => {
                  void handleBoundaryNormalizeWithSync();
                }}
              />
            </Tooltip>
          </div>
        ) : null}
      </div>
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
    </div>
  );
};
