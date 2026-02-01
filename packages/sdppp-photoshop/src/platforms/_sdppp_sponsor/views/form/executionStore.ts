import { create } from 'zustand';
import type { Task } from '../../../base/Task';

export type ExecutionPhase = 'idle' | 'preparing' | 'uploading' | 'validating' | 'waiting' | 'creating';

export type SponsorExecutionState = {
  isExecuting: boolean;
  executionPhase: ExecutionPhase;
  runningTasks: Task<any>[];
  setIsExecuting: (executing: boolean) => void;
  setExecutionPhase: (phase: ExecutionPhase) => void;
  setRunningTasks: (tasks: Task<any>[]) => void;
  resetExecution: () => void;
};

const initialState = {
  isExecuting: false,
  executionPhase: 'idle' as ExecutionPhase,
  runningTasks: [],
};

export const sponsorExecutionStore = create<SponsorExecutionState>((set) => ({
  ...initialState,
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  setExecutionPhase: (executionPhase) => set({ executionPhase }),
  setRunningTasks: (runningTasks) => set({ runningTasks }),
  resetExecution: () => set({ ...initialState }),
}));
