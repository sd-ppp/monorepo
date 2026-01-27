import { useCallback, useState } from 'react';

import type { SdpppWidgetUploadSelectorProps, UploadStatus } from '../types';
import { DEFAULT_PROGRESS, IDLE_PROGRESS } from '../utils';

type UploadProgress = { current: number; total: number };

interface UseSdpppWidgetUploadStatusParams {
  onUploadStateChange?: SdpppWidgetUploadSelectorProps['onUploadStateChange'];
}

const normalizeProgress = (status: UploadStatus, progress?: UploadProgress) => {
  if (progress) return progress;
  return status === 'idle' ? IDLE_PROGRESS : DEFAULT_PROGRESS;
};

export const useSdpppWidgetUploadStatus = ({
  onUploadStateChange,
}: UseSdpppWidgetUploadStatusParams) => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastDismissSignal, setLastDismissSignal] = useState<number | undefined>();

  const updateStatus = useCallback(
    (nextStatus: UploadStatus, message: string | null, progress?: UploadProgress) => {
      setStatus(nextStatus);
      setStatusMessage(message);
      if (onUploadStateChange) {
        const normalizedProgress = normalizeProgress(nextStatus, progress);
        onUploadStateChange({
          status: nextStatus,
          errorMessage: nextStatus === 'error' ? message : null,
          progress: normalizedProgress,
        });
      }
    },
    [onUploadStateChange],
  );

  const handleExternalDismiss = useCallback(
    (signal?: number) => {
      if (typeof signal !== 'number' || signal === lastDismissSignal) return;
      setLastDismissSignal(signal);
      if (status === 'error') {
        updateStatus('idle', null, IDLE_PROGRESS);
      }
    },
    [lastDismissSignal, status, updateStatus],
  );

  return {
    status,
    statusMessage,
    updateStatus,
    handleExternalDismiss,
  };
};
