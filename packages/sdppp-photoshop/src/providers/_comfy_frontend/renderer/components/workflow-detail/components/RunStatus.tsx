import React, { useMemo } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from '@sdppp/common';
import { sdpppSDK } from '@sdppp/common';
import { WorkflowStatusDisplay } from '@sdppp/ui-library';
import type { WorkflowStatusDescriptor } from '@sdppp/ui-library';

interface WorkflowRunStatusProps {
  uploading: boolean;
  className?: string;
}

export const WorkflowRunStatus: React.FC<WorkflowRunStatusProps> = ({ uploading, className }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const lastError = useStore(sdpppSDK.stores.ComfyStore, (s) => s.lastError);
  const progress = useStore(sdpppSDK.stores.ComfyStore, (s) => s.progress);
  const executingNodeTitle = useStore(sdpppSDK.stores.ComfyStore, (s) => s.executingNodeTitle);
  const queueSize = useStore(sdpppSDK.stores.ComfyStore, (s) => s.queueSize);
  const autoRunning = useStore(sdpppSDK.stores.PhotoshopStore, (state) => (state as any).comfyAutoRunning);

  const status: WorkflowStatusDescriptor = useMemo(() => {
    if (uploading) {
      return {
        type: 'uploading',
        message: translate('comfy.uploading'),
        showIcon: true,
      };
    }
    if (lastError) {
      return {
        type: 'error',
        message: lastError,
        showIcon: true,
      };
    }
    if (typeof queueSize === 'number' && queueSize > 0) {
      return {
        type: 'progress',
        message: translate('comfy.queue_progress', {
          queueSize,
          progress,
          executingNodeTitle: executingNodeTitle ?? '',
        }),
        percent: progress ?? 0,
        showInfo: false,
      };
    }
    if (autoRunning) {
      return {
        type: 'autoRunning',
        message: translate('comfy.auto_run_status', {
          defaultMessage: 'auto run workflow after change..',
        }),
      };
    }
    return { type: 'empty' };
  }, [
    autoRunning,
    executingNodeTitle,
    lastError,
    progress,
    queueSize,
    translate,
    uploading,
  ]);

  if (status.type === 'empty') {
    return <div className="workflow-controls-middle-bottom-placeholder" />;
  }

  return (
    <WorkflowStatusDisplay
      status={status}
      className={className ?? 'workflow-run-status'}
    />
  );
};
