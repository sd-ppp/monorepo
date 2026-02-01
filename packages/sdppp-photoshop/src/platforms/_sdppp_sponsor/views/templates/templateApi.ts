import type { SDPPPXServices, SDPPPXTemplateOption } from '@sdppp/sdpppx-services';
import type { TemplateOption } from './templateStore';

export const normalizeTemplates = (items: SDPPPXTemplateOption[]): TemplateOption[] => {
  return (
    items
      ?.map((item) => {
        const templateId =
          typeof item.value === 'string' && item.value.trim().length > 0
            ? item.value.trim()
            : '';
        if (!templateId) return null;
        const label =
          typeof item.label === 'string' && item.label.trim().length > 0
            ? item.label.trim()
            : templateId;
        return { value: templateId, label, templateId } as TemplateOption;
      })
      .filter((entry): entry is TemplateOption => !!entry) ?? []
  );
};

export const fetchTemplates = async (services: SDPPPXServices, tenantId: string | null) => {
  const response = await services.fetchTemplates(undefined, {
    tenantId: tenantId ?? undefined,
  });
  return normalizeTemplates(response.items ?? []);
};
