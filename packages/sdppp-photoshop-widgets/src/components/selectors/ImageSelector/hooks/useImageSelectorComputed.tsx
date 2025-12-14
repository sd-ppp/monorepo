import React, { useMemo } from 'react';

import { MoreHorizontal } from 'lucide-react';
import { useImageSelectorDebug } from '../../../../hooks/useImageSelectorDebug';

import type { ImageSelectorProps, TranslateFn } from '../types';
import type { ImageSelectorState } from './useImageSelectorState';
import { useThumbnailPreview } from './useThumbnailPreview';

export interface ImageSelectorComputed {
  cutLabel: string;
  scanLabel: string;
  cutTooltipText: string;
  scanTooltipText: string;
  autoButtonTooltipText: string;
  autoStatusLabel: string;
  statusCurrentLabel: string;
  manualSyncTooltipText: string;
  displayUrl: string;
  overlayDisplayUrl: string;
  debugDetails: ReturnType<typeof useImageSelectorDebug>['debugDetails'];
  autoButtonIcon: React.ReactElement;
  syncButtonIcon: React.ReactElement;
}

interface UseImageSelectorComputedParams
  extends Pick<ImageSelectorProps, 'value' | 'workBoundary'> {
  state: ImageSelectorState;
  translate: TranslateFn;
  previewRevision: number;
}

export const useImageSelectorComputed = ({
  state,
  translate,
  value,
  workBoundary,
  previewRevision,
}: UseImageSelectorComputedParams): ImageSelectorComputed => {
  const imageUrl = value?.[0] ?? '';
  const {
    auto,
    contentUri,
    diskFileUri,
    maskUri,
    boundaryUri,
    renderMeta,
    sourceMode,
    contentHandleRef,
    maskHandleRef,
    maskHandleResourceRef,
    isInitialState,
  } = state;
  const normalizedWorkBoundary = (workBoundary ?? '').trim();
  const defaultBoundaryForMode = useMemo(
    () => normalizedWorkBoundary,
    [normalizedWorkBoundary],
  );
  const resolvedBoundaryUri = (boundaryUri ?? '').trim() || normalizedWorkBoundary;
  const resolvedDiskFileUri = (diskFileUri ?? '').trim();

  const cutLabel = translate('image.upload.primary.cut', { defaultValue: 'Crop' });
  const scanLabel = translate('image.upload.primary.scan', { defaultValue: 'Scan' });
  const cutTooltipText = translate('image.upload.tooltip.cut_action', {
    defaultValue: 'Fetch image +\nCrop selection mask',
  });
  const scanTooltipText = translate('image.upload.tooltip.scan_action', {
    defaultValue: 'Fetch image +\nLimit image boundary',
  });
  const manualSyncTooltipText = translate('image.upload.tooltip.sync_action', {
    defaultValue: '同步当前内容',
  });
  const autoButtonTooltipText = auto
    ? translate('image.upload.tooltip.autosync.on', { defaultValue: 'Auto Sync: on' })
    : translate('image.upload.tooltip.autosync.off', { defaultValue: 'Auto Sync: off' });

  const autoStatusLabel = auto
    ? translate('image.upload.autosync.status.enabled', { defaultValue: '自动同步中...' })
    : translate('image.upload.autosync.status.disabled', { defaultValue: '自动同步未打开' });

  const { thumbnailParams, previewUrl, overlayPreviewUrl } = useThumbnailPreview({
    auto,
    sourceMode,
    contentUri,
    boundaryUri: resolvedBoundaryUri,
    maskUri,
    diskFileUri: resolvedDiskFileUri,
    lastKnownValueRef: state.lastKnownValueRef,
    contentHandleRef,
    maskHandleRef,
    invalidationKey: previewRevision,
  });

  const displayUrl = isInitialState ? imageUrl : previewUrl ?? imageUrl ?? '';
  const overlayDisplayUrl = isInitialState
    ? imageUrl
    : overlayPreviewUrl ?? '';

  const statusCurrentLabel = useMemo(() => {
    const { layerInfo, sourceMode } = state;
    if (sourceMode === 'layer') {
      const displayName = layerInfo?.layerName?.trim() ?? layerInfo?.layerId?.trim();
      if (displayName) {
        return translate('image.upload.status.layer.short_named', {
          defaultValue: `Layer ${displayName}`,
          layerName: layerInfo?.layerName ?? undefined,
          layerId: layerInfo?.layerId ?? undefined,
        });
      }
      return translate('image.upload.status.layer.short', {
        defaultValue: 'Layer',
      });
    }
    if (sourceMode === 'file') {
      return translate('image.upload.status.file.short', {
        defaultValue: 'Local file',
      });
    }
    return translate('image.upload.status.canvas.short', {
      defaultValue: 'Canvas',
    });
  }, [state, translate]);

  const { debugDetails } = useImageSelectorDebug({
    auto,
    displayUrl,
    imageUrl,
    fileUri: resolvedDiskFileUri,
    contentUri,
    boundaryUri: resolvedBoundaryUri,
    maskUri,
    contentHandleUri: contentHandleRef.current?.resourceId ?? null,
    maskHandleUri: maskHandleResourceRef.current ?? null,
    thumbnailParams,
    renderMeta,
    defaultBoundaryUri: defaultBoundaryForMode,
  });

  const syncButtonIcon = useMemo(
    () => <MoreHorizontal size={20} strokeWidth={2} />,
    [],
  );

  const autoButtonIcon = useMemo(
    () => (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
          lineHeight: 1,
        }}
      >
        AUTO
      </span>
    ),
    [],
  );

  return {
    cutLabel,
    scanLabel,
    cutTooltipText,
    scanTooltipText,
    autoButtonTooltipText,
    statusCurrentLabel,
    autoStatusLabel,
    manualSyncTooltipText,
    displayUrl,
    overlayDisplayUrl,
    debugDetails,
    autoButtonIcon,
    syncButtonIcon,
  };
};
