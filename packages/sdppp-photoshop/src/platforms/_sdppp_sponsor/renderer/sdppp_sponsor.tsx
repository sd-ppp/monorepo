import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Alert, Button, Flex, Typography, Select, Skeleton, Spin, Tabs } from 'antd';
import { createSchemaField, FormProvider } from '@formily/react';
import {
  FormItem as FormilyFormItem,
  type FormItemProps as FormilyFormItemProps,
  Input as FormilyInput,
  NumberPicker,
  Select as FormilySelect,
  Switch,
  ArrayItems,
  FormLayout,
} from '@formily/antd-v5';
import type { ISchema } from '@formily/json-schema';
import type { Form } from '@formily/core';
import { onFormValuesChange } from '@formily/core';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { ArrowLeft } from 'lucide-react';
import { SdpppWidgetUploadSelectorRouter, SdpppWidgetDeferredUploadSelector } from '@sdppp/formily-widgets';
import { SimpleWorkflowControlPanel } from '../../_comfy_frontend/renderer/components/workflow-detail/components/SimpleWorkflowControlPanel';
import { useTaskExecutor } from '../../base/useTaskExecutor';
import { useTaskExecutionStore } from '../../base/taskExecutionStore';  // 🎯 导入 store
import { sdpppSponsorStore, createTask } from '../store';
import { SDPPP_SPONSOR_RECHARGE_URL } from '../constants';
import { WrappedSdpppWidgetProvider } from '../../base/widgetable-photoshop';
import { UploadPassProvider } from '../../base/upload-pass-context';
import type { UploadPassInput } from '../../base/upload-pass-context';
import { TaskHistoryPanel } from './TaskHistoryPanel';
import { transformDeferredUploadFieldsBeforeSubmit } from '../utils/deferredUploadTransformer';
import { MainStore } from '../../../tsx/App.store';  // 🎯 添加 MainStore 导入

const { Text } = Typography;

const FormItem = (props: FormilyFormItemProps & { hidden?: boolean }) => {
  // 保持原始的 FormilyFormItem，只移除 description 和 extra
  const { description: _description, extra: _extra, hidden, ...rest } = props;
  
  // 如果有 hidden 属性，应用特殊样式
  if (hidden) {
    return (
      <div style={{ 
        position: 'absolute',
        left: '-9999px',
        width: '10px', 
        height: '10px', 
        opacity: 0.01,
        pointerEvents: 'none',
      }}>
        <FormilyFormItem {...rest} />
      </div>
    );
  }
  
  return <FormilyFormItem {...rest} />;
};

const SchemaField = createSchemaField({
  components: {
    FormItem,
    Input: FormilyInput,
    NumberPicker,
    Select: FormilySelect,
    Switch,
    ArrayItems,
    'Input.TextArea': FormilyInput.TextArea,
    FormLayout,
    SDPPPSponsorUploadSelector: SdpppWidgetUploadSelectorRouter,
    SDPPPSponsorDeferredUploadSelector: SdpppWidgetDeferredUploadSelector,
  },
});

const EMPTY_SCHEMA: ISchema = {
  type: 'object',
  properties: {},
};

