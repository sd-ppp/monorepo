import { useCallback } from 'react';
import { sponsorAuthStore } from '../auth/authStore';
import { fetchTemplates } from './templateApi';
import { sponsorTemplateStore } from './templateStore';

export const useTemplates = () => {
  const setTemplates = sponsorTemplateStore(state => state.setTemplates);
  const setLoadingTemplates = sponsorTemplateStore(state => state.setLoadingTemplates);
  const setSelectedTemplateId = sponsorTemplateStore(state => state.setSelectedTemplateId);
  const setTemplateId = sponsorTemplateStore(state => state.setTemplateId);

  const refreshTemplates = useCallback(async () => {
    const { services, tenantId } = sponsorAuthStore.getState();
    if (!services) return;
    setLoadingTemplates(true);
    try {
      const templates = await fetchTemplates(services, tenantId);
      setTemplates(templates);
      const currentSelectedId = sponsorTemplateStore.getState().selectedTemplateId;
      let resolvedTemplateId = sponsorTemplateStore.getState().templateId?.trim() ?? '';
      let resolvedSelectedId = currentSelectedId;
      if (currentSelectedId) {
        const matched = templates.find((item) => item.value === currentSelectedId);
        if (matched) {
          resolvedTemplateId = matched.templateId?.trim() ?? '';
        } else {
          resolvedTemplateId = '';
          resolvedSelectedId = '';
        }
      }
      setTemplateId(resolvedTemplateId);
      setSelectedTemplateId(resolvedSelectedId);
    } catch (error: any) {
      sponsorAuthStore.getState().setAuthError(error?.message ?? String(error));
    } finally {
      setLoadingTemplates(false);
    }
  }, [setLoadingTemplates, setSelectedTemplateId, setTemplateId, setTemplates]);

  return { refreshTemplates };
};
