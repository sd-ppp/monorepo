import { useEffect, useMemo, useRef } from 'react';

import type { MutableRefObject } from 'react';

import type { ResourceHandle } from '../../../../context/PhotoshopWidgetContext';
import type { UseThumbnailParams } from '../../../../hooks/useThumbnail';
import { useThumbnail } from '../../../../hooks/useThumbnail';
import type { BoundaryUri, ContentUri, FileUri } from '../../../../hooks/useThumbnail/types';
import { resolveDocContext } from '../../../../utils/docContext';
import { ensureImageSizeParams } from '../../../../utils/resolveThumbnailParams';
import type { SourceMode } from '../types';

interface UseThumbnailPreviewParams {
  auto: boolean;
  sourceMode: SourceMode;
  contentUri: string;
  boundaryUri: string;
  maskUri?: string | null;
  diskFileUri?: string | null;
  lastKnownValueRef: MutableRefObject<string>;
  contentHandleRef: MutableRefObject<ResourceHandle | null>;
  maskHandleRef: MutableRefObject<ResourceHandle | null>;
  invalidationKey?: number;
}

const applyReverseParam = (uri: string, reverse: boolean): string => {
  const trimmed = uri.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (reverse) {
      parsed.searchParams.set('reverse', '1');
    } else {
      parsed.searchParams.delete('reverse');
    }
    return parsed.toString();
  } catch {
    if (!reverse) {
      return trimmed;
    }
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}reverse=1`;
  }
};

export const useThumbnailPreview = ({
  auto,
  sourceMode,
  contentUri,
  boundaryUri,
  maskUri,
  diskFileUri,
  lastKnownValueRef,
  contentHandleRef,
  maskHandleRef,
  invalidationKey = 0,
}: UseThumbnailPreviewParams) => {
  const maskHandleResourceId = maskHandleRef.current?.resourceId ?? '';
  const contentHandleResourceId = (contentHandleRef.current?.resourceId ?? '').trim();
  const diskFileResourceId = (diskFileUri ?? '').trim();
  const lastKnownFileResourceId = (lastKnownValueRef.current ?? '').trim();

  const { thumbnailParams, overlayThumbnailParams, thumbnailMeta, overlayMeta } = useMemo<{
    thumbnailParams: UseThumbnailParams;
    overlayThumbnailParams: UseThumbnailParams;
    thumbnailMeta: Record<string, string | boolean | null>;
    overlayMeta: Record<string, string | boolean | null>;
  }>(() => {
    const docContext = resolveDocContext(boundaryUri);
    const fallbackContentUri = docContext.canvasContentUri;
    const fallbackBoundaryUri =
      docContext.normalizedBoundaryUri || docContext.canvasBoundaryUri;

    const normalizeContentUri = (value?: string | null): ContentUri => {
      const trimmed = (value ?? '').trim();
      return (trimmed || fallbackContentUri) as ContentUri;
    };

    const normalizedBoundary = (() => {
      const candidate = (boundaryUri ?? '').trim() || fallbackBoundaryUri;
      return ensureImageSizeParams(candidate) as BoundaryUri;
    })();

    const normalizedMaskHandle = maskHandleResourceId.trim();
    const normalizedMaskState = (maskUri ?? '').trim();
    const fallbackMaskUri = (() => {
      const resolvedDocId = docContext.docId > 0 ? docContext.docId : 0;
      return `uxp://mask/${resolvedDocId}/empty`;
    })();
    const maskBase = normalizedMaskHandle || normalizedMaskState || fallbackMaskUri;
    const maskSourceLabel = normalizedMaskHandle
      ? 'maskHandleResource'
      : normalizedMaskState
        ? 'maskUri'
        : 'defaultMask';
    const buildMask = (reverse: boolean): string => {
      if (!maskBase) return '';
      return applyReverseParam(maskBase, reverse);
    };

    const resolveParams = (
      reverseMask: boolean
    ): { params: UseThumbnailParams; meta: Record<string, string | boolean | null> } => {
      const meta: Record<string, string | boolean | null> = {
        reverse: reverseMask,
        mode: auto ? 'auto' : 'manual',
        sourceMode,
        contentSource: null,
        maskSource: null,
      };

      const maskForMode = buildMask(reverseMask);

      if (sourceMode === 'file') {
        if (diskFileResourceId) {
          meta.contentSource = 'diskFileUri';
          return {
            params: {
              fileUri: diskFileResourceId as FileUri,
            },
            meta,
          };
        }
        if (lastKnownFileResourceId) {
          meta.contentSource = 'fileModeLastKnown';
          return {
            params: {
              fileUri: lastKnownFileResourceId as FileUri,
            },
            meta,
          };
        }
        meta.contentSource = 'fileModeFallbackContent';
        meta.maskSource = maskForMode ? maskSourceLabel : null;
        return {
          params: {
            contentUri: normalizeContentUri(contentUri),
            boundaryUri: normalizedBoundary,
            ...(maskForMode ? { maskUri: maskForMode } : {}),
          },
          meta,
        };
      }

      if (auto) {
        meta.contentSource = 'autoLiveContent';
        meta.maskSource = maskForMode ? maskSourceLabel : null;
        return {
          params: {
            contentUri: normalizeContentUri(contentUri),
            boundaryUri: normalizedBoundary,
            ...(maskForMode ? { maskUri: maskForMode } : {}),
          },
          meta,
        };
      }

      if (contentHandleResourceId) {
        const handleContentUri = contentHandleResourceId as ContentUri;
        meta.contentSource = 'contentHandleResource';
        meta.maskSource = maskForMode ? maskSourceLabel : null;
        return {
          params: {
            contentUri: handleContentUri,
            boundaryUri: normalizedBoundary,
            ...(maskForMode ? { maskUri: maskForMode } : {}),
          },
          meta,
        };
      }

      const manualContentCandidate = normalizeContentUri(contentUri);
      meta.contentSource = 'resourceStateContentUri';
      meta.maskSource = maskForMode ? maskSourceLabel : null;

      return {
        params: {
          contentUri: manualContentCandidate,
          boundaryUri: normalizedBoundary,
          ...(maskForMode ? { maskUri: maskForMode } : {}),
        },
        meta,
      };
    };

    const main = resolveParams(true);
    const overlay = resolveParams(false);

    return {
      thumbnailParams: main.params,
      overlayThumbnailParams: overlay.params,
      thumbnailMeta: main.meta,
      overlayMeta: overlay.meta,
    };
  }, [
    auto,
    boundaryUri,
    contentUri,
    contentHandleResourceId,
    diskFileResourceId,
    lastKnownFileResourceId,
    maskHandleResourceId,
    maskUri,
    sourceMode,
  ]);

