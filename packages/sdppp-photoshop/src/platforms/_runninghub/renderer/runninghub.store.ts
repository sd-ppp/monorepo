import { SDPPPRunningHub } from "../client";
import { BaseStoreState, createBaseStore, AsyncOperationManager, createTask as createBaseTask } from "../../base/BaseStore";
import { MainStore } from "../../../tsx/App.store";

// RunningHub特有的状态接口
interface RunningHubStoreState extends BaseStoreState<SDPPPRunningHub> {
    apiKey: string
    webappId: string
    currentNodeInfoList: any[]
    accountStatus: {
        remainCoins: number
        currentTaskCounts: number
    } | null
    appName: string
    webappHistory: Array<{ webappId: string; appName: string }>
    setApiKey: (apiKey: string) => void
    setWebappId: (webappId: string) => void
    setAccountStatus: (status: { remainCoins: number; currentTaskCounts: number } | null) => void
    setAppName: (appName: string) => void
    addWebappHistory: (webappId: string, appName: string) => void
    removeWebappHistory: (webappId: string) => void
}

// 创建RunningHub store
export const runninghubStore = createBaseStore<SDPPPRunningHub, RunningHubStoreState>(
    'runninghub-store',
    '',
    {
        apiKey: '',
        webappId: '',
        currentNodeInfoList: [],
        accountStatus: null,
        appName: '',
        webappHistory: [],
        setApiKey: (apiKey) => runninghubStore.setState({ apiKey }),
        setWebappId: (webappId) => runninghubStore.setState({ webappId }),
        setAccountStatus: (accountStatus) => runninghubStore.setState({ accountStatus }),
        setAppName: (appName) => runninghubStore.setState({ appName }),
        addWebappHistory: (webappId, appName) => {
            const state = runninghubStore.getState();
            const existing = state.webappHistory.find(item => item.webappId === webappId);
            if (!existing) {
                const newHistory = [...state.webappHistory, { webappId, appName }];
                runninghubStore.setState({ webappHistory: newHistory });
            }
        },
        removeWebappHistory: (webappId) => {
            const state = runninghubStore.getState();
            const newHistory = state.webappHistory.filter(item => item.webappId !== webappId);
            runninghubStore.setState({ webappHistory: newHistory });
        },
    },
    (state) => ({
        apiKey: state.apiKey,
        webappId: state.webappId,
        selectedModel: state.selectedModel,
        allValues: state.allValues,
        webappHistory: state.webappHistory,
    })
);

// 客户端重置逻辑
async function resetClient(state: RunningHubStoreState, prevState: RunningHubStoreState) {
    if (state.apiKey && (state.apiKey !== prevState.apiKey)) {
        const client = new SDPPPRunningHub({ apiKey: state.apiKey });
        runninghubStore.setState({ client });
        
        // 获取账户状态 - 使用 setTimeout 避免在同一个 setState 调用中再次调用 setState
        setTimeout(async () => {
            // 只有当runninghub是当前provider时才轮询账户状态
            if (MainStore.getState().provider !== 'RunningHub') {
                return;
            }
            
            try {
                const accountStatus = await client.getAccountStatus();
                runninghubStore.setState({ accountStatus });
                // 启动闲置状态刷新（如果没有运行任务）
                if (runninghubStore.getState().runningTasks.length === 0) {
                    startIdleRefresh();
                }
            } catch (error) {
                console.error('Failed to fetch account status:', error);
                runninghubStore.setState({ accountStatus: null });
            }
        }, 0);
    } else if (!state.apiKey && prevState.apiKey) {
        // API key 被清空时，停止所有刷新并清空账户状态
        stopExecutingRefresh();
        stopIdleRefresh();
        runninghubStore.setState({ accountStatus: null });
    }
}
runninghubStore.subscribe(resetClient);
resetClient(runninghubStore.getState(), {} as any);

