import { useCallback, useEffect, useMemo } from 'react';

import {
  useUploadTracker,
  type UseUploadTrackerResult,
} from './useUploadTracker';

export interface UseManagedUploadTrackerResult extends UseUploadTrackerResult {
  dismissUploadError: () => void;
  setUploadErrorAndProgress: (
    message: string | null,
    progress?: { current: number; total: number },
  ) => void;
}

export const useManagedUploadTracker = (): UseManagedUploadTrackerResult => {
  const tracker = useUploadTracker();
  const {
    uploadStatus,
    uploadError,
    resetProgress,
    setUploadError,
    setUploadProgress,
  } = tracker;

  useEffect(() => {
    if (uploadStatus === 'idle' && uploadError === null) {
      resetProgress();
    }
  }, [resetProgress, uploadError, uploadStatus]);

  const dismissUploadError = useCallback(() => {
    setUploadError(null);
    resetProgress();
  }, [resetProgress, setUploadError]);

  const setUploadErrorAndProgress = useCallback(
    (
      message: string | null,
      progress?: { current: number; total: number },
    ) => {
      setUploadError(message);
      if (progress) {
        setUploadProgress(progress);
      }
    },
    [setUploadError, setUploadProgress],
  );

  return useMemo(
    () => ({
      ...tracker,
      dismissUploadError,
      setUploadErrorAndProgress,
    }),
    [dismissUploadError, setUploadErrorAndProgress, tracker],
  );
};

export default useManagedUploadTracker;
