import { useCallback } from 'react';

import type {
  WidgetImageMaskActions,
  WidgetImageMaskLogger,
} from '../../context/WidgetImageMaskContext';

export interface UseImageCbmActionsOptions {
  actions: WidgetImageMaskActions;
  contentUri: string;
  boundaryUri: string;
  maskUri: string;
  documentId: string | number;
  onFileResource?: (resource: string) => void;
  onMaskUri?: (mask: string) => void;
  onBoundaryUri?: (boundary: string) => void;
  setUploadError: (message: string | null) => void;
  logger?: WidgetImageMaskLogger;
}

export interface UseImageCbmActionsResult {
  sync: (overrides?: { maskUri?: string | null; boundaryUri?: string | null }) => Promise<string | undefined>;
  rebuildMask: () => Promise<string | undefined>;
  normalizeBoundary: () => Promise<string | undefined>;
}

export const useImageCbmActions = ({
  actions,
  contentUri,
  boundaryUri,
  maskUri,
  documentId,
  onFileResource,
  onMaskUri,
  onBoundaryUri,
  setUploadError,
  logger,
}: UseImageCbmActionsOptions): UseImageCbmActionsResult => {
  const sync = useCallback<UseImageCbmActionsResult['sync']>(
    async overrides => {
      try {
        const overrideMaskUri = overrides?.maskUri ?? maskUri;
        const overrideBoundaryUri = overrides?.boundaryUri ?? boundaryUri;
        const normalizedMaskUri = overrideMaskUri?.trim() || undefined;
        const normalizedBoundaryUri = overrideBoundaryUri?.trim() || undefined;

        const result = await actions['resource.file.createFromCBM']({
          contentUri,
          maskUri: normalizedMaskUri,
          boundaryUri: normalizedBoundaryUri,
        });

        const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
        if (resource) {
          onFileResource?.(resource);
          if (logger) {
            logger(
              'ImageCbmActions sync success',
              JSON.stringify({ overrides, resource }),
            );
          }
          return resource;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setUploadError(message);
        if (logger) {
          logger(
            'ImageCbmActions sync error',
            JSON.stringify({ overrides, message }),
          );
        }
      }
      return undefined;
    },
    [actions, boundaryUri, contentUri, logger, maskUri, onFileResource, setUploadError],
  );

  const rebuildMask = useCallback<UseImageCbmActionsResult['rebuildMask']>(async () => {
    try {
      const result = await actions['resource.file.createFromCBM']({
        maskUri: `uxp://mask/${documentId}/selection`,
        boundaryUri,
      });
      const resource = typeof result?.resource === 'string' ? result.resource.trim() : '';
      if (resource) {
        onMaskUri?.(resource);
        if (logger) {
          logger(
            'ImageCbmActions rebuildMask success',
            JSON.stringify({ maskUri: resource }),
          );
        }
        return resource;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadError(message);
      if (logger) {
        logger(
          'ImageCbmActions rebuildMask error',
          JSON.stringify({ message }),
        );
      }
    }
    return undefined;
  }, [actions, boundaryUri, documentId, logger, onMaskUri, setUploadError]);

  const normalizeBoundary = useCallback<UseImageCbmActionsResult['normalizeBoundary']>(async () => {
    if (!boundaryUri) return undefined;
    try {
      const result = await actions['resource.boundary.normalize']({
        boundary: `uxp://boundary/${documentId}/selection`,
      });
      const normalized = typeof result?.boundary === 'string' ? result.boundary.trim() : '';
      if (normalized) {
        onBoundaryUri?.(normalized);
        if (logger) {
          logger(
            'ImageCbmActions normalizeBoundary success',
            JSON.stringify({ boundary: normalized }),
          );
        }
        return normalized;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadError(message);
      if (logger) {
        logger(
          'ImageCbmActions normalizeBoundary error',
          JSON.stringify({ message }),
        );
      }
    }
    return undefined;
  }, [actions, boundaryUri, documentId, logger, onBoundaryUri, setUploadError]);

  return {
    sync,
    rebuildMask,
    normalizeBoundary,
  };
};

export default useImageCbmActions;
