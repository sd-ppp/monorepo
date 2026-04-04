import { onFormValuesChange } from '@formily/core';
import { t } from '@sdppp/common';
import { useCallback, useEffect, useRef } from 'react';
import { customapiFormStore } from './customapi.formStore';
import { customapiSchemaStore } from './customapi.schemaStore';
import { customapiStore } from './customapi.store';

export const useCustomApiSchemaForm = () => {
  const form = customapiFormStore(state => state.form);
  const setCurrentValues = customapiFormStore(state => state.setCurrentValues);
  const resetFormValues = customapiFormStore(state => state.resetFormValues);
  const setSchema = customapiSchemaStore(state => state.setSchema);
  const setMetadata = customapiSchemaStore(state => state.setMetadata);
  const setCancelable = customapiSchemaStore(state => state.setCancelable);
  const setSchemaError = customapiSchemaStore(state => state.setSchemaError);
  const setLoadingSchema = customapiSchemaStore(state => state.setLoadingSchema);
  const pendingModelRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof form.addEffects === 'function' && typeof form.removeEffects === 'function') {
      form.removeEffects('customapi-sync');
      form.addEffects('customapi-sync', () => {
        onFormValuesChange(() => {
          setCurrentValues(form.values);
          customapiStore.getState().setCurrentValues(form.values as Record<string, any>);
        });
      });
      return () => {
        form.removeEffects?.('customapi-sync');
      };
    }
    if (typeof form.subscribe === 'function') {
      const unsubscribe = form.subscribe(({ values }) => {
        if (values) {
          setCurrentValues(values);
          customapiStore.getState().setCurrentValues(values as Record<string, any>);
        }
      });
      return () => {
        unsubscribe?.();
      };
    }
    return undefined;
  }, [form, setCurrentValues]);

  const performLoadSchema = useCallback(async (model: string) => {
    const client = customapiStore.getState().client;
    if (!client) {
      pendingModelRef.current = model;
      return;
    }

    resetFormValues();
    setLoadingSchema(true);
    setSchemaError(null);
    setSchema(null);
    setMetadata(null);
    setCancelable(null);

    try {
      const result = await client.getNodes(model);
      const storedValues = customapiStore.getState().allValues[model];
      const values = storedValues ?? result.defaultInput ?? {};
      const schema = result.rawData?.schema ?? null;
      const metadata = result.rawData?.metadata ?? null;
      const cancelable = result.rawData?.cancelable ?? null;
      form.setInitialValues(values);
      form.setValues(values);
      setCurrentValues(values);
      customapiStore.getState().setCurrentValues(values);
      setSchema(schema);
      setMetadata(metadata);
      setCancelable(cancelable);
      customapiStore.getState().setSelectedModel(model);
    } catch (error: any) {
      setSchemaError(error?.message ?? String(error));
    } finally {
      setLoadingSchema(false);
    }
  }, [form, resetFormValues, setCancelable, setCurrentValues, setLoadingSchema, setMetadata, setSchema, setSchemaError]);

  const loadSchema = useCallback(async (model?: string) => {
    const targetModel = (model ?? customapiStore.getState().selectedModel).trim();
    if (!targetModel) {
      setSchemaError(t('customapi.error.model_required'));
      return;
    }
    await performLoadSchema(targetModel);
  }, [performLoadSchema, setSchemaError]);

  useEffect(() => {
    const client = customapiStore.getState().client;
    const pendingModel = pendingModelRef.current;
    if (!client || !pendingModel) return;
    pendingModelRef.current = null;
    void performLoadSchema(pendingModel);
  }, [performLoadSchema]);

  return { loadSchema };
};