// 🎯 Header 组件 - 使用 memo 隔离渲染
const SDPPPSponsorHeader = memo(function SDPPPSponsorHeader({
  authError,
  authLoading,
  ensureAuthSession,
  handleBackToComfySimple,
  loadingTemplates,
  refreshTemplates,
  handleTemplateSelect,
  templatesOptions,
  selectedTemplateId,
  t,
}: {
  authError: string | null;
  authLoading: boolean;
  ensureAuthSession: () => Promise<void>;
  handleBackToComfySimple: () => void;
  loadingTemplates: boolean;
  refreshTemplates: () => Promise<void>;
  handleTemplateSelect: (value: string) => void;
  templatesOptions: Array<{ value: string; label: string }>;
  selectedTemplateId: string;
  t: (key: string, options?: any) => string;
}) {
  console.log('[TaskRouter Perf] SDPPPSponsorHeader 渲染');
  return (
    <Flex vertical gap={8}>
      {authError ? (
        <Alert
          type="error"
          showIcon
          message={authError}
          action={
            <Button
              size="small"
              type="primary"
              onClick={() => {
                void ensureAuthSession();
              }}
              loading={authLoading}
            >
              {t('taskrouter.retry', { defaultValue: '重试' })}
            </Button>
          }
        />
      ) : null}
      <Flex gap={8} align="center">
        <Button
          icon={<ArrowLeft size={16} />}
          onClick={handleBackToComfySimple}
          disabled={authLoading}
        >
          {t('taskrouter.back', { defaultValue: '返回' })}
        </Button>
        <Select
          style={{ flex: 1 }}
          placeholder={t('taskrouter.template_placeholder', { defaultValue: '选择香蕉应用...' })}
          loading={loadingTemplates}
          onDropdownVisibleChange={(open) => {
            if (open && !loadingTemplates) {
              void refreshTemplates();
            }
          }}
          onChange={(value) => {
            if (typeof value === 'string' && value) {
              handleTemplateSelect(value);
            }
          }}
          options={templatesOptions}
          value={selectedTemplateId || undefined}
          disabled={authLoading || !!authError}
        />
      </Flex>
    </Flex>
  );
});

// 🎯 EditorContent 组件 - 使用 memo 隔离渲染
// 将依赖 progressMessage 的部分（SimpleWorkflowControlPanel）和不依赖的部分分开
const TaskRouterBalanceSection = memo(function TaskRouterBalanceSection({
  t,
  balance,
  loadingBalance,
  rechargeUrl,
  handleOpenRecharge,
  refreshBalance,
}: {
  t: (key: string, options?: any) => string;
  balance: number | null;
  loadingBalance: boolean;
  rechargeUrl: string | undefined;
  handleOpenRecharge: () => void;
  refreshBalance: () => Promise<void>;
}) {
  console.log('[TaskRouter Perf] TaskRouterBalanceSection 渲染');
  return (
    <Flex justify="space-between" align="center">
      <Flex align="center" gap={8}>
        <Text type="secondary">
          {t('taskrouter.balance', { defaultValue: '余额' })}：
          {loadingBalance ? '...' : balance ?? '--'}
        </Text>
        {rechargeUrl ? (
          <Button type="text" size="small" onClick={handleOpenRecharge}>
            {t('taskrouter.recharge', { defaultValue: '充值' })}
          </Button>
        ) : null}
      </Flex>
      <Button size="small" onClick={() => refreshBalance()} loading={loadingBalance}>
        {t('taskrouter.refresh_balance', { defaultValue: '刷新余额' })}
      </Button>
    </Flex>
  );
});

const TaskRouterFormSection = memo(function TaskRouterFormSection({
  t,
  loadingSchema,
  hasSchema,
  FormContent,
}: {
  t: (key: string, options?: any) => string;
  loadingSchema: boolean;
  hasSchema: boolean;
  FormContent: JSX.Element;
}) {
  console.log('[TaskRouter Perf] TaskRouterFormSection 渲染');
  return (
    <div style={{ overflow: 'auto', paddingRight: 4 }}>
      {loadingSchema ? (
        <Flex align="center" justify="center" style={{ minHeight: 160 }}>
          <Spin tip={t('common.loading', { defaultValue: 'Loading...' })} />
        </Flex>
      ) : hasSchema ? (
        FormContent
      ) : (
        <Alert message={t('taskrouter.no_schema', { defaultValue: '请先选择应用' })} type="info" showIcon />
      )}
    </div>
  );
});

