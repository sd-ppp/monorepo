import { AsyncOperationManager, BaseStoreState, createBaseStore, createTask as createBaseTask } from "../../base/BaseStore";
import { Task } from "../../base/Task";
import { availableModels, SDPPPReplicate } from "../client";

// replicate特有的状态接口
interface ReplicateStoreState extends BaseStoreState<SDPPPReplicate> {
    apiKey: string
    availableModels: string[]
    setApiKey: (apiKey: string) => void
    addModel: (model: string) => void
    removeModel: (model: string) => void
    resetModels: () => void
}

// 创建replicate store
export const replicateStore = createBaseStore<SDPPPReplicate, ReplicateStoreState>(
    'replicate-store-v2',
    availableModels[0],
    {
        apiKey: '',
        availableModels: [...availableModels],
        setApiKey: (apiKey) => replicateStore.setState({ apiKey }),
        addModel: (model) => {
            const state = replicateStore.getState();
            if (!state.availableModels.includes(model)) {
                const newModels = [...state.availableModels, model];
                replicateStore.setState({ availableModels: newModels });
            }
        },
        removeModel: (model) => {
            const state = replicateStore.getState();
            const newModels = state.availableModels.filter(m => m !== model);
            replicateStore.setState({ availableModels: newModels });
        },
        resetModels: () => {
            replicateStore.setState({ availableModels: [...availableModels] });
        },
    },
    (state) => ({
        apiKey: state.apiKey,
        selectedModel: state.selectedModel,
        allValues: state.allValues,
        availableModels: state.availableModels,
    })
);

// 客户端重置逻辑（每个store自己实现）
function resetClient(state: ReplicateStoreState, prevState: ReplicateStoreState) {
    if (state.apiKey && state.apiKey !== prevState.apiKey) {
        replicateStore.setState({ 
            client: new SDPPPReplicate({ apiKey: state.apiKey }) 
        });
    }
}
replicateStore.subscribe(resetClient);
resetClient(replicateStore.getState(), {} as any);

// 异步操作管理器
const asyncManager = new AsyncOperationManager();

// replicate特有的changeSelectedModel实现
export async function changeSelectedModel(selectedModel: string) {
    await asyncManager.executeWithAbort(async (abortController) => {
        const client = replicateStore.getState().client;
        if (!client) {
            return;
        }

        const widgetResult = await client.getNodes(selectedModel);

        if (abortController.signal.aborted) {
            return;
        }

        const values = replicateStore.getState().allValues[selectedModel] || widgetResult.defaultInput;

        replicateStore.setState({
            currentValues: values,
            currentNodes: widgetResult.widgetableNodes
        });
    });
}

export function isChangingModel(): boolean {
    return asyncManager.isExecuting();
}

export async function createTask<T>(modelName: string, input: Record<string, any>): Promise<Task<T>> {
    return createBaseTask(replicateStore, modelName, input);
}
