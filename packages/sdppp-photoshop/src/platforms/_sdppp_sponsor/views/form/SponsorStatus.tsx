import { memo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { SimpleWorkflowControlPanel } from '../../../_comfy_frontend/renderer/components/workflow-detail/components/SimpleWorkflowControlPanel';
import { useTaskExecutionStore } from '../../../base/taskExecutionStore';
import type { SponsorAuthState } from '../auth/authStore';
import type { SponsorSchemaState } from '../schema/schemaStore';
import type { SponsorTemplateState } from '../templates/templateStore';
import type { SponsorExecutionState } from './executionStore';

const useTaskStatus = (
  executionPhase: 'idle' | 'preparing' | 'uploading' | 'validating' | 'waiting' | 'creating',
  isRunning: boolean,
  schemaError: string | null,
  t: (key: string, options?: any) => string
) => {
  const progressMessage = useTaskExecutionStore(state => state.progressMessage);
  const runError = useTaskExecutionStore(state => state.runError);

  if (runError) return { type: 'error' as const, message: runError };
  if (progressMessage) return { type: 'uploading' as const, message: progressMessage };

  if (executionPhase === 'preparing') {
    return { type: 'uploading' as const, message: t('taskrouter.status.preparing', { defaultValue: 'Preparing...' }) };
  }
  if (executionPhase === 'uploading') {
    return { type: 'uploading' as const, message: t('taskrouter.status.uploading', { defaultValue: 'Uploading images...' }) };
  }
  if (executionPhase === 'validating') {
    return { type: 'uploading' as const, message: t('taskrouter.status.validating', { defaultValue: 'Validating form...' }) };
  }
  if (executionPhase === 'creating') {
    return { type: 'uploading' as const, message: t('taskrouter.status.creating', { defaultValue: 'Creating task...' }) };
  }

  if (isRunning) return { type: 'uploading' as const, message: t('task.running', { defaultValue: 'Running...' }) };
  if (schemaError) return { type: 'error' as const, message: schemaError };
  return { type: 'empty' as const };
};

export type SponsorStatusProps = {
  t: (key: string, options?: any) => string;
  executionStore: UseBoundStore<StoreApi<SponsorExecutionState>>;
  schemaStore: UseBoundStore<StoreApi<SponsorSchemaState>>;
  templateStore: UseBoundStore<StoreApi<SponsorTemplateState>>;
  authStore: UseBoundStore<StoreApi<SponsorAuthState>>;
  onRun: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  isRunning: boolean;
  canCancel: boolean;
};

const SponsorStatus = memo(function SponsorStatus({
  t,
  executionStore,
  schemaStore,
  templateStore,
  authStore,
  onRun,
  onCancel,
  isRunning,
  canCancel,
}: SponsorStatusProps) {
  const isExecuting = executionStore(state => state.isExecuting);
  const executionPhase = executionStore(state => state.executionPhase);
  const schemaError = schemaStore(state => state.schemaError);
  const schema = schemaStore(state => state.schema);
  const templateId = templateStore(state => state.templateId);
  const authLoading = authStore(state => state.authLoading);

  const status = useTaskStatus(executionPhase, isRunning, schemaError, t);

  return (
    <SimpleWorkflowControlPanel
      headerRight={null}
      runTooltip={t('task.execute', { defaultValue: 'Run' })}
      runDisabled={isExecuting || isRunning || !schema || !!schemaError || !templateId || authLoading}
      onRun={onRun}
      cancelTooltip={t('task.stop', { defaultValue: 'Stop' })}
      canCancel={canCancel}
      onCancel={onCancel}
      hideBoundaryControls
      status={status}
    />
  );
});

export default SponsorStatus;
