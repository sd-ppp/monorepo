import { createForm } from '@formily/core';
import type { Form } from '@formily/core';
import { sdpppSDK } from '@sdppp/common';
import { createBaseStore, createTask as createBaseTask } from '../base/BaseStore';
import type { BaseStoreState } from '../base/BaseStore';
import { SDPPPSponsor, type RemoteHistoryItem } from './client';
import {
  obtainSupabaseSession,
  registerSessionUpdateCallback,
  clearSupabaseSession,
  type SupabaseSession,
} from './supabase';
import { SDPPP_SPONSOR_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';
import type { FormilySchema } from './schemaUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSDPPPXServices,
  registerSDPPPXProvider,
  type HeadersResolver,
  type SDPPPXServices,
  type SDPPPXTemplateOption,
} from '@sdppp/sdpppx-services';

// 兼容类型别名
type SimpleSupabaseSession = SupabaseSession;

export const DEFAULT_HISTORY_PAGE_SIZE = 10;

export type TaskHistoryRecordStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskHistoryRecord = {
  id: string;
  templateId: string; // 使用 templateId，不是 locator
  templateName?: string | null; // 从数据库 JOIN 获取的模板名称
  status: TaskHistoryRecordStatus;
  message?: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  providerTaskId?: string;
  payload?: Record<string, any> | null;  // ✅ 任务输入参数
  result?: Array<{ url?: string; [key: string]: any }> | null;  // ✅ 任务结果 (用于详情)
  charge?: number;  // ✅ 扣除积分（预扣费或实际扣费）
};

