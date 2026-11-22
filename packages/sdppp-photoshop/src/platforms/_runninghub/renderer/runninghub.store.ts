import { getCurrentLanguage } from "@sdppp/common";
import { SDPPPRunningHub } from "../client";
import type { RunningHubSite } from "../client";
import { BaseStoreState, createBaseStore, AsyncOperationManager, createTask as createBaseTask } from "../../base/BaseStore";
import { MainStore } from "../../../tsx/App.store";
import { sponsorAuthStore } from "../../_sdppp_sponsor/views/auth/authStore";

type WebappHistoryItem = { webappId: string; appName: string }

// 每个站点独立保存的数据（密钥 / 已用应用 / 各应用输入值）
interface RunningHubSiteSnapshot {
    apiKey: string
    webappHistory: WebappHistoryItem[]
    allValues: Record<string, Record<string, any>>
}

function createEmptySiteSnapshot(): RunningHubSiteSnapshot {
    return { apiKey: '', webappHistory: [], allValues: {} };
}

function createInitialSiteSnapshots(): Record<RunningHubSite, RunningHubSiteSnapshot> {
    return {
        cn: createEmptySiteSnapshot(),
        ai: createEmptySiteSnapshot(),
    };
}

// 默认站点保持原有行为：界面语言为英文时使用海外站，否则使用国内站
const defaultSite: RunningHubSite = getCurrentLanguage() === 'en-US' ? 'ai' : 'cn';

// RunningHub特有的状态接口
interface RunningHubStoreState extends BaseStoreState<SDPPPRunningHub> {
    apiKey: string
    site: RunningHubSite
    siteSnapshots: Record<RunningHubSite, RunningHubSiteSnapshot>
    useSponsorDeduction: boolean
    webappId: string
    currentNodeInfoList: any[]
    accountStatus: {
        remainCoins: number
        remainPoint?: number | null
        hasRemainPoint?: boolean
        currentTaskCounts: number
    } | null
    appName: string
    webappHistory: WebappHistoryItem[]
    setApiKey: (apiKey: string) => void
    setSite: (site: RunningHubSite) => void
    setUseSponsorDeduction: (useSponsorDeduction: boolean) => void
    setWebappId: (webappId: string) => void
    setAccountStatus: (status: { remainCoins: number; remainPoint?: number | null; hasRemainPoint?: boolean; currentTaskCounts: number } | null) => void
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
        site: defaultSite,
        siteSnapshots: createInitialSiteSnapshots(),
        useSponsorDeduction: false,
        webappId: '',
        currentNodeInfoList: [],
        accountStatus: null,
        appName: '',
        webappHistory: [],
        setApiKey: (apiKey) => {
            const state = runninghubStore.getState();
            const currentSnapshot = state.siteSnapshots[state.site] ?? createEmptySiteSnapshot();
            runninghubStore.setState({
                apiKey,
                siteSnapshots: {
                    ...state.siteSnapshots,
                    [state.site]: { ...currentSnapshot, apiKey },
                },
            });
        },
        setSite: (site) => {
            const state = runninghubStore.getState();
            if (state.site === site) return;

            // 先把当前站点的数据快照下来，再加载目标站点的数据
            const siteSnapshots: Record<RunningHubSite, RunningHubSiteSnapshot> = {
                ...state.siteSnapshots,
                [state.site]: {
                    apiKey: state.apiKey,
                    webappHistory: state.webappHistory,
                    allValues: state.allValues,
                },
            };
            const target = siteSnapshots[site] ?? createEmptySiteSnapshot();

            runninghubStore.setState({
                site,
                siteSnapshots,
                apiKey: target.apiKey,
                webappHistory: target.webappHistory,
                allValues: target.allValues,
                // 切换站点时清空当前应用选择，避免用另一站的应用 ID 加载
                webappId: '',
                appName: '',
                selectedModel: '',
                currentValues: {},
                currentNodes: [],
                currentNodeInfoList: [],
                accountStatus: null,
            });
        },
        setUseSponsorDeduction: (useSponsorDeduction) => runninghubStore.setState({ useSponsorDeduction }),
        setWebappId: (webappId) => runninghubStore.setState({ webappId }),
        setAccountStatus: (accountStatus) => runninghubStore.setState({ accountStatus }),
        setAppName: (appName) => runninghubStore.setState({ appName }),
        addWebappHistory: (webappId, appName) => {
            const state = runninghubStore.getState();
            const existing = state.webappHistory.find(item => item.webappId === webappId);
            if (!existing) {
                const newHistory = [...state.webappHistory, { webappId, appName }];
                runninghubStore.setState({ webappHistory: newHistory });
                return;
            }
            if (existing.appName !== appName && appName) {
                const newHistory = state.webappHistory.map(item =>
                    item.webappId === webappId ? { ...item, appName } : item
                );
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
        site: state.site,
        siteSnapshots: state.siteSnapshots,
        useSponsorDeduction: state.useSponsorDeduction,
        webappId: state.webappId,
        selectedModel: state.selectedModel,
        allValues: state.allValues,
        webappHistory: state.webappHistory,
    })
);

