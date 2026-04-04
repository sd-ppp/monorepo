import { onFormValuesChange } from '@formily/core';
import { t } from '@sdppp/common';
import { useCallback, useEffect, useRef } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorFormStore } from '../form/formStore';
import { sponsorTemplateStore } from '../templates/templateStore';
import { fetchSchema } from './schemaApi';
import { sponsorSchemaStore } from './schemaStore';

export const useSchemaForm = () => {
  const form = sponsorFormStore(state => state.form);
  const setCurrentValues = sponsorFormStore(state => state.setCurrentValues);
  const resetFormValues = sponsorFormStore(state => state.resetFormValues);
  const setSchema = sponsorSchemaStore(state => state.setSchema);
  const setMetadata = sponsorSchemaStore(state => state.setMetadata);
  const setCancelable = sponsorSchemaStore(state => state.setCancelable);
  const setSchemaError = sponsorSchemaStore(state => state.setSchemaError);
  const setLoadingSchema = sponsorSchemaStore(state => state.setLoadingSchema);
  const setTemplateId = sponsorTemplateStore(state => state.setTemplateId);
  const addTemplateIdHistory = sponsorTemplateStore(state => state.addTemplateIdHistory);
  const setRecommendedUploadProvider = sponsorTemplateStore(state => state.setRecommendedUploadProvider);
  const pendingTemplateIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof form.addEffects === 'function' && typeof form.removeEffects === 'function') {
      form.removeEffects('taskrouter-sync');
      form.addEffects('taskrouter-sync', () => {
        onFormValuesChange(() => {
          setCurrentValues(form.values);
        });
      });
      return () => {
        form.removeEffects?.('taskrouter-sync');
      };
    }
    if (typeof form.subscribe === 'function') {
      const unsubscribe = form.subscribe(({ values }) => {
        if (values) {
          setCurrentValues(values);
        }
      });
      return () => {
        unsubscribe?.();
      };
    }
    return undefined;
  }, [form, setCurrentValues]);

  const performLoadSchema = useCallback(async (templateId: string) => {
    const client = sponsorAuthStore.getState().client;
    if (!client) {
      pendingTemplateIdRef.current = templateId;
      return;
    }

    resetFormValues();
    setLoadingSchema(true);
    setSchemaError(null);
    setSchema(null);
    setMetadata(null);

    try {
      const result = await fetchSchema(client, templateId);
      form.setInitialValues(result.values);
      form.setValues(result.values);
      setCurrentValues(result.values);
      setSchema(result.schema);
      setMetadata(result.metadata ?? null);
      setCancelable(result.cancelable ?? null);
      setTemplateId(templateId);
      addTemplateIdHistory(templateId);
      setRecommendedUploadProvider(templateId, result.recommendedUploadProvider);
    } catch (error: any) {
      setSchemaError(error?.message ?? String(error));
    } finally {
      setLoadingSchema(false);
    }
  }, [addTemplateIdHistory, form, resetFormValues, setCancelable, setCurrentValues, setLoadingSchema, setMetadata, setRecommendedUploadProvider, setSchema, setSchemaError, setTemplateId]);

  const loadSchema = useCallback(async (templateId?: string) => {
    const targetTemplateId = (templateId ?? sponsorTemplateStore.getState().templateId).trim();
    if (!targetTemplateId) {
      setSchemaError(t('taskrouter.no_schema'));
      return;
    }
    await performLoadSchema(targetTemplateId);
  }, [performLoadSchema, setSchemaError]);

  useEffect(() => {
    const client = sponsorAuthStore.getState().client;
    const pendingTemplateId = pendingTemplateIdRef.current;
    if (!client || !pendingTemplateId) return;
    pendingTemplateIdRef.current = null;
    void performLoadSchema(pendingTemplateId);
  }, [performLoadSchema]);

  return { loadSchema };
};
