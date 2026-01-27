import { sdpppSDK } from '@sdppp/common';
import { createStore } from "zustand";
import { createJSONStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";

// Re-export from workflow-provider
export {
    type Workflow,
    type WorkflowDataSource,
    type TreeNodeData,
    WorkflowListProvider,
    useWorkflowListContext
} from "./workflow-provider";

export const comfyWorkflowStore = createStore<{
    historyValues: Record<string, Record<string, any>>,
    setHistoryValues: (valuePs: Record<string, Record<string, any>>) => void
}>()(persist((set) => ({
    historyValues: {},
    setHistoryValues: (values: Record<string, Record<string, any>>) => set({ historyValues: values })
}), {
    name: 'comfy-workflow-values',
    storage: createJSONStorage(() => {
        return {
            getItem: async (key) => {
                const result = await sdpppSDK.plugins.photoshop.getStorage({ key: key });
                return result.error ? null : result.value;
            },
            setItem: (key, value) => {
                sdpppSDK.plugins.photoshop.setStorage({ key: key, value: value });
            },
            removeItem: (key) => {
                sdpppSDK.plugins.photoshop.removeStorage({ key: key });
            }
        }
    }),
    partialize: (state) => ({
        historyValues: state.historyValues
    })
}));