import { WidgetableNode, WidgetableWidget } from '@sdppp/common/schemas/schemas';
import { Client } from '../base/Client';
import { Task } from '../base/Task';
import { t, getCurrentLanguage, sdpppSDK } from '@sdppp/common';
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
            maxCount: 1,
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

  async run(model: string, input: { image_input: string, prompt: string }, signal?: AbortSignal): Promise<Task<any>> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException('Task creation aborted', 'AbortError');
      }

      if (!input.image_input || !input.prompt) {
        throw new Error('Image input and prompt are required');
      }

      // For token-based flow, use the input directly as token
      // For base64 flow, input.image_input is the base64 data
      const imageToken = input.image_input;

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
                  // Determine if input is token or base64
                  const isToken = typeof imageToken === 'string' && !imageToken.startsWith('data:') && !imageToken.includes(',');
                  taskResult = await sdpppSDK.plugins.photoshop.geminiImageGenerate({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL,
                    imageInput: isToken ? imageToken : input.image_input,
                    imageInputType: isToken ? 'token' : 'base64',
                    prompt: input.prompt
                  });
                } else {
                  console.log('Starting OpenAI image edit via mesh action...');
                  taskResult = await sdpppSDK.plugins.photoshop.openaiImageEdit({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseURL,
                    imageToken,
                    prompt: input.prompt,
                    model
                  });
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

  async uploadImage(type: 'token' | 'buffer', image: ArrayBuffer | string, format: 'png' | 'jpg' | 'jpeg' | 'webp', signal?: AbortSignal): Promise<string> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }

      if (type === 'token') {
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
