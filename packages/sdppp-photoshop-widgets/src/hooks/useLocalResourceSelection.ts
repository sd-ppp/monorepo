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

    try {
      const result = await actions['resource.file.createFromLocal'](actionParams);
      if (!result) return { items, hasError: false };

      logger('LocalResourceSelection createFromLocal', result);

      if (result.error && !result.batch?.length) {
        return { items, hasError: true };
      }

      const entries =
        Array.isArray(result.batch) && result.batch.length ? result.batch : [result];

      for (const entry of entries) {
        if (typeof maxItems === 'number' && maxItems >= 0 && items.length >= maxItems) {
          break;
        }

        if (!entry || entry.error) {
          hasError = true;
          continue;
        }

        const resource = normalizeResource(entry.resource);
        if (!resource) {
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
      hasError = true;
    }

    return { items, hasError };
  }, [actions, logger, actionParams, maxItems, disablePreviewCapture]);
};