const describeParams = (params: UseThumbnailParams): Record<string, string | null> =>
  'fileUri' in params
    ? { fileUri: params.fileUri ?? null }
    : {
        contentUri: params.contentUri ?? null,
        boundaryUri: params.boundaryUri ?? null,
        maskUri: params.maskUri ?? null,
      };

  const {
    data: previewUrl,
    refetch: refetchPreview,
  } = useThumbnail(thumbnailParams, { disableRealtime: !auto });
  const {
    data: overlayPreviewUrl,
    refetch: refetchOverlay,
  } = useThumbnail(overlayThumbnailParams, { disableRealtime: !auto });

  const lastInvalidationRef = useRef<number>(invalidationKey);
  useEffect(() => {
    if (lastInvalidationRef.current === invalidationKey) {
      return;
    }
    lastInvalidationRef.current = invalidationKey;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void refetchPreview().catch(() => {});
      void refetchOverlay().catch(() => {});
    };

    const raf = (globalThis as Record<string, unknown>)['requestAnimationFrame'];
    if (typeof raf === 'function') {
      const boundRaf = raf as (cb: (time: number) => void) => number;
      const frameId = boundRaf(() => run());
      return () => {
        cancelled = true;
        const caf = (globalThis as Record<string, unknown>)['cancelAnimationFrame'];
        if (typeof caf === 'function') {
          (caf as (handle: number) => void)(frameId);
        }
      };
    }

    const timeoutId = setTimeout(run, 16);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [refetchPreview, refetchOverlay, invalidationKey]);

  return {
    thumbnailParams,
    previewUrl,
    overlayPreviewUrl,
  };
};
