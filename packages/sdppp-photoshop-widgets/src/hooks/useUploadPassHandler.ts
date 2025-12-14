import { useCallback } from 'react';
import { v4 } from 'uuid';

import { useWidgetUploadPassHandlers, type WidgetUploadPass } from '../context/PhotoshopWidgetContext';

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
}

export const useUploadPassHandler = ({
  uploadErrorLabel,
  onSuccess,
  onError,
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
              fileName: `${v4()}.png`
            };
          },
        };

        const uploaded = await runUploadPassOnce(uploadPass);
        const normalizedResult = typeof uploaded === 'string' ? uploaded.trim() : '';
        if (!normalizedResult) {
          setUploadError(uploadErrorLabel);
          onError?.(uploadErrorLabel, { resource: normalizedResource });
          return undefined;
        }

        setUploadProgress({ current: 1, total: 1 });
        onSuccess(normalizedResult, { resource: normalizedResource });
        return normalizedResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const resolvedMessage = message || uploadErrorLabel;
        setUploadError(resolvedMessage);
        onError?.(resolvedMessage, { resource: normalizedResource });
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
      runUploadPassOnce,
      setUploadError,
      setUploadProgress,
      uploadErrorLabel,
    ],
  );
};

export default useUploadPassHandler;
