import { sdpppSDK, t } from '@sdppp/common';
import { WidgetableNode } from '@sdppp/common/schemas/schemas';
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
  constructor(config: { apiKey: string, baseURL: string, format: 'google' | 'openai' }) {
    super(config);
    // Gemini generator removed - using mesh actions now
  }

  async getNodes(_model: string): Promise<{
    widgetableNodes: WidgetableNode[],
    defaultInput: Record<string, any>,
    rawData: any
  }> {
    const widgetableNodes: WidgetableNode[] = [
      {
        id: 'image_input',
        title: t('google.field.image_input', { defaultMessage: 'Input Image' }),
        widgets: [{
          name: '',
          uiWeight: 12,
          outputType: 'images',
          options: {
            maxCount: 4,
            required: true
          }
        }],
        uiWeightSum: 12
      },
      {
        id: 'prompt',
        title: t('google.field.prompt', { defaultMessage: 'Prompt' }),
        widgets: [{
          name: '',
          uiWeight: 12,
          outputType: 'string',
          options: {
            required: true,
            multiline: true
          }
        }],
        uiWeightSum: 12
      },

    ];

    // Add aspectRatio and imageSize only for Google format
    if (this.config.format === 'google') {
      widgetableNodes.push(
        {
          id: 'aspectRatio',
          title: t('google.field.aspect_ratio', { defaultMessage: 'Aspect Ratio' }),
          widgets: [{
            name: '',
            uiWeight: 12,
            outputType: 'combo',
            options: {
              required: false,
              values: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'],
              labels: ['1:1 (Square)', '16:9 (Landscape)', '9:16 (Portrait)', '4:3 (Landscape)', '3:4 (Portrait)', '21:9 (Ultrawide)', '3:2 (Landscape)', '2:3 (Portrait)']
            }
          }],
          uiWeightSum: 12
        },
        {
          id: 'imageSize',
          title: t('google.field.image_size', { defaultMessage: 'Image Size' }),
          widgets: [{
            name: '',
            uiWeight: 12,
            outputType: 'combo',
            options: {
              required: false,
              values: ['1K', '2K', '4K'],
              labels: ['1K (Standard)', '2K (High)', '4K (Ultra)']
            }
          }],
          uiWeightSum: 12
        }
      );
    }

    const defaultInput: Record<string, any> = {
      image_input: null,
      prompt: ''
    };

    if (this.config.format === 'google') {
      defaultInput.aspectRatio = '1:1';
      defaultInput.imageSize = '1K';
    }

    return {
      widgetableNodes,
      defaultInput,
      rawData: { format: this.config.format, model: _model }
    };
  }

  async run(model: string, input: { image_input: string | string[], prompt: string, aspectRatio?: string, imageSize?: string }, signal?: AbortSignal): Promise<Task<any>> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException(
          t('common.error.task_creation_aborted', { defaultValue: 'Task creation aborted' }),
          'AbortError'
        );
      }

      if (!input.image_input || !input.prompt) {
        throw new Error(t('customapi.error.input_required', {
          defaultValue: 'Image input and prompt are required'
        }));
      }

      // Normalize to an array of inputs (tokens or base64)
      const inputsArray = Array.isArray(input.image_input) ? input.image_input : [input.image_input];
      const firstInput = inputsArray[0];

      const taskId = `${this.config.format}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let taskResult: any = null;
      let isCompleted = false;

      const task = new Task(taskId, {
        statusGetter: async (id: string) => {
          // Check if aborted before making status request
          if (signal?.aborted) {
            throw new DOMException(
              t('common.error.status_check_aborted', { defaultValue: 'Status check aborted' }),
              'AbortError'
            );
          }

          if (!isCompleted) {
            // Start the generation if not started
            if (!taskResult) {
              try {
                if (this.config.format === 'google') {
                  console.log('Starting Gemini image generation via mesh action...');
                  // Determine type: if every input is a data URL, treat as base64; otherwise tokens
                  const areAllDataUrls = inputsArray.every(v => typeof v === 'string' && v.startsWith('data:'));
                  const geminiParams: any = {
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL,
                    model,
                    imageInputs: inputsArray as any,
                    imageInputType: (areAllDataUrls ? 'base64' : 'token') as any,
                    prompt: input.prompt
                  };
                  
                  // Add aspectRatio and imageSize if provided
                  if (input.aspectRatio) {
                    geminiParams.aspectRatio = input.aspectRatio;
                  }
                  if (input.imageSize) {
                    geminiParams.imageSize = input.imageSize;
                  }
                  
                  taskResult = await sdpppSDK.plugins.photoshop.geminiImageGenerate(geminiParams, signal);
                } else {
                  console.log('Starting OpenAI image edit via mesh action...');
                  taskResult = await sdpppSDK.plugins.photoshop.openaiImageEdit({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL,
                    imageToken: firstInput as string,
                    prompt: input.prompt,
                    model
                  }, signal);
                }
                isCompleted = true;
              } catch (error) {
                isCompleted = true;
                throw error;
              }
          }
        }

          const nonGoogleStatusText = taskResult?.success
            ? t('common.success', { defaultValue: 'Success' })
            : t('common.failed', { defaultValue: 'Failed' });
          const nonGoogleGeneratingText = t('common.generating', { defaultValue: 'Generating...' });

          return {
            isCompleted,
            progress: isCompleted ? 100 : 50,
            progressMessage: isCompleted
              ? (this.config.format === 'google'
                ? (taskResult?.success ? t('google.status.success') : t('google.status.failed'))
                : nonGoogleStatusText)
              : (this.config.format === 'google' ? t('google.status.generating') : nonGoogleGeneratingText),
            rawData: taskResult
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
          if (!result?.success || !result.imageUrl) {
            throw new Error(result?.error || t('customapi.error.generation_failed', {
              defaultValue: 'Generation failed'
            }));
          }
          return [{ url: result.imageUrl, rawData: result }];
        },
        canceler: async (id: string) => {
          // Gemini generation is synchronous, so cancellation is not supported
          // This is mainly for UI consistency
        }
      });

      // Set task metadata
      task.taskName = this.config.format === 'google'
        ? t('customapi.task.name.google', { defaultValue: 'Google Gemini - Image Generation' })
        : t('customapi.task.name.openai', { defaultValue: 'OpenAI - Image Edit' });
      task.metadata = {
        format: this.config.format,
        model
      };

      return task;
    } catch (error) {
      console.error('Error running Google task:', error);
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
}
