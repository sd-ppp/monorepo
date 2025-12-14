import { useCallback } from 'react';
import { usePhotoshopWidgetActions, type ResourceHandle } from '../context/PhotoshopWidgetContext';
import { buildUploadFileName } from '../utils/localImagePackLayout';

export interface LocalResourceSelectionItem {
  resource: string;
  preview: string | null;
  mime?: string | null;
  fileName: string;
  nativePath?: string | null;
  handle?: ResourceHandle | null;
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

const sanitizeNativePath = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'undefined' || lower === 'null') {
    return null;
  }
  return trimmed;
};

const extractLegacyThumbnail = (entry: unknown): string | null => {
  if (entry && typeof entry === 'object') {
    const candidate = (entry as { thumbnail?: unknown }).thumbnail;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
};

export const useLocalResourceSelection = (
  options?: LocalResourceSelectionOptions,
) => {
  const actions = usePhotoshopWidgetActions();
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
        let preview = extractLegacyThumbnail(entry);

        if (!disablePreviewCapture) {
          if (!preview) {
            try {
              const thumb = await actions['resource.thumbnail']({ resource });
              if (thumb?.thumbnail) {
                preview = thumb.thumbnail;
              } else if (thumb?.error) {
                captureError(thumb, thumb.error);
                hasError = true;
              }
            } catch (thumbnailError) {
              captureError(
                thumbnailError,
                thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
              );
              hasError = true;
            }
          }
        }

        items.push({
          resource,
          preview,
          mime,
          fileName: buildUploadFileName(resource, mime ?? undefined),
          nativePath: sanitizeNativePath(entry.nativePath),
          handle: entry.handle ?? null,
        });
      }
    } catch (error) {
      captureError(error, error instanceof Error ? error.message : String(error));
      hasError = true;
    }

    return {
      items,
      hasError,
      errorMessage: firstErrorMessage,
      errorDetail: firstErrorDetail,
    };
  }, [actions, actionParams, maxItems, disablePreviewCapture]);
};
