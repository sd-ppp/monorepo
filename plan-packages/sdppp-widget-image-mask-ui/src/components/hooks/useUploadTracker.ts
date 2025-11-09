import { useCallback, useMemo, useState } from 'react';

export interface UploadTrackerState {
  pendingUploads: number;
  uploadError: string | null;
  uploadProgress: { current: number; total: number };
  uploadStatus: 'idle' | 'uploading' | 'error';
  uploading: boolean;
}

export interface UploadTrackerHandlers {
  markUploadStart: (total?: number) => void;
  markUploadEnd: () => void;
  runWithUploading: <T>(operation: () => Promise<T>, total?: number) => Promise<T>;
  resetProgress: () => void;
  setUploadError: (message: string | null) => void;
  setUploadProgress: (progress: { current: number; total: number }) => void;
}

export type UseUploadTrackerResult = UploadTrackerState & UploadTrackerHandlers;

export const useUploadTracker = (): UseUploadTrackerResult => {
  const [pendingUploads, setPendingUploads] = useState<number>(0);
  const [uploadError, setUploadErrorState] = useState<string | null>(null);
  const [uploadProgress, setUploadProgressState] = useState<{ current: number; total: number }>(
    {
      current: 0,
      total: 0,
    },
  );

  const markUploadStart = useCallback((total: number = 1) => {
    setPendingUploads(prev => prev + 1);
    setUploadErrorState(null);
    setUploadProgressState({ current: 0, total });
  }, []);

  const markUploadEnd = useCallback(() => {
    setPendingUploads(prev => (prev <= 1 ? 0 : prev - 1));
  }, []);

  const runWithUploading = useCallback(
    async <T,>(operation: () => Promise<T>, total: number = 1): Promise<T> => {
      markUploadStart(total);
      try {
        const result = await operation();
        setUploadProgressState({ current: total, total });
        return result;
      } finally {
        markUploadEnd();
      }
    },
    [markUploadStart, markUploadEnd],
  );

  const resetProgress = useCallback(() => {
    setUploadErrorState(null);
    setUploadProgressState({ current: 0, total: 0 });
  }, []);

  const uploadStatus = uploadError ? 'error' : pendingUploads > 0 ? 'uploading' : 'idle';
  const uploading = pendingUploads > 0;

  return useMemo(
    () => ({
      pendingUploads,
      uploadError,
      uploadProgress,
      uploadStatus,
      uploading,
      markUploadStart,
      markUploadEnd,
      runWithUploading,
      resetProgress,
      setUploadError: setUploadErrorState,
      setUploadProgress: setUploadProgressState,
    }),
    [
      pendingUploads,
      uploadError,
      uploadProgress,
      uploadStatus,
      uploading,
      markUploadStart,
      markUploadEnd,
      runWithUploading,
      resetProgress,
    ],
  );
};

export default useUploadTracker;