// 客户端重置逻辑
async function resetClient(state: RunningHubStoreState, prevState: RunningHubStoreState) {
    const useSponsorDeduction = state.useSponsorDeduction;
    const apiKeyChanged = state.apiKey !== prevState.apiKey;
    const sponsorChanged = state.useSponsorDeduction !== prevState.useSponsorDeduction;
    const siteChanged = state.site !== prevState.site;

    if ((state.apiKey || useSponsorDeduction) && (apiKeyChanged || sponsorChanged || siteChanged || !state.client)) {
        const client = new SDPPPRunningHub({
            apiKey: state.apiKey,
            site: state.site,
            useSponsorDeduction: () => runninghubStore.getState().useSponsorDeduction,
            getSponsorServices: () => sponsorAuthStore.getState().services,
            getSponsorTenantId: () => sponsorAuthStore.getState().tenantId,
        });
        runninghubStore.setState({ client });

        // 获取账户状态 - 使用 setTimeout 避免在同一个 setState 调用中再次调用 setState
        setTimeout(async () => {
            if (runninghubStore.getState().useSponsorDeduction) {
                stopExecutingRefresh();
                stopIdleRefresh();
                runninghubStore.setState({ accountStatus: null });
                return;
            }
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
    } else if (!state.apiKey && !useSponsorDeduction && (prevState.apiKey || prevState.useSponsorDeduction || siteChanged || state.client)) {
        // API key 被清空或切换站点后没有可用 key 时，停止所有刷新并清空账户状态
        stopExecutingRefresh();
        stopIdleRefresh();
        runninghubStore.setState({ accountStatus: null, client: null });
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

    if (state.useSponsorDeduction !== prevState.useSponsorDeduction && state.webappId) {
        const previousValues = state.currentValues;
        void changeSelectedModel(state.webappId, { previousValues });
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
export async function changeSelectedModel(webappId: string, options?: { previousValues?: Record<string, any> }) {
    await asyncManager.executeWithAbort(async (abortController) => {
        const client = runninghubStore.getState().client;
        if (!client) {
            return;
        }

        const nodeResult = await client.getNodes(webappId);

        if (abortController.signal.aborted) {
            return;
        }

        const currentValues = options?.previousValues ?? runninghubStore.getState().allValues[webappId];
        const values = mergeValues(nodeResult.defaultInput, currentValues);
        const metaTitle =
            typeof nodeResult.rawData?.metadata?.title === 'string' &&
            nodeResult.rawData.metadata.title !== webappId
                ? nodeResult.rawData.metadata.title
                : '';
        const appName =
            nodeResult.rawData?.data?.webappName ||
            nodeResult.rawData?.metadata?.rawData?.data?.webappName ||
            nodeResult.rawData?.metadata?.rawData?.data?.webAppName ||
            nodeResult.rawData?.metadata?.rawData?.data?.name ||
            nodeResult.rawData?.metadata?.webappName ||
            nodeResult.rawData?.metadata?.providerMetadata?.runninghub?.webappName ||
            metaTitle ||
            (runninghubStore.getState().webappId === webappId ? runninghubStore.getState().appName : '') ||
            '';

        const nodeInfoList =
            nodeResult.rawData?.data?.nodeInfoList ||
            nodeResult.rawData?.metadata?.rawData?.data?.nodeInfoList ||
            [];

        runninghubStore.setState({
            currentValues: values,
            currentNodes: nodeResult.widgetableNodes,
            currentNodeInfoList: nodeInfoList,
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

function mergeValues(defaultInput: Record<string, any>, previousValues?: Record<string, any>) {
    if (!previousValues) {
        return defaultInput;
    }

    const merged: Record<string, any> = {};
    Object.keys(defaultInput).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(previousValues, key) && previousValues[key] !== undefined) {
            merged[key] = previousValues[key];
        } else {
            merged[key] = defaultInput[key];
        }
    });
    return merged;
}

export function isChangingModel(): boolean {
    return asyncManager.isExecuting();
}

export async function createTask(webappId: string, input: Record<string, any>) {
    return createBaseTask(runninghubStore, webappId, input);
}
