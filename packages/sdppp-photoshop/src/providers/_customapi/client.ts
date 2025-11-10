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

    const defaultInput = {
      image_input: null,
      prompt: ''
    };

    return {
      widgetableNodes,
      defaultInput,
      rawData: { format: this.config.format, model: _model }
    };
  }

  async run(model: string, input: { image_input: string | string[], prompt: string }, signal?: AbortSignal): Promise<Task<any>> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException('Task creation aborted', 'AbortError');
      }

      if (!input.image_input || !input.prompt) {
        throw new Error('Image input and prompt are required');
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
            throw new DOMException('Status check aborted', 'AbortError');
          }

          if (!isCompleted) {
            // Start the generation if not started
            if (!taskResult) {
              try {
                if (this.config.format === 'google') {
                  console.log('Starting Gemini image generation via mesh action...');
                  // Determine type: if every input is a data URL, treat as base64; otherwise tokens
                  const areAllDataUrls = inputsArray.every(v => typeof v === 'string' && v.startsWith('data:'));
                  taskResult = await sdpppSDK.plugins.photoshop.geminiImageGenerate({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL,
                    imageInputs: inputsArray as any,
                    imageInputType: (areAllDataUrls ? 'base64' : 'token') as any,
                    prompt: input.prompt
                  }, signal);
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

          return {
            isCompleted,
            progress: isCompleted ? 100 : 50,
            progressMessage: isCompleted
              ? (this.config.format === 'google'
                ? (taskResult?.success ? t('google.status.success') : t('google.status.failed'))
                : (taskResult?.success ? 'Success' : 'Failed'))
              : (this.config.format === 'google' ? t('google.status.generating') : 'Generating...'),
            rawData: taskResult
          };
        },
        resultGetter: async (id: string, lastStatusResult: any) => {
          // Check if aborted before getting results
          if (signal?.aborted) {
            throw new DOMException('Result fetch aborted', 'AbortError');
          }

          const result = lastStatusResult.rawData;
          if (!result?.success || !result.imageUrl) {
            throw new Error(result?.error || 'Generation failed');
          }
          return [{ url: result.imageUrl, rawData: result }];
        },
        canceler: async (id: string) => {
          // Gemini generation is synchronous, so cancellation is not supported
          // This is mainly for UI consistency
        }
      });

      // Set task metadata
      task.taskName = this.config.format === 'google' ? `Google Gemini - Image Generation` : 'OpenAI - Image Edit';
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
        throw new DOMException('Upload aborted', 'AbortError');
      }

      if (type === 'resource') {
        const { base64 } = await sdpppSDK.plugins.photoshop.getImageBase64({ token: image as string })
        return base64 || '';

      } else {
        throw new Error('Unsupported image input type');
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
