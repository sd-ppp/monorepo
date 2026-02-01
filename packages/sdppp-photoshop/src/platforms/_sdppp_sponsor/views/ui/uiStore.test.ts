import { describe, expect, it, beforeEach } from 'vitest';
import { sponsorUiStore } from '../uiStore';

describe('sponsorUiStore', () => {
  beforeEach(() => {
    sponsorUiStore.getState().resetUi();
  });

  it('updates active tab', () => {
    sponsorUiStore.getState().setActiveTab('history');
    sponsorUiStore.getState().setInitialized(true);
    sponsorUiStore.getState().setBalanceLoading(true);
    sponsorUiStore.getState().setHasFetchedBalance(true);

    const state = sponsorUiStore.getState();
    expect(state.activeTab).toBe('history');
    expect(state.initialized).toBe(true);
    expect(state.balanceLoading).toBe(true);
    expect(state.hasFetchedBalance).toBe(true);
  });
});