const mapRemoteStatusToLocal = (status: string): TaskHistoryRecordStatus => {
  switch ((status ?? '').toLowerCase()) {
    case 'running':
    case 'processing':
    case 'active':
      return 'running';
    case 'pending':
    case 'queued':
    case 'creating':
      return 'pending';
    case 'completed':
    case 'succeeded':
      return 'completed';
    case 'failed':
    case 'errored':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const extractTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const normalizeHistoryRecord = (remote: RemoteHistoryItem): TaskHistoryRecord => {
  const createdAt = extractTimestamp(remote.enqueuedAt) ?? Date.now();
  const updatedAt = extractTimestamp(remote.updatedAt) ?? createdAt;
  const status = mapRemoteStatusToLocal(remote.status);
  let finishedAt: number | undefined;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    finishedAt =
      extractTimestamp(remote.completedAt) ??
      extractTimestamp(remote.cancelledAt) ??
      updatedAt;
  }
  return {
    id: remote.jobId,
    templateId: remote.templateId, // 直接使用 templateId
    templateName: remote.templateName ?? null,
    status,
    message: remote.message ?? null,
    createdAt,
    updatedAt,
    finishedAt,
    providerTaskId: remote.providerTaskId ?? undefined,
    payload: remote.payload ?? null,  // ✅ 传递 payload
    charge: typeof remote.charge === 'number' ? remote.charge : undefined,  // ✅ 传递 charge
  };
};

export type TemplateOption = { value: string; label: string; templateId: string };

export interface SDPPPSponsorStoreState extends BaseStoreState<SDPPPSponsor> {
  services: SDPPPXServices | null;
  templateId: string; // 改为 templateId
  selectedTemplateId: string;
  templateIdHistory: string[]; // 改为 templateIdHistory
  recommendedUploadProviders: Record<string, string>;
  schema: FormilySchema | null;
  metadata: Record<string, any> | null;
  cancelable: boolean | null; // ✅ 添加 cancelable 字段
  form: Form;
  templates: TemplateOption[];
  balance: number | null;
  loadingTemplates: boolean;
  loadingSchema: boolean;
  loadingBalance: boolean;
  authLoading: boolean;
  authError: string | null;
  schemaError: string | null;
  supabaseSession: SimpleSupabaseSession | null;
  supabaseClient: SupabaseClient | null;
  tenantId: string | null;
  hasFetchedBalance: boolean;
  history: TaskHistoryRecord[];
  historyLoading: boolean;
  historyError: string | null;
  setTemplateId: (templateId: string) => void; // 改为 setTemplateId
  setSelectedTemplateId: (templateId: string) => void;
  setServices: (services: SDPPPXServices | null) => void;
  setRecommendedUploadProvider: (templateId: string, provider: string | null) => void;
  getRecommendedUploadProvider: (templateId: string) => string | undefined;
  addTemplateIdHistory: (templateId: string) => void; // 改为 addTemplateIdHistory
  ensureAuthSession: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  loadSchema: (templateId?: string) => Promise<void>; // 改为 templateId
  updateFormValues: (values: Record<string, any>) => void;
  refreshBalance: () => Promise<void>;
  refreshHistory: (options?: { silent?: boolean; limit?: number }) => Promise<void>;
  cancelTask: (templateId: string, taskId: string) => Promise<void>; // 改为 templateId
}

type PersistedState = {
  templateId: string; // 改为 templateId
  templateIdHistory: string[]; // 改为 templateIdHistory
  selectedTemplateId: string;
};

const initialForm = createForm();

export const sdpppSponsorStore = createBaseStore<SDPPPSponsor, SDPPPSponsorStoreState>(
  'sdppp_sponsor-store',
  '',
  {
    templateId: '', // 改为 templateId
    selectedTemplateId: '',
    templateIdHistory: [], // 改为 templateIdHistory
    recommendedUploadProviders: {},
    schema: null,
    metadata: null,
    cancelable: null, // ✅ 添加 cancelable 初始值
    form: initialForm,
    services: null,
    templates: [],
    balance: null,
    loadingTemplates: false,
    loadingSchema: false,
    loadingBalance: false,
    authLoading: false,
    authError: null,
    schemaError: null,
    supabaseSession: null,
    supabaseClient: null,
    tenantId: null,
    hasFetchedBalance: false,
    history: [],
    historyLoading: false,
    historyError: null,
    setTemplateId(templateId: string) {
      const normalized = templateId.trim();
      console.log('[SDPPP Sponsor Store] setTemplateId called', { templateId: normalized });
      sdpppSponsorStore.getState().setSelectedModel(normalized);
      sdpppSponsorStore.setState({ templateId: normalized });
    },
    setSelectedTemplateId(templateId: string) {
      const normalized = templateId.trim();
      console.log('[SDPPP Sponsor Store] setSelectedTemplateId called', { templateId: normalized });
      sdpppSponsorStore.setState({ selectedTemplateId: normalized });
    },
    setServices(services) {
      sdpppSponsorStore.setState({ services });
    },
    setRecommendedUploadProvider(templateId, provider) {
      const normalizedTemplateId = templateId.trim();
      sdpppSponsorStore.setState(state => {
        const next: Record<string, string> = { ...state.recommendedUploadProviders };
        if (!normalizedTemplateId) {
          return { recommendedUploadProviders: next };
        }
        if (provider && provider.trim().length > 0) {
          next[normalizedTemplateId] = provider.trim();
        } else {
          delete next[normalizedTemplateId];
        }
        return { recommendedUploadProviders: next };
      });
    },
    getRecommendedUploadProvider(templateId) {
      const normalizedTemplateId = templateId.trim();
      if (!normalizedTemplateId) return undefined;
      return sdpppSponsorStore.getState().recommendedUploadProviders[normalizedTemplateId];
    },
    addTemplateIdHistory(templateId: string) {
      const normalized = templateId.trim();
      if (!normalized) return;
      const { templateIdHistory } = sdpppSponsorStore.getState();
      if (templateIdHistory.includes(normalized)) return;
      sdpppSponsorStore.setState({
        templateIdHistory: [...templateIdHistory, normalized].slice(-20),
      });
    },
    async ensureAuthSession() {
      const state = sdpppSponsorStore.getState();
      
      // 🔄 防止并发重复调用
      if (state.authLoading) {
        console.log('[SDPPP Sponsor Store] ensureAuthSession skipped: already loading');
        return;
      }

      // 🆕 如果已有完整的认证状态，直接返回（信任 Supabase 自动刷新）
      if (state.client && state.supabaseClient && state.supabaseSession) {
        console.log('[SDPPP Sponsor Store] ensureAuthSession: using existing session');
        return;
      }

      const baseUrl = SDPPP_SPONSOR_BASE_URL;
      const supabaseUrl = SUPABASE_URL;
      const supabaseAnonKey = SUPABASE_ANON_KEY;
      
      console.log('[SDPPP Sponsor Store] ensureAuthSession start', {
        hasClient: !!state.client,
        hasSession: !!state.supabaseSession,
        hasBaseUrl: !!baseUrl,
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseAnonKey: !!supabaseAnonKey,
      });

      // 配置检查
      if (!baseUrl || !supabaseUrl || !supabaseAnonKey) {
        const missing: string[] = [];
        if (!baseUrl) missing.push('TaskRouter 服务地址');
        if (!supabaseUrl) missing.push('Supabase URL');
        if (!supabaseAnonKey) missing.push('Supabase 匿名密钥');
        sdpppSponsorStore.setState({
          services: null,
          authError: `缺少 TaskRouter 远端配置：${missing.join('、')}。请检查远端配置后重试。`,
        });
        console.warn('[SDPPP Sponsor Store] ensureAuthSession missing remote config', { missing });
        return;
      }

      sdpppSponsorStore.setState({ authLoading: true, authError: null });
      
      try {
        // obtainSupabaseSession 内部会处理单例逻辑和自动刷新
        const { supabase, session, tenantId } = await obtainSupabaseSession();
        
        console.log('[SDPPP Sponsor Store] ensureAuthSession obtained session', {
          tenantId,
          hasAccessToken: !!session.accessToken,
          hasRefreshToken: !!session.refreshToken,
        });

        // 🔄 创建动态 header resolver，从 store 中读取最新的 session
        const resolveAuthHeaders: HeadersResolver = async () => {
          const currentSession = sdpppSponsorStore.getState().supabaseSession;
          const token = currentSession?.accessToken;
          if (!token) return { Authorization: `Bearer ${currentSession?.userId ?? session.userId}` };
          return { Authorization: `Bearer ${token}` };
        };

        // 创建 services 和 client
        const services = createSDPPPXServices({
          baseUrl,
          headers: resolveAuthHeaders,
          supabase: {
            // ✅ 支持 tenantId 参数用于模板获取
            getClient: async (tenantId?: string | null) => {
              // 模板 fetcher 可能会传入 tenantId，但由于 Photoshop 只有单个租户，
              // 我们直接返回当前的 supabase client
              return supabase;
            },
          },
        });
        
        registerSDPPPXProvider({ services, scheme: 'sdpppx' });

        const client = new SDPPPSponsor({
          baseUrl,
          headers: resolveAuthHeaders,
          services,
          // ✅ 添加 getTenantId 回调，让 InlineExecutor 动态获取 tenantId
          getTenantId: () => sdpppSponsorStore.getState().tenantId,
        });

        sdpppSponsorStore.setState({
          supabaseSession: session,
          supabaseClient: supabase,
          client,
          services,
          tenantId,
          hasFetchedBalance: false,
        });

        console.log('[SDPPP Sponsor Store] ensureAuthSession success', {
          tenantId,
          hasClient: true,
        });
      } catch (error: any) {
        console.error('[sdppp_sponsor] ensureAuthSession failed', error);
        sdpppSponsorStore.setState({
          services: null,
          authError: error?.message ?? String(error),
        });
      } finally {
        sdpppSponsorStore.setState({ authLoading: false });
      }
    },
    async refreshTemplates() {
      console.log('[SDPPP Sponsor Store] refreshTemplates called');
      const state = sdpppSponsorStore.getState();
      const supabaseClient = state.supabaseClient;
      const session = state.supabaseSession;
      console.log('[SDPPP Sponsor Store] refreshTemplates state check:', {
        hasSupabase: !!supabaseClient,
        hasSession: !!session,
        tenantId: state.tenantId,
        currentTemplateId: state.templateId,
      });

      if (!supabaseClient || !session) {
        console.log('[SDPPP Sponsor Store] Missing client or session, ensuring auth...');
        await sdpppSponsorStore.getState().ensureAuthSession();
      }
      const refreshed = sdpppSponsorStore.getState();
      if (!refreshed.supabaseClient || !refreshed.supabaseSession) {
        console.log('[SDPPP Sponsor Store] Still missing Supabase client or session after auth attempt');
        return;
      }
      if (!refreshed.services) {
        console.log('[SDPPP Sponsor Store] Missing TaskRouter services after auth attempt');
        sdpppSponsorStore.setState({
          authError: '尚未初始化 TaskRouter 服务，请重试',
        });
        return;
      }
      sdpppSponsorStore.setState({ loadingTemplates: true });
      try {
        console.log('[SDPPP Sponsor Store] Fetching templates via sdpppx services...');
        const response = await refreshed.services.fetchTemplates(undefined, {
          tenantId: refreshed.tenantId ?? undefined,
        });
        const templates =
          response.items
            ?.map((item: SDPPPXTemplateOption) => {
              const templateId =
                typeof item.value === 'string' && item.value.trim().length > 0
                  ? item.value.trim()
                  : '';
              if (!templateId) {
                return null;
              }
              const label =
                typeof item.label === 'string' && item.label.trim().length > 0
                  ? item.label.trim()
                  : templateId;
              return {
                value: templateId,
                label,
                templateId, // \u76f4\u63a5\u4f7f\u7528 templateId
              } as TemplateOption;
            })
            .filter((entry): entry is TemplateOption => !!entry) ?? [];
        console.log('[SDPPP Sponsor Store] Templates fetched via services:', templates);

        const currentSelectedId = refreshed.selectedTemplateId;
        let resolvedTemplateId = refreshed.templateId?.trim() ?? '';
        let resolvedSelectedId = currentSelectedId;
        if (currentSelectedId) {
          const matched = templates.find(item => item.value === currentSelectedId);
          if (matched) {
            resolvedTemplateId = matched.templateId?.trim() ?? '';
          } else {
            resolvedTemplateId = '';
            resolvedSelectedId = '';
          }
        }
        sdpppSponsorStore.getState().setSelectedModel(resolvedTemplateId);
        sdpppSponsorStore.setState({
          templates,
          templateId: resolvedTemplateId,
          selectedTemplateId: resolvedSelectedId,
        });
      } catch (error: any) {
        console.error('[sdppp_sponsor] refreshTemplates failed', error);
        sdpppSponsorStore.setState({
          authError: error?.message ?? String(error),
        });
      } finally {
        sdpppSponsorStore.setState({ loadingTemplates: false });
      }
    },
    async loadSchema(templateId?: string) {
      const targetTemplateId = (templateId ?? sdpppSponsorStore.getState().templateId).trim();
      console.log('[SDPPP Sponsor Store] loadSchema called with:', { templateId, targetTemplateId });

      if (!targetTemplateId) {
        console.log('[SDPPP Sponsor Store] No target templateId, setting schema error');
        sdpppSponsorStore.setState({ schemaError: '请先选择应用' });
        return;
      }

      const state = sdpppSponsorStore.getState();
      console.log('[SDPPP Sponsor Store] loadSchema state check:', {
        hasClient: !!state.client,
        currentSchema: !!state.schema,
        loadingSchema: state.loadingSchema,
      });

      if (!state.client) {
        console.log('[SDPPP Sponsor Store] No client, ensuring auth...');
        await sdpppSponsorStore.getState().ensureAuthSession();
      }
      const refreshed = sdpppSponsorStore.getState();
      if (!refreshed.client) {
        console.log('[SDPPP Sponsor Store] Still no client after auth attempt');
        return;
      }

      const form = sdpppSponsorStore.getState().form;
      form.reset();
      form.setInitialValues({});
      form.setValues({});
      sdpppSponsorStore.setState({
        loadingSchema: true,
        schemaError: null,
        schema: null,
        metadata: null,
        currentValues: {},
      });

      try {
        console.log('[SDPPP Sponsor Store] Fetching schema for:', targetTemplateId);
        const result = await refreshed.client.getNodes(targetTemplateId);
        const schema = result.rawData.schema;
        const values = result.rawData.values ?? {};
        const recommendedUploadProvider = result.rawData.recommendedUploadProvider;
        const cancelable = result.rawData.cancelable; // ✅ 获取 cancelable
        console.log('[SDPPP Sponsor Store] Schema fetched successfully:', {
          schema: !!schema,
          valueKeys: Object.keys(values ?? {}),
          cancelable, // ✅ 打印 cancelable
        });

        form.setInitialValues(values);
        form.setValues(values);
        sdpppSponsorStore.setState({
          templateId: targetTemplateId,
          schema,
          metadata: result.rawData.metadata ?? null,
          cancelable: cancelable ?? null, // ✅ 存储 cancelable
          currentValues: values,
        });
        sdpppSponsorStore
          .getState()
          .setRecommendedUploadProvider(
            targetTemplateId,
            typeof recommendedUploadProvider === 'string' ? recommendedUploadProvider : null
          );
        sdpppSponsorStore.getState().setSelectedModel(targetTemplateId);
        sdpppSponsorStore.getState().addTemplateIdHistory(targetTemplateId);
        console.log('[SDPPP Sponsor Store] loadSchema state updated', {
          templateId: targetTemplateId,
          hasSchema: true,
        });
      } catch (error: any) {
        console.error('[sdppp_sponsor] loadSchema failed', error);
        sdpppSponsorStore.setState({
          schemaError: error?.message ?? String(error),
        });
      } finally {
        sdpppSponsorStore.setState({ loadingSchema: false });
      }
    },
    updateFormValues(values: Record<string, any>) {
      sdpppSponsorStore.setState({ currentValues: values });
    },
    async refreshBalance() {
      const state = sdpppSponsorStore.getState();
      if (!state.client || !state.supabaseSession) {
        await sdpppSponsorStore.getState().ensureAuthSession();
      }
      const refreshed = sdpppSponsorStore.getState();
      if (!refreshed.client || !refreshed.supabaseSession) return;
      sdpppSponsorStore.setState({ loadingBalance: true, hasFetchedBalance: true });
      try {
        const data = await refreshed.client.fetchBalance();
        sdpppSponsorStore.setState({
          balance: typeof data.balance === 'number' ? data.balance : null,
        });
      } catch (error: any) {
        console.error('[sdppp_sponsor] refreshBalance failed', error);
        sdpppSponsorStore.setState({
          authError: error?.message ?? String(error),
        });
      } finally {
        sdpppSponsorStore.setState({ loadingBalance: false });
      }
    },
    async refreshHistory(options?: { silent?: boolean; limit?: number }) {
      const { silent = false, limit = DEFAULT_HISTORY_PAGE_SIZE } = options ?? {};
      const state = sdpppSponsorStore.getState();
      if (!state.client || !state.supabaseSession) {
        await sdpppSponsorStore.getState().ensureAuthSession();
      }
      const refreshed = sdpppSponsorStore.getState();
      if (!refreshed.client) {
        if (!silent) {
          sdpppSponsorStore.setState({ historyLoading: false });
        }
        return;
      }
      if (!silent) {
        sdpppSponsorStore.setState({ historyLoading: true, historyError: null });
      } else {
        sdpppSponsorStore.setState({ historyError: null });
      }
      try {
        const data = await refreshed.client.fetchHistory({ limit });
        const items = data.items ?? [];
        const normalized = items
          .filter(item => item && typeof item.jobId === 'string' && typeof item.templateId === 'string')
          .map(normalizeHistoryRecord)
          .sort((a, b) => b.createdAt - a.createdAt);
        sdpppSponsorStore.setState({
          history: normalized,
        });
      } catch (error: any) {
        console.error('[sdppp_sponsor] refreshHistory failed', error);
        sdpppSponsorStore.setState({
          historyError: error?.message ?? String(error),
        });
      } finally {
        if (!silent) {
          sdpppSponsorStore.setState({ historyLoading: false });
        }
      }
    },
    async cancelTask(templateId: string, taskId: string) {
      const normalizedTemplateId = (templateId ?? '').trim();
      const normalizedTaskId = (taskId ?? '').trim();
      if (!normalizedTemplateId || !normalizedTaskId) {
        throw new Error('缺少任务标识，无法取消任务');
      }
      let client = sdpppSponsorStore.getState().client;
      if (!client) {
        await sdpppSponsorStore.getState().ensureAuthSession();
        client = sdpppSponsorStore.getState().client;
      }
      if (!client) {
        throw new Error('TaskRouter 客户端未初始化');
      }
      try {
        await client.cancelTask(normalizedTemplateId, normalizedTaskId);
        await sdpppSponsorStore.getState().refreshHistory({
          silent: true,
          limit: DEFAULT_HISTORY_PAGE_SIZE,
        });
      } catch (error) {
        console.error('[sdppp_sponsor] cancelTask failed', error);
        throw error;
      }
    },
  },
  (state) => {
    const persisted: PersistedState = {
      templateId: state.templateId,
      templateIdHistory: state.templateIdHistory,
      selectedTemplateId: state.selectedTemplateId,
    };
    return persisted;
  }
);

// 🆕 注册 Supabase 会话更新回调
registerSessionUpdateCallback((session) => {
  if (session) {
    console.log('[SDPPP Sponsor Store] Supabase session updated');
    sdpppSponsorStore.setState({ supabaseSession: session });
  } else {
    console.log('[SDPPP Sponsor Store] Supabase session cleared');
    sdpppSponsorStore.setState({
      supabaseSession: null,
      supabaseClient: null,
      client: null,
      services: null,
    });
  }
});

// 🆕 监听 Authing token 变化（用户登出时清理 Supabase 会话）
let previousAuthingToken: string | null = null;

sdpppSDK.stores.PhotoshopStore.subscribe((state, prevState) => {
  const currentToken = state.token || null;
  const prevToken = previousAuthingToken;

  // Token 变化检测
  if (currentToken !== prevToken) {
    console.log('[SDPPP Sponsor Store] Authing token changed', {
      hadToken: !!prevToken,
      hasToken: !!currentToken,
    });

    // 如果之前有 token 但现在没有了，说明用户登出
    if (prevToken && !currentToken) {
      console.log('[SDPPP Sponsor Store] User logged out, clearing Supabase session');
      clearSupabaseSession();
      sdpppSponsorStore.setState({
        supabaseSession: null,
        supabaseClient: null,
        client: null,
        services: null,
        authError: null,
      });
    }

    previousAuthingToken = currentToken;
  }
});

// 初始化 previousAuthingToken
previousAuthingToken = sdpppSDK.stores.PhotoshopStore.getState().token || null;

export async function createTask(loc: string, payload: Record<string, any>) {
  const task = await createBaseTask(sdpppSponsorStore, loc, payload);
  return task;
}
