import { create } from 'zustand';

export type SponsorTabKey = 'editor' | 'history';

export type SponsorUiState = {
  initialized: boolean;
  activeTab: SponsorTabKey;
  balanceLoading: boolean;
  hasFetchedBalance: boolean;
  setInitialized: (initialized: boolean) => void;
  setActiveTab: (tab: SponsorTabKey) => void;
  setBalanceLoading: (loading: boolean) => void;
  setHasFetchedBalance: (fetched: boolean) => void;
  resetUi: () => void;
};

const initialState = {
  initialized: false,
  activeTab: 'editor' as SponsorTabKey,
  balanceLoading: false,
  hasFetchedBalance: false,
};

export const sponsorUiStore = create<SponsorUiState>((set) => ({
  ...initialState,
  setInitialized: (initialized) => set({ initialized }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setBalanceLoading: (balanceLoading) => set({ balanceLoading }),
  setHasFetchedBalance: (hasFetchedBalance) => set({ hasFetchedBalance }),
  resetUi: () => set({ ...initialState }),
}));
