import { useCallback } from 'react';
import {
  useWidgetImageMaskActions,
  useWidgetLogger,
} from '../../context/WidgetImageMaskContext';
import { buildUploadFileName } from './layout';

export interface LocalImagePackSelectionItem {
  resource: string;
  preview: string | null;
  mime?: string | null;
  fileName: string;
}

export interface LocalImagePackSelectionResult {
  items: LocalImagePackSelectionItem[];
  hasError: boolean;
}

const normalizeResource = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const useLocalImagePackSelection = () => {
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();

  return useCallback(async (): Promise<LocalImagePackSelectionResult> => {
    const items: LocalImagePackSelectionItem[] = [];
    let hasError = false;

    try {
      const result = await actions['resource.file.createFromLocal']();
      if (!result) return { items, hasError: false };

      logger('LocalImagePackSelection createFromLocal', result);

      if (result.error && !result.batch?.length) {
        return { items, hasError: true };
      }

      const entries = Array.isArray(result.batch) && result.batch.length ? result.batch : [result];

      for (const entry of entries) {
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

        if (!preview) {
          try {
            const thumb = await actions['resource.thumbnail']({ resource });
            if (thumb?.thumbnail) {
              preview = thumb.thumbnail;
            }
          } catch (thumbnailError) {
            logger(
              'LocalImagePackSelection thumbnail error',
              thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError),
            );
            hasError = true;
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
        'LocalImagePackSelection createFromLocal error',
        error instanceof Error ? error.message : String(error),
      );
      hasError = true;
    }

    return { items, hasError };
  }, [actions, logger]);
};
