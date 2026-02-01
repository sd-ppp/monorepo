import { describe, expect, it, beforeEach } from 'vitest';
import { sponsorHistoryStore } from './historyStore';

describe('sponsorHistoryStore', () => {
  beforeEach(() => {
    sponsorHistoryStore.getState().resetHistory();
  });

  it('updates history fields and resets', () => {
    sponsorHistoryStore.getState().setHistory([{ id: 'task-1' } as any]);
    sponsorHistoryStore.getState().setHistoryLoading(true);
    sponsorHistoryStore.getState().setSelectedId('task-1');

    const state = sponsorHistoryStore.getState();
    expect(state.history.length).toBe(1);
    expect(state.historyLoading).toBe(true);
    expect(state.selectedId).toBe('task-1');

    state.resetHistory();
    expect(sponsorHistoryStore.getState().history.length).toBe(0);
    expect(sponsorHistoryStore.getState().selectedId).toBe(null);
  });
});