// 🎯 独立 hook：订阅频繁变化的状态，只有使用它的组件会重渲染
const useTaskStatus = (
  executionPhase: 'idle' | 'preparing' | 'uploading' | 'validating' | 'waiting' | 'creating',
  isRunning: boolean,
  schemaError: string | null,
  t: (key: string, options?: any) => string
) => {
  // 🎯 从 store 订阅频繁变化的状态
  const progressMessage = useTaskExecutionStore(state => state.progressMessage);
  const runError = useTaskExecutionStore(state => state.runError);
  
  // 🎯 最高优先级：错误和进度消息（包括导入进度）
  if (runError) return { type: 'error' as const, message: runError };
  if (progressMessage) return { type: 'uploading' as const, message: progressMessage };
  
  // 优先显示执行阶段的状态
  if (executionPhase === 'preparing') return { type: 'uploading' as const, message: '准备中...' };
  if (executionPhase === 'uploading') return { type: 'uploading' as const, message: '上传图片中...' };
  if (executionPhase === 'validating') return { type: 'uploading' as const, message: '验证表单中...' };
  if (executionPhase === 'creating') return { type: 'uploading' as const, message: '正在创建任务...' };
  
  // 其他状态
  if (isRunning) return { type: 'uploading' as const, message: t('task.running', { defaultValue: '运行中...' }) };
  if (schemaError) return { type: 'error' as const, message: schemaError };
  return { type: 'empty' as const };
};

const TaskRouterEditorContent = memo(function TaskRouterEditorContent({
  t,
  balance,
  loadingBalance,
  rechargeUrl,
  handleOpenRecharge,
  refreshBalance,
  isExecuting,
  isRunning,
  hasSchema,
  schemaError,
  templateId,
  authLoading,
  handleRunWithSubmit,
  canCancel,
  handleCancel,
  executionPhase,
  loadingSchema,
  FormContent,
}: {
  t: (key: string, options?: any) => string;
  balance: number | null;
  loadingBalance: boolean;
  rechargeUrl: string | undefined;
  handleOpenRecharge: () => void;
  refreshBalance: () => Promise<void>;
  isExecuting: boolean;
  isRunning: boolean;
  hasSchema: boolean;
  schemaError: string | null;
  templateId: string;
  authLoading: boolean;
  handleRunWithSubmit: () => Promise<void>;
  canCancel: boolean;
  handleCancel: () => Promise<void>;
  executionPhase: 'idle' | 'preparing' | 'uploading' | 'validating' | 'waiting' | 'creating';
  loadingSchema: boolean;
  FormContent: JSX.Element;
}) {
  // 🎯 使用 hook 获取 status，只有这个组件会因 progressMessage/runError 重渲染
  const status = useTaskStatus(executionPhase, isRunning, schemaError, t);
  
  return (
    <Flex vertical gap={12}>
      <TaskRouterBalanceSection
        t={t}
        balance={balance}
        loadingBalance={loadingBalance}
        rechargeUrl={rechargeUrl}
        handleOpenRecharge={handleOpenRecharge}
        refreshBalance={refreshBalance}
      />
      <SimpleWorkflowControlPanel
        headerRight={null}
        runTooltip={t('task.execute', { defaultValue: '执行' })}
        runDisabled={isExecuting || isRunning || !hasSchema || !!schemaError || !templateId || authLoading}
        onRun={handleRunWithSubmit}
        cancelTooltip={t('task.stop', { defaultValue: '停止' })}
        canCancel={canCancel}
        onCancel={handleCancel}
        hideBoundaryControls
        status={status}
      />
      <TaskRouterFormSection
        t={t}
        loadingSchema={loadingSchema}
        hasSchema={hasSchema}
        FormContent={FormContent}
      />
    </Flex>
  );
});

export default function SDPPPSponsorRenderer() {
  const uploadResource = useCallback(
    async (resourceId: string, options?: { fileName?: string; signal?: AbortSignal }) => {
      const state = sdpppSponsorStore.getState();
      const client = state.client;
      const templateId = state.templateId;
      const recommendedUploadProvider = state.getRecommendedUploadProvider(templateId);
      if (!client) {
        throw new Error('TaskRouter 客户端未初始化');
      }
      if (!templateId) {
        throw new Error('未选择任务模板');
      }
      return client.uploadResource(templateId, resourceId, {
        fileName: options?.fileName,
        signal: options?.signal,
        uploadProviderHint: recommendedUploadProvider,
      });
    },
    [],
  );

  const taskRouterUpload = useCallback(
    async (uploadInput: UploadPassInput, signal?: AbortSignal) => {
      // 根据 type 创建临时资源
      // 这里需要根据实际的资源创建逻辑来实现
      // 暂时抛出错误，等待进一步的实现细节
      throw new Error('UploadPassProvider is not fully compatible with TaskRouter upload mechanism. Please use the uploadResource prop instead.');
    },
    [],
  );

  return (
    <UploadPassProvider uploader={taskRouterUpload}>
      <WrappedSdpppWidgetProvider uploadResource={uploadResource}>
        <SDPPPSponsorRendererInner />
      </WrappedSdpppWidgetProvider>
    </UploadPassProvider>
  );
}

