import { useCallback, useEffect, useRef } from 'react';
import { t } from '@sdppp/common';
import { useTaskExecutor } from '../../../base/useTaskExecutor';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { sponsorTemplateStore } from '../templates/templateStore';
import { transformDeferredUploadFieldsBeforeSubmit } from './deferredUploadTransformer';
import { sponsorExecutionStore } from './executionStore';
import { sponsorFormStore } from './formStore';
import { createSponsorTask } from './taskRunner';

export const useExecution = (options: { onRunFinished?: () => void } = {}) => {
  const form = sponsorFormStore(state => state.form);
  const currentValues = sponsorFormStore(state => state.currentValues);
  const templateId = sponsorTemplateStore(state => state.templateId);
  const templateCancelable = sponsorSchemaStore(state => state.cancelable);
  const runningTasks = sponsorExecutionStore(state => state.runningTasks);
  const isExecuting = sponsorExecutionStore(state => state.isExecuting);
  const executionPhase = sponsorExecutionStore(state => state.executionPhase);
  const setIsExecuting = sponsorExecutionStore(state => state.setIsExecuting);
  const setExecutionPhase = sponsorExecutionStore(state => state.setExecutionPhase);

  const transformedValuesRef = useRef<any>(null);

  const { handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
    selectedModel: templateId,
    currentValues,
    getCurrentValues: () => {
      if (transformedValuesRef.current) {
        return transformedValuesRef.current;
      }
      return { ...form.values };
    },
    createTask: async (model, values) => {
      const client = sponsorAuthStore.getState().client;
      if (!client) {
        throw new Error(t('taskrouter.error.client_missing'));
      }
      return createSponsorTask(client, model, values);
    },
    runningTasks,
    beforeCreateTaskHook: (values) => values,
    templateCancelable,
  });

  const handleRunWithSubmit = useCallback(async () => {
    if (isExecuting) return;

    setIsExecuting(true);
    setExecutionPhase('preparing');
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const client = sponsorAuthStore.getState().client;
      const uploadTemplateId = sponsorTemplateStore.getState().templateId;
      const recommendedUploadProvider = sponsorTemplateStore
        .getState()
        .getRecommendedUploadProvider(uploadTemplateId);
      if (client && uploadTemplateId) {
        const uploadResourceFn = async (resourceId: string, opts?: { fileName?: string }) => {
          return client.uploadResource(uploadTemplateId, resourceId, {
            fileName: opts?.fileName,
            uploadProviderHint: recommendedUploadProvider,
          });
        };

        setExecutionPhase('uploading');
        const valuesSnapshot = JSON.parse(JSON.stringify(form.values));
        const tempForm = {
          values: valuesSnapshot,
          setValues: (newValues: any) => {
            tempForm.values = newValues;
          },
        };
        await transformDeferredUploadFieldsBeforeSubmit(tempForm as any, uploadResourceFn);
        form.setValues(tempForm.values);
        transformedValuesRef.current = tempForm.values;
      }

      setExecutionPhase('validating');
      const submitResult = await form.submit();
      if (submitResult === false) {
        setIsExecuting(false);
        setExecutionPhase('idle');
        return;
      }

      setExecutionPhase('creating');
      await handleRun();
      transformedValuesRef.current = null;
    } catch (error) {
      console.error('[TaskRouter:Submit] Submission failed:', error);
      setIsExecuting(false);
      setExecutionPhase('idle');
      transformedValuesRef.current = null;
    }
  }, [form, handleRun, isExecuting, setExecutionPhase, setIsExecuting]);

  useEffect(() => {
    if (isExecuting && !isRunning && executionPhase === 'idle') {
      setIsExecuting(false);
      if (options.onRunFinished) {
        options.onRunFinished();
      }
    }
  }, [executionPhase, isExecuting, isRunning, options, setIsExecuting]);

  useEffect(() => {
    if (isRunning && executionPhase !== 'idle') {
      setExecutionPhase('idle');
    }
  }, [executionPhase, isRunning, setExecutionPhase]);

  return {
    handleRunWithSubmit,
    handleCancel,
    isRunning,
    canCancel,
    isExecuting,
    executionPhase,
  };
};
