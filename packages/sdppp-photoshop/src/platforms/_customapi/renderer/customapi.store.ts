import { SDPPPCustomAPI } from "../client";
import { BaseStoreState, createBaseStore, AsyncOperationManager, createTask as createBaseTask } from "../../base/BaseStore";
import { sdpppSDK } from "@sdppp/common";

// CustomAPI（Google/OpenAI）特有的状态接口
interface CustomAPIStoreState extends BaseStoreState<SDPPPCustomAPI> {
    format: 'google' | 'openai'
    apiKey: string
    baseURL: string
    setFormat: (format: 'google' | 'openai') => void
    setApiKey: (apiKey: string) => void
    setBaseURL: (baseURL: string) => void
}

// 创建CustomAPI store
export const customapiStore = createBaseStore<SDPPPCustomAPI, CustomAPIStoreState>(
    'customapi-store',
    'gemini-2.5-flash-image-preview',
    {
        format: 'google',
        apiKey: '',
        baseURL: '',
        setFormat: (format) => customapiStore.setState({ format }),
        setApiKey: (apiKey) => customapiStore.setState({ apiKey: (apiKey ?? '').toString() }),
        setBaseURL: (baseURL) => customapiStore.setState({ baseURL: (baseURL ?? '').toString() }),
    },
    (state) => ({
        format: state.format,
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        selectedModel: state.selectedModel,
        allValues: state.allValues,
    })
);

// 客户端重置逻辑
async function resetClient(state: CustomAPIStoreState, prevState: CustomAPIStoreState) {
    const changed = (
        state.apiKey !== prevState.apiKey ||
        state.baseURL !== prevState.baseURL ||
        state.format !== prevState.format
    );
    if (changed) {
        const hasKey = typeof state.apiKey === 'string' && state.apiKey.trim().length > 0;
        const hasBase = typeof state.baseURL === 'string' && state.baseURL.trim().length > 0;
        if (hasKey && hasBase) {
            // sdpppSDK.plugins.fetchProxy.registerProxyDomains(state.baseURL.split('/').filter(Boolean)[1]);
            // sdpppSDK.logger('registerProxyDomains', state.baseURL.split('/').filter(Boolean)[1]);
            const client = new SDPPPCustomAPI({ apiKey: state.apiKey, baseURL: state.baseURL, format: state.format });
            customapiStore.setState({ client });
        } else {
            // Missing required params, clear client
            customapiStore.setState({ client: null as any });
        }
    }
}
customapiStore.subscribe(resetClient);
resetClient(customapiStore.getState(), {} as any);

// 异步操作管理器
const asyncManager = new AsyncOperationManager();

// Google特有的changeSelectedModel实现
export async function changeSelectedModel(model: string) {
    await asyncManager.executeWithAbort(async (abortController) => {
        const client = customapiStore.getState().client;
        if (!client) {
            return;
        }

        const nodeResult = await client.getNodes(model);

        if (abortController.signal.aborted) {
            return;
        }

        const values = customapiStore.getState().allValues[model] || nodeResult.defaultInput;

        customapiStore.setState({
            currentValues: values,
            currentNodes: nodeResult.widgetableNodes,
            selectedModel: model,
        });
    });
}

export function isChangingModel(): boolean {
    return asyncManager.isExecuting();
}

export async function createTask(model: string, input: Record<string, any>) {
    return createBaseTask(customapiStore, model, input);
}
