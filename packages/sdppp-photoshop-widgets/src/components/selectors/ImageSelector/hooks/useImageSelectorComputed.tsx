import React, { useCallback, useMemo } from 'react';

import { useImageSelectorDebug } from '../../../../hooks/useImageSelectorDebug';
import { useThumbnail, type UseThumbnailParams } from '../../../../hooks/useThumbnail';
import { resolveThumbnailParams, DEFAULT_CONTENT_URI } from '../../../../utils/resolveThumbnailParams';
import { MoreHorizontal, RefreshCw } from 'lucide-react';

import { ensureAutoSpinStyle } from '../utils';
import type { ImageSelectorState } from './useImageSelectorState';
import type { ImageSelectorProps, TranslateFn } from '../types';

export interface ImageSelectorComputed {
  cutLabel: string;
  scanLabel: string;
  cutTooltipText: string;
  scanTooltipText: string;
  statusCurrentLabel: string;
  renderTooltipLines: (text: string) => React.ReactNode;
  shouldShowFallbackActionButton: boolean;
  displayUrl: string;
  debugDetails: ReturnType<typeof useImageSelectorDebug>['debugDetails'];
  autoButtonIcon: React.ReactElement;
  syncButtonIcon: React.ReactElement;
}

interface UseImageSelectorComputedParams
  extends Pick<ImageSelectorProps, 'value' | 'workBoundary'> {
  state: ImageSelectorState;
  translate: TranslateFn;
}

export const useImageSelectorComputed = ({
  state,
  translate,
  value,
  workBoundary,
}: UseImageSelectorComputedParams): ImageSelectorComputed => {
  const imageUrl = value?.[0] ?? '';
  const {
    auto,
    derivedContentUri,
    effectiveBoundaryUri,
    effectiveFileUri,
    maskUri,
    selectionBoundary,
    boundaryUri,
    renderMeta,
    logger,
  } = state;

  const cutLabel = translate('image.upload.primary.cut', { defaultValue: 'Crop' });
  const scanLabel = translate('image.upload.primary.scan', { defaultValue: 'Scan' });
  const cutTooltipText = translate('image.upload.tooltip.cut_action', {
    defaultValue: 'Fetch image +\nCrop selection mask',
  });
  const scanTooltipText = translate('image.upload.tooltip.scan_action', {
    defaultValue: 'Fetch image +\nLimit image boundary',
  });

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

  const shouldShowFallbackActionButton = useMemo(() => {
    const noMask = !(maskUri?.trim());
    const normalizedBoundaryUri = (boundaryUri ?? '').trim();
    const normalizedWorkBoundary = (workBoundary ?? '').trim();
    const isBoundaryUnchanged = normalizedBoundaryUri === normalizedWorkBoundary;
    const noSelection = selectionBoundary == null;
    return noMask && isBoundaryUnchanged && noSelection;
  }, [boundaryUri, maskUri, selectionBoundary, workBoundary]);

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
    renderMeta,
  });

  const syncButtonIcon = useMemo(
    () => <MoreHorizontal size={20} strokeWidth={2} />,
    [],
  );

  const autoButtonIcon = useMemo(() => {
    const style: React.CSSProperties = {
      transition: 'transform 0.2s ease',
    };
    if (auto) {
      ensureAutoSpinStyle();
      style.animation = 'sdppp-sync-button-spin 1s linear infinite';
      style.transformOrigin = 'center';
    }
    return <RefreshCw size={18} strokeWidth={2} style={style} />;
  }, [auto]);

  return {
    cutLabel,
    scanLabel,
    cutTooltipText,
    scanTooltipText,
    statusCurrentLabel,
    renderTooltipLines,
    shouldShowFallbackActionButton,
    displayUrl,
    debugDetails,
    autoButtonIcon,
    syncButtonIcon,
  };
};
