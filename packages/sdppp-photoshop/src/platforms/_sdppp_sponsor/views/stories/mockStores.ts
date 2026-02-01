import { useEffect } from 'react';
import { create } from 'zustand';
import type { FormilySchema } from '../../schemaUtils';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorExecutionStore } from '../form/executionStore';
import { sponsorFormStore } from '../form/formStore';
import { sponsorHistoryStore, type TaskHistoryRecord } from '../history/historyStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { sponsorTemplateStore, type TemplateOption } from '../templates/templateStore';
import { sponsorUiStore, type SponsorTabKey } from '../uiStore';

export type MockBalanceState = {
  balance: number | null;
  setBalance: (balance: number | null) => void;
};

export const mockBalanceStore = create<MockBalanceState>((set) => ({
  balance: null,
  setBalance: (balance) => set({ balance }),
}));

export const mockTemplates: TemplateOption[] = [
  { value: 'banana-1', label: 'Banana Studio', templateId: 'template-banana-1' },
  { value: 'banana-2', label: 'Banana Pro', templateId: 'template-banana-2' },
];

export const mockHistory: TaskHistoryRecord[] = [
  {
    id: 'task-001',
    templateId: 'template-banana-1',
    templateName: 'Banana Studio',
    status: 'completed',
    message: 'Completed successfully',
    createdAt: Date.now() - 1000 * 60 * 20,
    updatedAt: Date.now() - 1000 * 60 * 10,
    finishedAt: Date.now() - 1000 * 60 * 9,
    charge: 12,
    payload: { prompt: 'A cozy cabin in the woods' },
    result: [{ url: 'https://example.com/image-1.png' }],
  },
  {
    id: 'task-002',
    templateId: 'template-banana-2',
    templateName: 'Banana Pro',
    status: 'failed',
    message: 'GPU timeout',
    createdAt: Date.now() - 1000 * 60 * 60,
    updatedAt: Date.now() - 1000 * 60 * 55,
    finishedAt: Date.now() - 1000 * 60 * 54,
    charge: 0,
    payload: { prompt: 'A futuristic city at dawn' },
  },
];

export const mockSchema: FormilySchema = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      title: 'Prompt',
      'x-decorator': 'FormItem',
      'x-component': 'Input.TextArea',
    },
    strength: {
      type: 'number',
      title: 'Strength',
      'x-decorator': 'FormItem',
      'x-component': 'NumberPicker',
    },
  },
};

export type MockStoreOverrides = {
  activeTab?: SponsorTabKey;
  history?: TaskHistoryRecord[];
  templates?: TemplateOption[];
  selectedTemplateId?: string;
  schema?: FormilySchema | null;
  balance?: number | null;
  authError?: string | null;
};

export const initMockStores = (overrides: MockStoreOverrides = {}) => {
  sponsorAuthStore.getState().setAuthLoading(false);
  sponsorAuthStore.getState().setAuthError(overrides.authError ?? null);
  sponsorAuthStore.getState().setSession({} as any);

  sponsorUiStore.getState().setInitialized(true);
  sponsorUiStore.getState().setActiveTab(overrides.activeTab ?? 'editor');

  sponsorTemplateStore.getState().setTemplates(overrides.templates ?? mockTemplates);
  sponsorTemplateStore.getState().setSelectedTemplateId(
    overrides.selectedTemplateId ?? (overrides.templates ?? mockTemplates)[0]?.value ?? ''
  );
  sponsorTemplateStore.getState().setTemplateId(
    (overrides.templates ?? mockTemplates)[0]?.templateId ?? ''
  );

  sponsorSchemaStore.getState().setSchema(overrides.schema ?? mockSchema);
  sponsorSchemaStore.getState().setLoadingSchema(false);

  mockBalanceStore.getState().setBalance(overrides.balance ?? 42);
  sponsorUiStore.getState().setBalanceLoading(false);
  sponsorUiStore.getState().setHasFetchedBalance(true);

  sponsorExecutionStore.getState().setIsExecuting(false);
  sponsorExecutionStore.getState().setExecutionPhase('idle');
  sponsorExecutionStore.getState().setRunningTasks([]);

  sponsorFormStore.getState().setCurrentValues({});

  sponsorHistoryStore.getState().setHistory(overrides.history ?? mockHistory);
  sponsorHistoryStore.getState().setHistoryLoading(false);
  sponsorHistoryStore.getState().setHistoryError(null);
  sponsorHistoryStore.getState().setSelectedId((overrides.history ?? mockHistory)[0]?.id ?? null);
};

export const resetMockStores = () => {
  sponsorAuthStore.getState().resetAuthState();
  mockBalanceStore.getState().setBalance(null);
  sponsorExecutionStore.getState().resetExecution();
  sponsorFormStore.getState().resetFormValues();
  sponsorHistoryStore.getState().resetHistory();
  sponsorSchemaStore.getState().resetSchema();
  sponsorTemplateStore.getState().resetTemplates();
  sponsorUiStore.getState().resetUi();
};

export const useMockStores = (overrides: MockStoreOverrides = {}) => {
  useEffect(() => {
    initMockStores(overrides);
    return () => resetMockStores();
  }, [overrides]);
};
