import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./persistStorage', () => ({
  sdpppPersistStorage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

const { sponsorTemplateStore } = await import('./templateStore');

describe('sponsorTemplateStore', () => {
  beforeEach(() => {
    sponsorTemplateStore.getState().resetTemplates();
  });

  it('tracks template selection and history', () => {
    sponsorTemplateStore.getState().setTemplates([{ value: 'v1', label: 'V1', templateId: 't1' }]);
    sponsorTemplateStore.getState().setSelectedTemplateId('v1');
    sponsorTemplateStore.getState().setTemplateId('t1');
    sponsorTemplateStore.getState().addTemplateIdHistory('t1');
    sponsorTemplateStore.getState().addTemplateIdHistory('t1');

    const state = sponsorTemplateStore.getState();
    expect(state.templates.length).toBe(1);
    expect(state.selectedTemplateId).toBe('v1');
    expect(state.templateId).toBe('t1');
    expect(state.templateIdHistory).toEqual(['t1']);
  });

  it('manages recommended upload providers', () => {
    sponsorTemplateStore.getState().setRecommendedUploadProvider('t1', 'provider-a');
    expect(sponsorTemplateStore.getState().getRecommendedUploadProvider('t1')).toBe('provider-a');

    sponsorTemplateStore.getState().setRecommendedUploadProvider('t1', null);
    expect(sponsorTemplateStore.getState().getRecommendedUploadProvider('t1')).toBeUndefined();
  });
});
