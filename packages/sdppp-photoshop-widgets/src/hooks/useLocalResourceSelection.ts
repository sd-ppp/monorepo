import { useCallback } from 'react';
import {
  useWidgetImageMaskActions,
  useWidgetLogger,
} from '../context/WidgetImageMaskContext';
import { buildUploadFileName } from '../utils/localImagePackLayout';

export interface LocalResourceSelectionItem {
  resource: string;
  preview: string | null;
  mime?: string | null;
  fileName: string;
}

export interface LocalResourceSelectionResult {
  items: LocalResourceSelectionItem[];
  hasError: boolean;
  errorMessage?: string;
  errorDetail?: unknown;
}

export interface LocalResourceSelectionOptions {
  actionParams?: Record<string, unknown>;
  maxItems?: number;
  disablePreviewCapture?: boolean;
}

const normalizeResource = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const useLocalResourceSelection = (
  options?: LocalResourceSelectionOptions,
) => {
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();
  const { actionParams, maxItems, disablePreviewCapture } = options ?? {};

  return useCallback(async (): Promise<LocalResourceSelectionResult> => {
    const items: LocalResourceSelectionItem[] = [];
    let hasError = false;
    let firstErrorMessage: string | undefined;
    let firstErrorDetail: unknown;

    const captureError = (detail: unknown, message?: unknown) => {
      if (firstErrorDetail === undefined && detail !== undefined) {
        firstErrorDetail = detail;
      }
      if (typeof message === 'string' && !firstErrorMessage && message.trim().length) {
        firstErrorMessage = message.trim();
      } else if (!firstErrorMessage && typeof detail === 'string' && detail.trim().length) {
        firstErrorMessage = detail.trim();
      } else if (!firstErrorMessage && detail instanceof Error && detail.message?.trim().length) {
        firstErrorMessage = detail.message.trim();
      }
    };

    try {
      const result = await actions['resource.file.createFromLocal'](actionParams);
      if (!result) return { items, hasError: false };

      logger('LocalResourceSelection createFromLocal', result);

      if (result.error && !result.batch?.length) {
        captureError(result, result.error);
        return {
          items,
          hasError: true,
          errorMessage: firstErrorMessage,
          errorDetail: firstErrorDetail ?? result,
        };
      }

      const entries =
        Array.isArray(result.batch) && result.batch.length ? result.batch : [result];

      for (const entry of entries) {
        if (typeof maxItems === 'number' && maxItems >= 0 && items.length >= maxItems) {
          break;
        }

        if (!entry || entry.error) {
          hasError = true;
          if (entry) {
            captureError(entry, typeof entry.error === 'string' ? entry.error : undefined);
          }
          continue;
        }

        const resource = normalizeResource(entry.resource);
        if (!resource) {
          captureError(entry, entry?.error);
          hasError = true;
          continue;
        }

        const mime = entry.mime ?? null;
        let preview = entry.thumbnail ?? null;

        if (!disablePreviewCapture) {
          if (!preview) {
            try {
              const thumb = await actions['resource.thumbnail']({ resource });
              if (thumb?.thumbnail) {
                preview = thumb.thumbnail;
              }
            } catch (thumbnailError) {
              logger(
                'LocalResourceSelection thumbnail error',
                thumbnailError instanceof Error
                  ? thumbnailError.message
                  : String(thumbnailError),
              );
              captureError(thumbnailError, thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError));
              hasError = true;
            }
          }
        }

        items.push({
          resource,
          preview,
          mime,
          fileName: buildUploadFileName(resource, mime ?? undefined),
        });
      }
    } catch (error) {
      logger(
        'LocalResourceSelection createFromLocal error',
        error instanceof Error ? error.message : String(error),
      );
      captureError(error, error instanceof Error ? error.message : String(error));
      hasError = true;
    }

    return {
      items,
      hasError,
      errorMessage: firstErrorMessage,
      errorDetail: firstErrorDetail,
    };
  }, [actions, logger, actionParams, maxItems, disablePreviewCapture]);
};
