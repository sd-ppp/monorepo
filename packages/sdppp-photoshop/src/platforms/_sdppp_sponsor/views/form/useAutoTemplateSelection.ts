import { useCallback, useEffect, useRef } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { sponsorTemplateStore } from '../templates/templateStore';
import { sponsorUiStore } from '../uiStore';

export const useAutoTemplateSelection = (loadSchema: (templateId?: string) => void) => {
  const initialized = sponsorUiStore(state => state.initialized);
  const supabaseSession = sponsorAuthStore(state => state.supabaseSession);
  const templates = sponsorTemplateStore(state => state.templates);
  const loadingTemplates = sponsorTemplateStore(state => state.loadingTemplates);
  const templateId = sponsorTemplateStore(state => state.templateId);
  const selectedTemplateId = sponsorTemplateStore(state => state.selectedTemplateId);
  const loadingSchema = sponsorSchemaStore(state => state.loadingSchema);
  const schema = sponsorSchemaStore(state => state.schema);
  const schemaError = sponsorSchemaStore(state => state.schemaError);
  const setTemplateId = sponsorTemplateStore(state => state.setTemplateId);
  const setSelectedTemplateId = sponsorTemplateStore(state => state.setSelectedTemplateId);

  const lastSchemaRequestRef = useRef<string | null>(null);
  const templatesReady = templates.length > 0 && !loadingTemplates;

  const handleTemplateSelect = useCallback(
    (value: string) => {
      const trimmedValue = typeof value === 'string' ? value.trim() : '';
      setSelectedTemplateId(trimmedValue);
      const matched = templates.find((item) => item.value === trimmedValue);
      const matchedTemplateId = matched?.templateId?.trim() ?? trimmedValue;
      lastSchemaRequestRef.current = matchedTemplateId;
      setTemplateId(matchedTemplateId);
      loadSchema(matchedTemplateId);
    },
    [loadSchema, setSelectedTemplateId, setTemplateId, templates]
  );

  useEffect(() => {
    if (!initialized) return;
    if (!supabaseSession) return;
    if (!templatesReady) return;
    if (loadingSchema) return;
    const defaultValue = templates[0]?.value;
    if (!defaultValue) return;

    const matched = selectedTemplateId ? templates.find(item => item.value === selectedTemplateId) : null;
    if (matched) {
      const normalizedTemplateId = matched.templateId?.trim() ?? '';
      if (normalizedTemplateId && normalizedTemplateId !== templateId) {
        setTemplateId(normalizedTemplateId);
      }
      return;
    }

    handleTemplateSelect(defaultValue);
  }, [handleTemplateSelect, initialized, loadingSchema, selectedTemplateId, supabaseSession, templateId, templates, templatesReady, setTemplateId]);

  useEffect(() => {
    if (!templateId) return;
    const normalizedTemplateId = templateId.trim();
    if (!normalizedTemplateId) return;
    if (schema) return;
    if (loadingSchema) return;
    const hasRetriedCurrentTemplateId = lastSchemaRequestRef.current === normalizedTemplateId;
    if (schemaError && hasRetriedCurrentTemplateId) return;

    lastSchemaRequestRef.current = normalizedTemplateId;
    loadSchema(templateId);
  }, [schema, loadingSchema, schemaError, templateId, loadSchema]);

  return { handleTemplateSelect };
};
