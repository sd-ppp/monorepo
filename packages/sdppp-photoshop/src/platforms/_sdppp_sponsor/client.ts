import { Client } from '../base/Client';
import { Task } from '../base/Task';
import type { WidgetableNode } from '@sdppp/common/schemas/schemas';
import type { DescribeResult } from '@sdppp/pptask';
import { createInlineExecutor } from '@sdppp/pptask/executors/inline';
import type { InlineExecutor, InlineExecutorConfig } from '@sdppp/pptask/executors/inline';
import {
  type HeadersResolver,
  type SDPPPXRemoteHistoryItem,
  type SDPPPXServices,
} from '@sdppp/sdpppx-services';

import { sanitizeSchema, type FormilySchema } from './schemaUtils';

export interface SDPPPSponsorClientConfig {
  baseUrl: string;
  headers: HeadersResolver;
  services: SDPPPXServices;
  inlineConfig?: InlineExecutorConfig;
  getTenantId?: () => string | null | undefined; // ✅ 添加获取 tenantId 的回调
}

export type DescribePayload = {
  schema: FormilySchema | null;
  values: Record<string, any>;
  metadata?: DescribeResult['metadata'];
  recommendedUploadProvider?: DescribeResult['recommendUploadProvider'];
  cancelable?: boolean; // ✅ 是否可取消任务
};

export type RemoteHistoryItem = SDPPPXRemoteHistoryItem;

export class SDPPPSponsor extends Client<SDPPPSponsorClientConfig> {
  private readonly services: SDPPPXServices;
  private readonly headers: HeadersResolver;
  private readonly inline: InlineExecutor;

  constructor(config: SDPPPSponsorClientConfig) {
    super(config);
    this.services = config.services;
    this.headers = config.headers;

    // ✅ 使用动态 platformConfig，让 store 注入 tenantId
    const dynamicPlatformConfig = config.inlineConfig?.platformConfig ?? (() => {
      const tenantId = config.getTenantId ? config.getTenantId() : undefined;
      return {
        language: 'zh-CN',
        ...(tenantId ? { tenantId } : {}),
      };
    });

    const inlineConfig: InlineExecutorConfig = {
      mode: config.inlineConfig?.mode ?? 'http',
      baseUrl: config.inlineConfig?.baseUrl ?? config.baseUrl,
      headers: config.inlineConfig?.headers ?? config.headers,
      platformConfig: dynamicPlatformConfig,
      uploadStrategy: config.inlineConfig?.uploadStrategy,
      pollIntervalMs: config.inlineConfig?.pollIntervalMs,
    };

    this.inline = createInlineExecutor(inlineConfig);
  }

  // 从 templateId 构建 locator（在 client 层完成）
  private buildLocator(templateId: string): string {
    return `sdpppx://template/${templateId}`;
  }

  async getNodes(templateId: string): Promise<{
    widgetableNodes: WidgetableNode[];
    defaultInput: Record<string, any>;
    rawData: DescribePayload;
  }> {
    const locator = this.buildLocator(templateId);
    const describe = await this.inline.describe({ locator });
    const schema = sanitizeSchema(describe.formSchema as FormilySchema | undefined);
    const values = (describe.formValues ?? {}) as Record<string, any>;
    return {
      widgetableNodes: [],
      defaultInput: values,
      rawData: {
        schema,
        values,
        metadata: describe.metadata,
        recommendedUploadProvider:
          typeof describe.recommendUploadProvider === 'string'
            ? describe.recommendUploadProvider.trim()
            : undefined,
        cancelable: describe.cancelable, // ✅ 返回是否可取消
      },
    };
  }

  async run(templateId: string, input: any, signal?: AbortSignal): Promise<Task<any>> {
    const locator = this.buildLocator(templateId);
    const reporterBridge = Task.createReporterBridge();
    const handle = await this.inline.run({
      locator,
      payload: input,
      options: {
        signal,
        reporter: reporterBridge.reporter,
      },
    });
    return new Task(handle.taskId, {
      handle,
      attachReporter: reporterBridge.attach,
    });
  }

  async uploadImage(): Promise<string> {
    throw new Error('当前任务路由暂不支持上传控件');
  }

  async fetchTemplates(): Promise<{ items?: Array<{ value: string; label: string; locator?: string | null }> }> {
    return this.services.fetchTemplates();
  }

  async fetchBalance(): Promise<{ balance?: number }> {
    const tenantId = this.config.getTenantId?.();
    return this.services.fetchBalance(undefined, tenantId);
  }

  async fetchHistory(params?: { limit?: number }): Promise<{ items?: RemoteHistoryItem[] }> {
    return this.services.fetchHistory(undefined, params);
  }

  async fetchTaskStatus(_templateId: string, taskId: string) {
    return this.services.fetchTaskStatusById(taskId);
  }

  async fetchTaskDetail(_templateId: string, taskId: string) {
    return this.services.fetchTaskDetailById(taskId);
  }

  async cancelTask(_templateId: string, taskId: string) {
    await this.services.cancelTaskById(taskId);
  }

  async uploadResource(
    templateId: string,
    resourceId: string,
    options?: { fileName?: string; signal?: AbortSignal; uploadProviderHint?: string }
  ): Promise<string> {
    const normalized = resourceId.trim();
    if (!normalized) {
      throw new Error('缺少可上传的资源');
    }

    const formData = new FormData();
    const fileNameCandidate = options?.fileName?.trim();
    const resolvedFileName =
      fileNameCandidate && fileNameCandidate.length > 0
        ? fileNameCandidate.split(/[\\/]/).pop() ?? fileNameCandidate
        : `resource-${Date.now()}.png`;
    const mimeType = 'image/uxp';
    const filePayload =
      typeof File !== 'undefined'
        ? new File([normalized], resolvedFileName, { type: mimeType })
        : new Blob([normalized], { type: mimeType });
    formData.append('file', filePayload, resolvedFileName);
    formData.set('mimeType', mimeType);

    // ✅ 确定 uploadProvider: 优先使用 hint，否则使用默认的 'sdpppx'
    let uploadProvider =
      typeof options?.uploadProviderHint === 'string' && options.uploadProviderHint.trim().length > 0
        ? options.uploadProviderHint.trim()
        : 'sdpppx';

    formData.set('uploadProvider', uploadProvider);

    // ✅ 移除 locator 参数，只通过 uploadProvider 指定上传提供商
    return this.inline.upload({
      uploadProvider,
      formData,
      options: options?.signal ? { signal: options.signal } : undefined,
    });
  }
}
