import { useCallback } from 'react';

import {
  useWidgetUploadPassHandlers,
  type WidgetImageMaskLogger,
  type WidgetUploadPass,
} from '../context/WidgetImageMaskContext';

export interface UploadPassTrackerControls {
  markUploadStart: (total?: number) => void;
  markUploadEnd: () => void;
  setUploadError: (message: string | null) => void;
  setUploadProgress: (progress: { current: number; total: number }) => void;
}

export interface UseUploadPassHandlerOptions extends UploadPassTrackerControls {
  uploadErrorLabel: string;
  onSuccess: (uploaded: string, context: { resource: string }) => void;
  onError?: (message: string, context: { resource: string }) => void;
  logger?: WidgetImageMaskLogger;
}

export const useUploadPassHandler = ({
  uploadErrorLabel,
  onSuccess,
  onError,
  logger,
  markUploadStart,
  markUploadEnd,
  setUploadError,
  setUploadProgress,
}: UseUploadPassHandlerOptions) => {
  const { runUploadPassOnce } = useWidgetUploadPassHandlers();

  return useCallback(
    async (resource?: string | null): Promise<string | undefined> => {
      const normalizedResource = (resource ?? '').trim();
      if (!normalizedResource) return undefined;

      markUploadStart(1);
      setUploadProgress({ current: 0, total: 1 });

      try {
        const uploadPass: WidgetUploadPass = {
          getUploadFile: async (signal?: AbortSignal) => {
            if (signal?.aborted) {
              throw new DOMException('Upload aborted', 'AbortError');
            }
            return {
              type: 'resource',
              resource: normalizedResource,
              resourceId: normalizedResource,
            };
          },
        };

        const uploaded = await runUploadPassOnce(uploadPass);
        const normalizedResult = typeof uploaded === 'string' ? uploaded.trim() : '';
        if (!normalizedResult) {
          setUploadError(uploadErrorLabel);
          onError?.(uploadErrorLabel, { resource: normalizedResource });
          if (logger) {
            logger(
              'UploadPass empty result',
              JSON.stringify({ resource: normalizedResource }),
            );
          }
          return undefined;
        }

        setUploadProgress({ current: 1, total: 1 });
        onSuccess(normalizedResult, { resource: normalizedResource });
        if (logger) {
          logger(
            'UploadPass success',
            JSON.stringify({ resource: normalizedResource, uploaded: normalizedResult }),
          );
        }
        return normalizedResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const resolvedMessage = message || uploadErrorLabel;
        setUploadError(resolvedMessage);
        onError?.(resolvedMessage, { resource: normalizedResource });
        if (logger) {
          logger(
            'UploadPass error',
            JSON.stringify({ resource: normalizedResource, message: resolvedMessage }),
          );
        }
        return undefined;
      } finally {
        markUploadEnd();
      }
    },
    [
      markUploadEnd,
      markUploadStart,
      onError,
      onSuccess,
      logger,
      runUploadPassOnce,
      setUploadError,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );
};

export default useUploadPassHandler;
