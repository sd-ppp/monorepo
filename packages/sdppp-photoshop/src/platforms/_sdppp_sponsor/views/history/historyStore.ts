import { create } from 'zustand';

export type TaskHistoryRecordStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskHistoryRecord = {
  id: string;
  templateId: string;
  templateName?: string | null;
  status: TaskHistoryRecordStatus;
  message?: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  providerTaskId?: string;
  payload?: Record<string, any> | null;
  result?: Array<{ url?: string; [key: string]: any }> | null;
  charge?: number;
};

export type SponsorHistoryState = {
  history: TaskHistoryRecord[];
  historyLoading: boolean;
  historyError: string | null;
  selectedId: string | null;
  detailRecord: TaskHistoryRecord | null;
  detailOutputs: string[];
  detailLoading: boolean;
  detailError: string | null;
  detailVisible: boolean;
  setHistory: (history: TaskHistoryRecord[]) => void;
  setHistoryLoading: (loading: boolean) => void;
  setHistoryError: (error: string | null) => void;
  setSelectedId: (id: string | null) => void;
  setDetailRecord: (record: TaskHistoryRecord | null) => void;
  setDetailOutputs: (outputs: string[]) => void;
  setDetailLoading: (loading: boolean) => void;
  setDetailError: (error: string | null) => void;
  setDetailVisible: (visible: boolean) => void;
  resetHistory: () => void;
};

const initialState = {
  history: [],
  historyLoading: false,
  historyError: null,
  selectedId: null,
  detailRecord: null,
  detailOutputs: [],
  detailLoading: false,
  detailError: null,
  detailVisible: false,
};

export const sponsorHistoryStore = create<SponsorHistoryState>((set) => ({
  ...initialState,
  setHistory: (history) => set({ history }),
  setHistoryLoading: (historyLoading) => set({ historyLoading }),
  setHistoryError: (historyError) => set({ historyError }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setDetailRecord: (detailRecord) => set({ detailRecord }),
  setDetailOutputs: (detailOutputs) => set({ detailOutputs }),
  setDetailLoading: (detailLoading) => set({ detailLoading }),
  setDetailError: (detailError) => set({ detailError }),
  setDetailVisible: (detailVisible) => set({ detailVisible }),
  resetHistory: () => set({ ...initialState }),
}));
