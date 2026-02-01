import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sdpppPersistStorage } from './persistStorage';

export type TemplateOption = { value: string; label: string; templateId: string };

export type SponsorTemplateState = {
  templates: TemplateOption[];
  loadingTemplates: boolean;
  selectedTemplateId: string;
  templateId: string;
  templateIdHistory: string[];
  recommendedUploadProviders: Record<string, string>;
  setTemplates: (templates: TemplateOption[]) => void;
  setLoadingTemplates: (loading: boolean) => void;
  setSelectedTemplateId: (templateId: string) => void;
  setTemplateId: (templateId: string) => void;
  addTemplateIdHistory: (templateId: string) => void;
  setRecommendedUploadProvider: (templateId: string, provider: string | null) => void;
  getRecommendedUploadProvider: (templateId: string) => string | undefined;
  resetTemplates: () => void;
};

const initialState = {
  templates: [],
  loadingTemplates: false,
  selectedTemplateId: '',
  templateId: '',
  templateIdHistory: [],
  recommendedUploadProviders: {},
};

export const sponsorTemplateStore = create<SponsorTemplateState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setTemplates: (templates) => set({ templates }),
      setLoadingTemplates: (loadingTemplates) => set({ loadingTemplates }),
      setSelectedTemplateId: (selectedTemplateId) => set({ selectedTemplateId }),
      setTemplateId: (templateId) => set({ templateId }),
      addTemplateIdHistory: (templateId) => {
        const normalized = templateId.trim();
        if (!normalized) return;
        const history = get().templateIdHistory;
        if (history.includes(normalized)) return;
        set({ templateIdHistory: [...history, normalized].slice(-20) });
      },
      setRecommendedUploadProvider: (templateId, provider) => {
        const normalizedTemplateId = templateId.trim();
        set((state) => {
          const next = { ...state.recommendedUploadProviders } as Record<string, string>;
          if (!normalizedTemplateId) return { recommendedUploadProviders: next };
          if (provider && provider.trim().length > 0) {
            next[normalizedTemplateId] = provider.trim();
          } else {
            delete next[normalizedTemplateId];
          }
          return { recommendedUploadProviders: next };
        });
      },
      getRecommendedUploadProvider: (templateId) => {
        const normalizedTemplateId = templateId.trim();
        if (!normalizedTemplateId) return undefined;
        return get().recommendedUploadProviders[normalizedTemplateId];
      },
      resetTemplates: () => set({ ...initialState }),
    }),
    {
      name: 'sdppp_sponsor-template-store',
      storage: sdpppPersistStorage,
      partialize: (state) => ({
        templateId: state.templateId,
        templateIdHistory: state.templateIdHistory,
        selectedTemplateId: state.selectedTemplateId,
      }),
    }
  )
);
