import { create } from 'zustand';

interface TaskExecutionState {
    // 进度相关
    progressMessage: string;
    lastStartTime: number;
    isRunning: boolean;
    isImporting: boolean;
    currentTask: any | null;
    
    // 错误相关
    runError: string;
    
    // Actions
    setProgressMessage: (message: string) => void;
    setLastStartTime: (time: number) => void;
    setIsRunning: (running: boolean) => void;
    setIsImporting: (importing: boolean) => void;
    setCurrentTask: (task: any | null) => void;
    setRunError: (error: string) => void;
    reset: () => void;
}

const initialState = {
    progressMessage: '',
    lastStartTime: 0,
    isRunning: false,
    isImporting: false,
    currentTask: null,
    runError: '',
};

export const useTaskExecutionStore = create<TaskExecutionState>((set) => ({
    ...initialState,
    
    setProgressMessage: (message: string) => set({ progressMessage: message }),
    setLastStartTime: (time: number) => set({ lastStartTime: time }),
    setIsRunning: (running: boolean) => set({ isRunning: running }),
    setIsImporting: (importing: boolean) => set({ isImporting: importing }),
    setCurrentTask: (task: any | null) => set({ currentTask: task }),
    setRunError: (error: string) => set({ runError: error }),
    
    reset: () => set(initialState),
}));
