import { getCurrentLanguage, sdpppSDK, t } from '@sdppp/common';
import { WidgetableNode, WidgetableWidget } from '@sdppp/common/schemas/schemas';
import { adaptFormilySchemaToWidgetable } from '@sdppp/formily-widgetable-adapter';
import type { FormilySchema } from '@sdppp/pptask';
import { createInlineExecutor } from '@sdppp/pptask/executors/inline';
import type { InlineExecutor } from '@sdppp/pptask/executors/inline';
import { Client } from '../base/Client';
import { Task } from '../base/Task';

const log = sdpppSDK.logger.extend('runninghub')

// Register both domains for proxy
sdpppSDK.plugins.fetchProxy.registerProxyDomains('runninghub.cn');
sdpppSDK.plugins.fetchProxy.registerProxyDomains('runninghub.ai');

export class SDPPPRunningHub extends Client<{
  apiKey: string
}> {
  private readonly inline: InlineExecutor;
  private readonly schemaCache = new Map<string, FormilySchema>();

  constructor(config: { apiKey: string }) {
    super(config);
    this.inline = createInlineExecutor({
      platformConfig: () => this.buildPlatformConfig(),
    });
  }

  // Simple in-module store to keep latest nodeInfoList per webappId
  private static nodeInfoListStore: Record<string, any[] | undefined> = {};

  private getUnknownErrorMessage() {
    return t('common.error.unknown', { defaultValue: 'Unknown error' });
  }

  private getBaseHost(): string {
    const locale = getCurrentLanguage();
    return locale === 'en-US' ? 'www.runninghub.ai' : 'www.runninghub.cn';
  }

  private buildLocator(webappId: string): string {
    return `runninghub://app/${webappId}`;
  }

  private buildPlatformConfig(): Record<string, any> {
    return {
      apiKey: this.config.apiKey,
      language: getCurrentLanguage(),
    };
  }

  async getAccountStatus(): Promise<{
    remainCoins: number;
    currentTaskCounts: number;
  }> {
    const apiUrl = `https://${this.getBaseHost()}/uc/openapi/accountStatus`;
    log('getAccountStatus called', { apiUrl });

    try {
      const requestBody = {
        apikey: this.config.apiKey
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorMsg = t('runninghub.error.account_status_http', {
          status: response.status,
          defaultValue: 'getAccountStatus API failed - HTTP error! status: {{status}}'
        });
        log('getAccountStatus error', { status: response.status, url: apiUrl });
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (result.code !== 0) {
        const reason =
          result.msg ||
          t('runninghub.error.account_status_reason_unknown', {
            defaultValue: 'Failed to fetch account status'
          });
        const errorMsg = t('runninghub.error.account_status_failed', {
          reason,
          defaultValue: 'getAccountStatus API failed - {{reason}}'
        });
        log('getAccountStatus error', { code: result.code, msg: result.msg, url: apiUrl });
        throw new Error(errorMsg);
      }

      return result.data;
    } catch (error: any) {
      log('getAccountStatus exception', { error: error.message, url: apiUrl });
      console.error('Error fetching account status:', error);
      throw error;
    }
  }

  async getNodes(webappId: string): Promise<{
    widgetableNodes: WidgetableNode[],
    defaultInput: Record<string, any>,
    rawData: any
  }> {
    const locator = this.buildLocator(webappId);
    log('getNodes called', { webappId, locator });

    try {
      const describe = await this.inline.describe({ locator });
      const formSchema = describe.formSchema as FormilySchema;
      const formValues = (describe.formValues ?? {}) as Record<string, any>;
      this.schemaCache.set(locator, formSchema);
      const { nodes, defaultValues, warnings } = adaptFormilySchemaToWidgetable(formSchema);
      const mergedValues = { ...defaultValues, ...formValues };

      return {
        widgetableNodes: nodes,
        defaultInput: mergedValues,
        rawData: {
          locator,
          schema: formSchema,
          values: mergedValues,
          warnings,
          metadata: describe.metadata,
        },
      };
    } catch (error: any) {
      log('getNodes exception', { webappId, error: error.message });
      console.error('Error fetching widgets:', error);
      throw error;
    }
  }

  private mergeInputWithNodeInfoList(nodeInfoList: any[], input: Record<string, any>): any[] {
    return nodeInfoList.map(node => {
      const nodeKey = `${node.nodeId}_${node.fieldName}`;
      let fieldValue = input[nodeKey] !== undefined ? input[nodeKey] : node.fieldValue;

      // If image/file field, submit only the first value
      const ft = String(node.fieldType || '').toUpperCase();
      if (ft === 'SWITCH') {
        const normalizedValue = this.normalizeSwitchFieldValue(node, fieldValue);
        log('switch field normalized', { nodeKey, rawValue: fieldValue, normalizedValue });
        fieldValue = normalizedValue;
      }
      if (ft === 'IMAGE' || ft === 'FILE') {
        if (Array.isArray(fieldValue)) {
          const first = fieldValue[0];
          if (first && typeof first === 'object' && typeof (first as any).url === 'string') {
            fieldValue = ((first as any).url ?? '').trim();
          } else if (typeof first === 'string') {
            fieldValue = first.trim();
          } else {
            fieldValue = '';
          }
        } else if (fieldValue && typeof fieldValue === 'object' && typeof (fieldValue as any).url === 'string') {
          fieldValue = ((fieldValue as any).url ?? '').trim();
        } else if (typeof fieldValue === 'string') {
          fieldValue = fieldValue.trim();
        } else if (fieldValue == null) {
          fieldValue = '';
        }
      }

      return {
        ...node,
        fieldValue,
      };
    });
  }

  private normalizeSwitchFieldValue(node: any, rawValue: any): any {
    if (rawValue === undefined || rawValue === null) return rawValue;
    const candidates = this.parseFieldData(node?.fieldData);
    const byName = candidates.find(item => item && typeof item === 'object' && String(item.name) === String(rawValue));
    if (byName && byName.index !== undefined) return byName.index;
    const byFastIndex = candidates.find(item => item && typeof item === 'object' && String(item.fastIndex) === String(rawValue));
    if (byFastIndex && byFastIndex.index !== undefined) return byFastIndex.index;
    const byIndex = candidates.find(item => item && typeof item === 'object' && String(item.index) === String(rawValue));
    if (byIndex && byIndex.index !== undefined) return byIndex.index;
    return rawValue;
  }

  private parseFieldData(fieldData: any): any[] {
    if (!fieldData) return [];
    if (Array.isArray(fieldData)) return fieldData;
    if (typeof fieldData === 'string') {
      try {
        const parsed = JSON.parse(fieldData);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private mapStatusToChineseMessage(status: string): string {
    switch (status) {
      case 'QUEUED':
        return t('runninghub.status.waiting');
      case 'RUNNING':
        return t('runninghub.status.running');
      case 'FAILED':
        return t('runninghub.status.failed');
      case 'SUCCESS':
        return t('runninghub.status.success');
      default:
        return status;
    }
  }

  async run(webappId: string, input: any, signal?: AbortSignal): Promise<Task<any>> {
    const locator = this.buildLocator(webappId);
    log('run called', { webappId, locator, input });

    try {
      if (signal?.aborted) {
        throw new DOMException(
          t('common.error.task_creation_aborted', { defaultValue: 'Task creation aborted' }),
          'AbortError'
        );
      }

      const taskId = `runninghub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let taskResult: any = null;
      let remoteTaskId: string | null = null;
      let isCompleted = false;

      const task = new Task(taskId, {
        statusGetter: async () => {
          if (!isCompleted && !taskResult) {
            if (!this.schemaCache.has(locator)) {
              await this.getNodes(webappId);
            }
            const response = await sdpppSDK.plugins.photoshop.pptaskRun({
              locator,
              payload: input as Record<string, any>,
              platformConfig: this.buildPlatformConfig(),
              context: { provider: 'runninghub' },
              schema: this.schemaCache.get(locator),
            });
            if (response?.ok === false || response?.error) {
              const errorMessage = response?.error?.message || 'RunningHub task failed';
              const error = new Error(errorMessage);
              (error as any).payload = response?.error?.payload ?? response;
              throw error;
            }
            remoteTaskId = response?.taskId ?? null;
            taskResult = response?.result ?? null;
          }

          isCompleted = true;

          return {
            isCompleted: true,
            progress: 100,
            progressMessage: t('common.success', { defaultValue: 'Success' }),
            rawData: taskResult,
          };
        },
        resultGetter: async (_id: string, lastStatusResult: any) => {
          const result = lastStatusResult.rawData;
          if (!result) {
            throw new Error(this.getUnknownErrorMessage());
          }
          return result;
        },
        canceler: async () => {
          if (!remoteTaskId) return;
          await sdpppSDK.plugins.photoshop.pptaskCancel({ taskId: remoteTaskId });
        },
      });

      task.taskName = t('runninghub.task.title', {
        webappId,
        defaultValue: 'RunningHub - {{webappId}}'
      });
      task.metadata = {
        provider: 'runninghub',
        webappId,
        locator,
        apiKey: this.config.apiKey.substring(0, 8) + '...',
      };

      return task;
    } catch (error: any) {
      log('run exception', { webappId, error: error.message, locator });
      console.error('Error running task:', error);
      throw error;
    }
  }

  async uploadImage(type: 'resource', image: ArrayBuffer | string, format: 'png' | 'jpg' | 'jpeg' | 'webp', signal?: AbortSignal): Promise<string> {
    const filename = `runninghub_${Math.random().toString(36).substring(2, 8)}_${Date.now()}.${format}`;
    log('uploadImage called', { type, format, filename });

    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException(
          t('common.error.upload_aborted', { defaultValue: 'Upload aborted' }),
          'AbortError'
        );
      }

      // Create form data for file upload
      const formData = new FormData();
      const blob = new Blob([image], {
        type: `image/uxp`,
      });
      formData.append('file', blob, filename);
      formData.append('fileType', 'image');
      formData.append('apiKey', this.config.apiKey);

      const url = await this.inline.upload({
        uploadProvider: 'runninghub',
        formData,
        options: signal ? { signal } : undefined,
      });
      return url;
    } catch (error: any) {
      log('uploadImage exception', { filename, error: error.message });
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  private convertFormDataToNodes(formData: any): {
    widgetableNodes: WidgetableNode[],
    defaultInput: Record<string, any>
  } {
    const widgetableNodes: WidgetableNode[] = [];
    const defaultInput: Record<string, any> = {};

    if (formData.nodeInfoList && Array.isArray(formData.nodeInfoList)) {
      formData.nodeInfoList.forEach((node: any, index: number) => {
        const widget: WidgetableWidget = {
          name: '',
          uiWeight: 12,
          outputType: this.mapFieldTypeToOutputType(node.fieldType) as any,
          options: this.createFieldOptions(node)
        };

        const widgetableNode: WidgetableNode = {
          id: `${node.nodeId}_${node.fieldName}`,
          title: node.description || node.fieldName || `field_${index}`,
          widgets: [widget],
          uiWeightSum: widget.uiWeight,
        };

        widgetableNodes.push(widgetableNode);
        if (widget.outputType === 'images') {
          defaultInput[widgetableNode.id] = this.normalizeImageDefault(node.fieldValue);
        } else {
          const fallbackValue = this.getDefaultValueForType(widget.outputType);
          defaultInput[widgetableNode.id] = node.fieldValue || fallbackValue;
        }
      });
    }

    return { widgetableNodes, defaultInput };
  }

  private normalizeImageDefault(fieldValue: any): string[] {
    if (Array.isArray(fieldValue)) {
      return fieldValue
        .map(item => {
          if (!item) {
            return null;
          }
          if (typeof item === 'string') {
            const normalized = item.trim();
            return normalized || null;
          }
          if (typeof item === 'object' && item && typeof item.url === 'string') {
            const normalized = item.url.trim();
            return normalized || null;
          }
          return null;
        })
        .filter((item): item is string => !!item);
    }

    if (typeof fieldValue === 'string') {
      const normalized = fieldValue.trim();
      return normalized ? [normalized] : [];
    }

    if (fieldValue && typeof fieldValue === 'object' && typeof fieldValue.url === 'string') {
      const normalized = fieldValue.url.trim();
      return normalized ? [normalized] : [];
    }

    return [];
  }

  private mapFieldTypeToOutputType(fieldType: string): string {
    switch (fieldType?.toLowerCase()) {
      case 'text':
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
      case 'int':
      case 'float':
        return 'number';
      case 'list':
      case 'select':
      case 'dropdown':
      case 'switch':
        return 'combo';
      case 'image':
      case 'file':
        return 'images';
      case 'boolean':
        return 'boolean';
      default:
        return 'string';
    }
  }

  private createFieldOptions(node: any): any {
    const options: any = {
      required: node.required || false
    };
    let fieldData = null
    try {
      fieldData = JSON.parse(node.fieldData || '[]');
    } catch (e) {
      fieldData = [];
    }

    if (node.fieldType === 'FLOAT' || node.fieldType === 'INT') {
      options.min = fieldData[1].min;
      options.max = fieldData[1].max;
      options.step = node.fieldType === 'INT' ? 1 : 0.01;
      if (options.max - options.min < 1000) {
        options.slider = true;
      } else {
        options.slider = false;
      }
    }

    if (node.fieldType === 'LIST' || node.fieldType === 'select' || node.fieldType === 'dropdown' || node.fieldType === 'SWITCH') {
      if (fieldData[0] && Array.isArray(fieldData[0])) {
        options.values = fieldData[0];
      } else if (Array.isArray(fieldData)) {
        options.values = fieldData.filter(item => item.name && item.index).map(item => item.name);
        options.labels = fieldData.filter(item => item.name && item.index).map(item => item.description || item.name);
      } else {
        options.values = [];
      }
    }

    if (node.fieldType === 'IMAGE' || node.fieldType === 'file') {
      options.maxCount = node.maxCount || 1;
    }
    return options;
  }

  private getDefaultValueForType(outputType: string): any {
    switch (outputType) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'combo':
        return null;
      case 'images':
        return [];
      default:
        return null;
    }
  }
}
