import { sdpppSDK, t } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
import type { FormilySchema } from '@sdppp/pptask';
import { createInlineExecutor } from '@sdppp/pptask/executors/inline';
import type { InlineExecutor } from '@sdppp/pptask/executors/inline';
import { Client } from '../base/Client';
import { Task } from '../base/Task';
// GoogleGenAI and OpenAI moved to mesh actions

// Gemini and OpenAI interfaces moved to mesh actions - keeping for compatibility
export interface GeminiResult {
  success: boolean
  imageUrl?: string
  apiTime?: number
  error?: string
}

export class SDPPPCustomAPI extends Client<{
  apiKey: string
  baseURL: string
  format: 'google' | 'openai'
}> {
  private readonly inline: InlineExecutor;
  private readonly schemaCache = new Map<string, FormilySchema>();

  constructor(config: { apiKey: string, baseURL: string, format: 'google' | 'openai' }) {
    super(config);
    this.inline = createInlineExecutor();
  }

  async getNodes(_model: string): Promise<{
    widgetableNodes: WidgetableNode[],
    defaultInput: Record<string, any>,
    rawData: any
  }> {
    const locator = this.buildLocator(_model);
    const describe = await this.inline.describe({ locator });
    const formSchema = describe.formSchema as FormilySchema;
    const formValues = (describe.formValues ?? {}) as Record<string, any>;
    this.schemaCache.set(locator, formSchema);
    const mergedValues = {
      ...formValues,
    };

    return {
      widgetableNodes: [],
      defaultInput: mergedValues,
      rawData: {
        format: this.config.format,
        model: _model,
        locator,
        schema: formSchema,
        values: mergedValues,
        metadata: describe.metadata,
        cancelable: describe.cancelable,
      },
    };
  }

  async run(model: string, input: Record<string, any>, signal?: AbortSignal): Promise<Task<any>> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException(
          t('common.error.task_creation_aborted', { defaultValue: 'Task creation aborted' }),
          'AbortError'
        );
      }

      const taskId = `${this.config.format}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let taskResult: any = null;
      let remoteTaskId: string | null = null;
      let isCompleted = false;
      const locator = this.buildLocator(model);

      const task = new Task(taskId, {
        statusGetter: async (id: string) => {
          // Check if aborted before making status request
          if (signal?.aborted) {
            throw new DOMException(
              t('common.error.status_check_aborted', { defaultValue: 'Status check aborted' }),
              'AbortError'
            );
          }

          if (!isCompleted && !taskResult) {
            try {
              const response = await sdpppSDK.plugins.photoshop.pptaskRun({
                locator,
                payload: input as Record<string, any>,
                platformConfig: this.buildPlatformConfig(),
                context: { format: this.config.format },
                schema: this.schemaCache.get(locator),
              });
              if (response?.ok === false || response?.error) {
                const errorMessage = response?.error?.message || 'CustomAPI task failed';
                const error = new Error(errorMessage);
                (error as any).payload = response?.error?.payload ?? response;
                throw error;
              }
              remoteTaskId = response?.taskId ?? null;
              taskResult = response?.result ?? null;
            } catch (error) {
              isCompleted = true;
              throw error;
            }
          }

          isCompleted = true;

          return {
            isCompleted,
            progress: 100,
            progressMessage: t('common.success', { defaultValue: 'Success' }),
            rawData: taskResult,
          };
        },
        resultGetter: async (id: string, lastStatusResult: any) => {
          // Check if aborted before getting results
          if (signal?.aborted) {
            throw new DOMException(
              t('common.error.result_fetch_aborted', { defaultValue: 'Result fetch aborted' }),
              'AbortError'
            );
          }

          const result = lastStatusResult.rawData;
          if (!result) {
            throw new Error(t('customapi.error.generation_failed', {
              defaultValue: 'Generation failed'
            }));
          }
          return result;
        },
        canceler: async (id: string) => {
          if (!remoteTaskId) return;
          await sdpppSDK.plugins.photoshop.pptaskCancel({ taskId: remoteTaskId });
        }
      });

      // Set task metadata
      task.taskName = this.config.format === 'google'
        ? t('customapi.task.name.google', { defaultValue: 'Google Gemini - Image Generation' })
        : t('customapi.task.name.openai', { defaultValue: 'OpenAI - Image Edit' });
      task.metadata = {
        format: this.config.format,
        model,
        locator,
      };

      return task;
    } catch (error) {
      console.error('Error running CustomAPI task:', error);
      throw error;
    }
  }

  async uploadImage(type: 'resource', image: ArrayBuffer | string, format: 'png' | 'jpg' | 'jpeg' | 'webp', signal?: AbortSignal): Promise<string> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException(
          t('common.error.upload_aborted', { defaultValue: 'Upload aborted' }),
          'AbortError'
        );
      }

      if (type === 'resource') {
        const { base64 } = await sdpppSDK.plugins.photoshop.getImageBase64({ token: image as string })
        return base64 || '';

      } else {
        throw new Error(t('customapi.error.unsupported_image_input', {
          defaultValue: 'Unsupported image input type'
        }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  private convertBase64ToBuffer(imageInput: string): Buffer {
    // Handle data URL format (data:image/png;base64,...)
    if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }

    // Handle plain base64 string
    return Buffer.from(imageInput, 'base64');
  }

  // OpenAI generation moved to mesh actions in run()
  private buildLocator(model: string): string {
    if (this.config.format === 'google') {
      const normalized = model?.trim() || 'gemini-2.5-flash-image-preview';
      return `gemini:///${normalized}`;
    }

    const endpoint = normalizeOpenAIEndpoint(model);
    return `openai://${endpoint}`;
  }

  private buildPlatformConfig(): Record<string, any> {
    const baseURL = this.config.baseURL?.trim() || undefined;
    return {
      apiKey: this.config.apiKey,
      ...(baseURL ? { baseURL, baseUrl: baseURL } : {}),
    };
  }

}

function normalizeOpenAIEndpoint(raw: string): 'edits' | 'generations' | 'variations' {
  const normalized = (raw || '').trim().toLowerCase();
  if (['edit', 'edits', 'image-edit'].includes(normalized)) return 'edits';
  if (['generate', 'generations', 'image-generate'].includes(normalized)) return 'generations';
  if (['variation', 'variations', 'image-variation'].includes(normalized)) return 'variations';
  return 'edits';
}
