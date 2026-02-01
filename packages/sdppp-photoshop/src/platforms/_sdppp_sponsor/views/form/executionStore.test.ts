import { describe, expect, it, beforeEach } from 'vitest';
import { sponsorExecutionStore } from './executionStore';

describe('sponsorExecutionStore', () => {
  beforeEach(() => {
    sponsorExecutionStore.getState().resetExecution();
  });

  it('updates execution state', () => {
    sponsorExecutionStore.getState().setIsExecuting(true);
    sponsorExecutionStore.getState().setExecutionPhase('uploading');
    sponsorExecutionStore.getState().setRunningTasks([{} as any]);

    const state = sponsorExecutionStore.getState();
    expect(state.isExecuting).toBe(true);
    expect(state.executionPhase).toBe('uploading');
    expect(state.runningTasks.length).toBe(1);
  });
});
