import { sdpppSDK } from '../../ps-common/sdk/sdppp-ps-sdk.js';

export type TaskLike<T = any> = { taskId: string; promise: Promise<T>; cancelable?: boolean; cancel?: () => Promise<void> | void };

export class SDPPPCustomApiClient {
  constructor(private config: { apiKey: string; baseURL: string; format: 'google' | 'openai' }) {}

  async getNodes(_model: string): Promise<{ widgetableNodes: any[]; defaultInput: Record<string, any>; rawData: any }> {
    const nodes = [
      { id: 'image_input', title: 'Input Image', widgets: [{ name: '', uiWeight: 12, outputType: 'images', options: { maxCount: 4, required: true } }], uiWeightSum: 12 },
      { id: 'prompt', title: 'Prompt', widgets: [{ name: '', uiWeight: 12, outputType: 'string', options: { required: true, multiline: true } }], uiWeightSum: 12 },
    ];
    return { widgetableNodes: nodes, defaultInput: { image_input: null, prompt: '' }, rawData: { format: this.config.format, model: _model } };
  }

  async run(model: string, input: { image_input: string | string[]; prompt: string }, signal?: { aborted?: boolean }): Promise<TaskLike> {
    if (signal?.aborted) throw new DOMException('Task creation aborted', 'AbortError');
    if (!input?.image_input || !input?.prompt) throw new Error('Image input and prompt are required');
    const inputsArray = Array.isArray(input.image_input) ? input.image_input : [input.image_input];
    const taskId = `${this.config.format}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    let result: any = null; let completed = false;
    const promise = new Promise<any[]>(async (resolve, reject) => {
      try {
        if (this.config.format === 'google') {
          const areDataURLs = inputsArray.every(v => typeof v === 'string' && v.startsWith('data:'));
          result = await sdpppSDK.plugins.photoshop.geminiImageGenerate({ apiKey: this.config.apiKey, baseURL: this.config.baseURL, imageInputs: inputsArray as any, imageInputType: (areDataURLs ? 'base64' : 'token') as any, prompt: input.prompt }, signal as any);
        } else {
          result = await sdpppSDK.plugins.photoshop.openaiImageEdit({ apiKey: this.config.apiKey, baseURL: this.config.baseURL, imageToken: inputsArray[0] as string, prompt: input.prompt, model }, signal as any);
        }
        completed = true;
        if (!result?.success || !result.imageUrl) throw new Error(result?.error || 'Generation failed');
        resolve([{ url: result.imageUrl, rawData: result }]);
      } catch (e) { reject(e); }
    });
    return { taskId, promise, cancelable: false };
  }

  async uploadImage(type: 'token'|'buffer'|'resource', image: ArrayBuffer|string, format: 'png'|'jpg'|'jpeg'|'webp', signal?: { aborted?: boolean }): Promise<string> {
    if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
    if (type === 'buffer') {
      const arrayBuffer = image as ArrayBuffer;
      const base64 = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer).toString('base64') : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return `data:image/${format};base64,${base64}`;
    }
    const token = image as string;
    const { base64 } = await sdpppSDK.plugins.photoshop.getImageBase64({ token });
    return base64 || '';
  }
}