function SDPPPSponsorRendererInner() {
  console.log('[TaskRouter Perf] SDPPPSponsorRendererInner 渲染');
  const { t } = useTranslation();
  const templateId = sdpppSponsorStore(state => state.templateId);
  const setTemplateId = sdpppSponsorStore(state => state.setTemplateId);
  const selectedTemplateId = sdpppSponsorStore(state => state.selectedTemplateId);
  const setSelectedTemplateId = sdpppSponsorStore(state => state.setSelectedTemplateId);
  const schema = sdpppSponsorStore(state => state.schema);
  const form = sdpppSponsorStore(state => state.form);
  const templates = sdpppSponsorStore(state => state.templates);
  const loadingTemplates = sdpppSponsorStore(state => state.loadingTemplates);
  const loadingSchema = sdpppSponsorStore(state => state.loadingSchema);
  const schemaError = sdpppSponsorStore(state => state.schemaError);
  const authError = sdpppSponsorStore(state => state.authError);
  const authLoading = sdpppSponsorStore(state => state.authLoading);
  const ensureAuthSession = sdpppSponsorStore(state => state.ensureAuthSession);
  const refreshTemplates = sdpppSponsorStore(state => state.refreshTemplates);
  const loadSchema = sdpppSponsorStore(state => state.loadSchema);
  const updateFormValues = sdpppSponsorStore(state => state.updateFormValues);
  const balance = sdpppSponsorStore(state => state.balance);
  const refreshBalance = sdpppSponsorStore(state => state.refreshBalance);
  const loadingBalance = sdpppSponsorStore(state => state.loadingBalance);
  const runningTasks = sdpppSponsorStore(state => state.runningTasks);
  const currentValues = sdpppSponsorStore(state => state.currentValues);
  const supabaseSession = sdpppSponsorStore(state => state.supabaseSession);
  const hasFetchedBalance = sdpppSponsorStore(state => state.hasFetchedBalance);
  const templateCancelable = sdpppSponsorStore(state => state.cancelable); // ✅ 获取模板的 cancelable
  const rechargeUrl = SDPPP_SPONSOR_RECHARGE_URL;

  const handleOpenRecharge = useCallback(() => {
    if (!rechargeUrl) return;
    try {
      sdpppSDK.plugins.photoshop.openExternalLink({ url: rechargeUrl });
    } catch (error) {
      console.error('[sdppp_sponsor] failed to open recharge url', error);
    }
  }, [rechargeUrl]);

  const [initialized, setInitialized] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionPhase, setExecutionPhase] = useState<'idle' | 'preparing' | 'uploading' | 'validating' | 'waiting' | 'creating'>('idle');
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const lastSchemaRequestRef = useRef<string | null>(null);
  
  // 🎯 新增：用于存储转换后的表单值，供 handleRun 使用
  const transformedValuesRef = useRef<any>(null);
  
  const templatesReady = !loadingTemplates && templates.length > 0;


  useEffect(() => {
    void (async () => {
      await ensureAuthSession();
      await refreshTemplates();
      setInitialized(true);
    })();
  }, [ensureAuthSession, refreshTemplates]);

  useEffect(() => {
    if (typeof form.addEffects === 'function' && typeof form.removeEffects === 'function') {
      form.removeEffects('taskrouter-sync');
      form.addEffects('taskrouter-sync', () => {
        onFormValuesChange(() => {
          updateFormValues(form.values);
        });
      });
      return () => {
        form.removeEffects?.('taskrouter-sync');
      };
    }
    if (typeof form.subscribe === 'function') {
      const unsubscribe = form.subscribe(({ values }) => {
        if (values) {
          updateFormValues(values);
        }
      });
      return () => {
        unsubscribe?.();
      };
    }
    return undefined;
  }, [form, updateFormValues]);

  const { handleRun, handleCancel, isRunning, canCancel } = useTaskExecutor({
    selectedModel: templateId,
    currentValues,
    getCurrentValues: () => {
      // 🎯 优先使用转换后的值，如果没有则使用表单当前值
      if (transformedValuesRef.current) {
        console.log('[TaskRouter:Submit] Using transformed values from ref');
        return transformedValuesRef.current;
      }
      console.log('[TaskRouter:Submit] Using current form values');
      return { ...form.values };
    },
    createTask,
    runningTasks,
    beforeCreateTaskHook: (values) => values,
    templateCancelable,
  });

  const handleRunWithSubmit = useCallback(async () => {
    if (isExecuting) return; // 防止重复点击
    
    console.log('[TaskRouter:Submit] Starting submission process');
    
    setIsExecuting(true);
    setExecutionPhase('preparing');
    await new Promise(resolve => setTimeout(resolve, 0));
    
    try {
      const state = sdpppSponsorStore.getState();
      const client = state.client;
      const templateId = state.templateId;
      const recommendedUploadProvider = state.getRecommendedUploadProvider(templateId);
      
      console.log('[TaskRouter:Submit] Form values before transformation:', {
        formValues: JSON.stringify(form.values, null, 2),
      });
      
      // 🎯 关键修复：在转换前先快照当前值，防止组件在转换过程中覆盖
      const valuesSnapshot = JSON.parse(JSON.stringify(form.values));
      console.log('[TaskRouter:Submit] Created values snapshot');
      
      if (client && templateId) {
        // 创建 uploadResource 函数
        const uploadResourceFn = async (resourceId: string, options?: { fileName?: string }) => {
          console.log('[TaskRouter:Submit] Uploading resource:', {
            resourceId,
            fileName: options?.fileName,
            recommendedUploadProvider,
          });
          
          const result = await client.uploadResource(templateId, resourceId, {
            fileName: options?.fileName,
            uploadProviderHint: recommendedUploadProvider,
          });
          
          console.log('[TaskRouter:Submit] Resource uploaded:', {
            resourceId,
            uploadedUrl: result,
          });
          
          return result;
        };
        
        // 🎯 阶段1：转换所有延迟上传字段（使用快照的值）
        setExecutionPhase('uploading');
        console.log('[TaskRouter:Submit] Starting deferred upload transformation');
        
        // 使用一个临时的 form-like 对象来转换快照的值
        const tempForm = {
          values: valuesSnapshot,
          setValues: (newValues: any) => {
            // 暂存转换后的值，不写回真实表单
            tempForm.values = newValues;
          }
        };
        
        await transformDeferredUploadFieldsBeforeSubmit(tempForm as any, uploadResourceFn);
        console.log('[TaskRouter:Submit] Deferred upload transformation complete');
        
        // 🎯 转换完成后，一次性写回表单
        console.log('[TaskRouter:Submit] Writing transformed values back to form');
        form.setValues(tempForm.values);
        
        // 🎯 关键：将转换后的值存储到 ref 中，供 handleRun 使用
        transformedValuesRef.current = tempForm.values;
        console.log('[TaskRouter:Submit] Stored transformed values in ref');
      }
      
      console.log('[TaskRouter:Submit] Form values after transformation:', {
        formValues: JSON.stringify(form.values, null, 2),
      });
      
      // 🎯 阶段2：表单验证
      setExecutionPhase('validating');
      console.log('[TaskRouter:Submit] Starting form validation');
      const submitResult = await form.submit();
      console.log('[TaskRouter:Submit] Form validation result:', submitResult);
      
      if (submitResult === false) {
        console.log('[TaskRouter:Submit] Form validation failed, aborting');
        setIsExecuting(false);
        setExecutionPhase('idle');
        return;
      }
      
      // 🎯 阶段3：创建任务（内部会等待 Upload Pass 和任务执行）
      setExecutionPhase('creating');
      console.log('[TaskRouter:Submit] Starting task creation with values:', {
        formValues: JSON.stringify(form.values, null, 2),
      });
      await handleRun();
      console.log('[TaskRouter:Submit] Task creation complete');
      
      // 🎯 清理 ref
      transformedValuesRef.current = null;
    } catch (error) {
      console.error('[TaskRouter:Submit] Submission failed:', error);
      setIsExecuting(false);
      setExecutionPhase('idle');
      // 🎯 出错时也清理 ref
      transformedValuesRef.current = null;
    }
  }, [form, handleRun, isExecuting]);

  const hasSchema = !!schema;
  const formSchema = schema ?? EMPTY_SCHEMA;

  const templatesOptions = useMemo(
    () => templates.map(item => ({ value: item.value, label: item.label })),
    [templates]
  );

  const isHistoryActive = activeTab === 'history';

  const handleTemplateSelect = useCallback(
    (value: string) => {
      const trimmedValue = typeof value === 'string' ? value.trim() : '';
      console.log('[TaskRouter] handleTemplateSelect called with:', trimmedValue);
      setSelectedTemplateId(trimmedValue);
      const matched = templates.find(item => item.value === trimmedValue);
      const matchedTemplateId = matched?.templateId?.trim() ?? trimmedValue;
      lastSchemaRequestRef.current = matchedTemplateId;
      console.log('[TaskRouter] Updating templateId via setTemplateId', { matchedTemplateId, templateId: trimmedValue });
      setTemplateId(matchedTemplateId);
      console.log('[TaskRouter] Triggering loadSchema from handleTemplateSelect', { matchedTemplateId, templateId: trimmedValue });
      void loadSchema(matchedTemplateId);
    },
    [loadSchema, setTemplateId, setSelectedTemplateId, templates]
  );

  useEffect(() => {
    console.log('[TaskRouter] Auto-selection effect check:', {
      initialized,
      supabaseSession: !!supabaseSession,
      templatesReady,
      loadingTemplates,
      loadingSchema,
      templateId,
      selectedTemplateId,
      firstTemplate: templates[0]?.value,
      firstTemplateLabel: templates[0]?.label,
    });

    if (!supabaseSession) return;
    if (!templatesReady) return;
    if (loadingSchema) return;
    const defaultValue = templates[0]?.value;
    if (!defaultValue) return;

    const matched = selectedTemplateId ? templates.find(item => item.value === selectedTemplateId) : null;
    if (matched) {
      const normalizedTemplateId = matched.templateId?.trim() ?? '';
      if (normalizedTemplateId && normalizedTemplateId !== templateId) {
        console.log('[TaskRouter] Syncing templateId with selected template', { normalizedTemplateId, selectedTemplateId });
        setTemplateId(normalizedTemplateId);
      } else {
        console.log('[TaskRouter] Selected template already applied, skipping auto-selection:', selectedTemplateId);
      }
      return;
    }

    console.log('[TaskRouter] Auto-selecting default template:', defaultValue);
    handleTemplateSelect(defaultValue);
  }, [
    initialized,
    supabaseSession,
    templatesReady,
    loadingTemplates,
    loadingSchema,
    templates,
    templateId,
    selectedTemplateId,
    handleTemplateSelect,
    setTemplateId,
  ]);

  useEffect(() => {
    if (!templateId) return;
    const normalizedTemplateId = templateId.trim();
    if (!normalizedTemplateId) return;
    if (schema) return;
    if (loadingSchema) return;
    const hasRetriedCurrentTemplateId = lastSchemaRequestRef.current === normalizedTemplateId;
    if (schemaError && hasRetriedCurrentTemplateId) return;

    lastSchemaRequestRef.current = normalizedTemplateId;
    void loadSchema(templateId);
  }, [initialized, templateId, schema, loadingSchema, schemaError, loadSchema, templatesReady]);

  useEffect(() => {
    if (!initialized) return;
    if (hasFetchedBalance) return;
    if (loadingBalance) return;
    if (authLoading) return;
    if (!supabaseSession) return;
    void refreshBalance();
  }, [initialized, hasFetchedBalance, loadingBalance, authLoading, supabaseSession, refreshBalance]);

  // 🎯 任务完成后恢复按钮并刷新余额
  useEffect(() => {
    // 任务完成：isExecuting=true 且 isRunning=false 且不在任何执行阶段
    if (isExecuting && !isRunning && executionPhase === 'idle') {
      setIsExecuting(false);
      void refreshBalance();
    }
  }, [isExecuting, isRunning, executionPhase, refreshBalance]);

  // 🎯 监控任务状态变化，重置执行阶段
  useEffect(() => {
    // 当任务开始运行时，清空执行阶段（因为进入任务执行阶段）
    if (isRunning && executionPhase !== 'idle') {
      setExecutionPhase('idle');
    }
  }, [isRunning, executionPhase]);

  // 使用 useMemo 缓存 FormContent，避免 progressMessage 更新时重渲染表单
  const FormContent = useMemo(() => (
    <FormProvider form={form}>
      <FormLayout layout="vertical" labelAlign="left" feedbackLayout="terse" colon={false}>
        <SchemaField schema={formSchema} />
      </FormLayout>
    </FormProvider>
  ), [form, formSchema]);

  const handleBackToComfySimple = useCallback(() => {
    MainStore.setState({ provider: 'ComfySimple' });
  }, []);

  const editorContent = useMemo(() => (
    <TaskRouterEditorContent
      t={t}
      balance={balance}
      loadingBalance={loadingBalance}
      rechargeUrl={rechargeUrl}
      handleOpenRecharge={handleOpenRecharge}
      refreshBalance={refreshBalance}
      isExecuting={isExecuting}
      isRunning={isRunning}
      hasSchema={hasSchema}
      schemaError={schemaError}
      templateId={templateId}
      authLoading={authLoading}
      handleRunWithSubmit={handleRunWithSubmit}
      canCancel={canCancel}
      handleCancel={handleCancel}
      executionPhase={executionPhase}
      // 🎯 runError 和 progressMessage 都不再通过 props 传递，由 useTaskStatus hook 订阅
      // runError={runError}  // ❌ 移除
      // progressMessage={progressMessage}  // ❌ 移除
      loadingSchema={loadingSchema}
      FormContent={FormContent}
    />
  ), [
    t,
    balance,
    loadingBalance,
    rechargeUrl,
    handleOpenRecharge,
    refreshBalance,
    isExecuting,
    isRunning,
    hasSchema,
    schemaError,
    templateId,
    authLoading,
    handleRunWithSubmit,
    canCancel,
    handleCancel,
    executionPhase,
    // 🎯 runError 和 progressMessage 都不再作为依赖，避免触发 useMemo 重新计算
    // runError,  // ❌ 移除
    // progressMessage,  // ❌ 移除
    loadingSchema,
    FormContent,
  ]);

  const historyContent = useMemo(() => (
    <TaskHistoryPanel
      initialized={initialized}
      authLoading={authLoading}
      hasSession={!!supabaseSession}
      active={isHistoryActive}
    />
  ), [initialized, authLoading, supabaseSession, isHistoryActive]);

  // 🎯 缓存 Tabs onChange 回调，避免每次渲染创建新函数
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as 'editor' | 'history');
  }, []);

  // 🎯 缓存 Tabs items，避免每次渲染创建新数组
  const tabItems = useMemo(() => [
    {
      key: 'editor',
      label: t('taskrouter.tab.editor', { defaultValue: '运行' }),
      children: editorContent,
    },
    {
      key: 'history',
      label: t('taskrouter.tab.history', { defaultValue: '历史记录' }),
      children: historyContent,
    },
  ], [t, editorContent, historyContent]);

  return (
    <Flex vertical gap={12} style={{ width: '100%' }}>
      {!initialized || authLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : null}
      <SDPPPSponsorHeader
        authError={authError}
        authLoading={authLoading}
        ensureAuthSession={ensureAuthSession}
        handleBackToComfySimple={handleBackToComfySimple}
        loadingTemplates={loadingTemplates}
        refreshTemplates={refreshTemplates}
        handleTemplateSelect={handleTemplateSelect}
        templatesOptions={templatesOptions}
        selectedTemplateId={selectedTemplateId}
        t={t}
      />
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
      />
    </Flex>
  );
}