// 监控运行任务状态，自动管理账户状态刷新
runninghubStore.subscribe((state, prevState) => {
    // 当任务数量从0变为>0时，启动执行期间刷新，停止闲置刷新
    if (prevState.runningTasks.length === 0 && state.runningTasks.length > 0) {
        stopIdleRefresh();
        startExecutingRefresh();
    }
    // 当任务数量从>0变为0时，启动闲置刷新，停止执行期间刷新
    else if (prevState.runningTasks.length > 0 && state.runningTasks.length === 0) {
        stopExecutingRefresh();
        startIdleRefresh();
    }
});

// 异步操作管理器
const asyncManager = new AsyncOperationManager();

// 账户状态刷新定时器
let executingRefreshInterval: NodeJS.Timeout | null = null;
let idleRefreshInterval: NodeJS.Timeout | null = null;

// 启动执行期间账户状态刷新（5秒间隔）
function startExecutingRefresh() {
    if (executingRefreshInterval) return; // 已经在运行中
    
    executingRefreshInterval = setInterval(async () => {
        const state = runninghubStore.getState();
        const { client, runningTasks } = state;
        
        // 只有在runninghub是当前provider、有运行任务且有客户端时才刷新
        if (MainStore.getState().provider === 'RunningHub' && client && runningTasks.length > 0) {
            try {
                const accountStatus = await client.getAccountStatus();
                runninghubStore.setState({ accountStatus });
            } catch (error) {
                console.error('Failed to refresh account status during task execution:', error);
            }
        } else {
            // 没有运行任务或不是当前provider时停止执行期间刷新
            stopExecutingRefresh();
        }
    }, 5000);
}

// 启动闲置状态账户状态刷新（30秒间隔）
function startIdleRefresh() {
    if (idleRefreshInterval) return; // 已经在运行中
    
    idleRefreshInterval = setInterval(async () => {
        const state = runninghubStore.getState();
        const { client, runningTasks } = state;
        
        // 只有在runninghub是当前provider、没有运行任务且有客户端时才刷新
        if (MainStore.getState().provider === 'RunningHub' && client && runningTasks.length === 0) {
            try {
                const accountStatus = await client.getAccountStatus();
                runninghubStore.setState({ accountStatus });
            } catch (error) {
                console.error('Failed to refresh account status during idle:', error);
            }
        } else {
            // 有运行任务或不是当前provider时停止闲置刷新
            stopIdleRefresh();
        }
    }, 30000);
}

// 停止执行期间刷新
function stopExecutingRefresh() {
    if (executingRefreshInterval) {
        clearInterval(executingRefreshInterval);
        executingRefreshInterval = null;
    }
}

// 停止闲置状态刷新
function stopIdleRefresh() {
    if (idleRefreshInterval) {
        clearInterval(idleRefreshInterval);
        idleRefreshInterval = null;
    }
}

// RunningHub特有的changeSelectedModel实现（这里实际上是changeWebApp）
export async function changeSelectedModel(webappId: string) {
    await asyncManager.executeWithAbort(async (abortController) => {
        const client = runninghubStore.getState().client;
        if (!client) {
            return;
        }

        const nodeResult = await client.getNodes(webappId);

        if (abortController.signal.aborted) {
            return;
        }

        const values = runninghubStore.getState().allValues[webappId] || nodeResult.defaultInput;
        const appName = nodeResult.rawData?.data?.webappName || '';

        runninghubStore.setState({
            currentValues: values,
            currentNodes: nodeResult.widgetableNodes,
            currentNodeInfoList: nodeResult.rawData.data.nodeInfoList || [],
            selectedModel: webappId,
            webappId: webappId,
            appName: appName
        });

        // 添加到历史记录
        if (appName) {
            const { addWebappHistory } = runninghubStore.getState();
            addWebappHistory(webappId, appName);
        }
    });
}

export function isChangingModel(): boolean {
    return asyncManager.isExecuting();
}

export async function createTask(webappId: string, input: Record<string, any>) {
    return createBaseTask(runninghubStore, webappId, input);
}