import { registerDefaultHandlers } from './providers/index.js';
import { getHandler, register as registerHandler } from './registry.js';
import type { DescribeResult, HandlerContext, RunOptions, TaskLike, UploadInput, UrlTaskHandler } from './types.js';

export async function run(urlLike: string, data: Record<string, any>, options?: RunOptions): Promise<TaskLike> {
  let url: URL;
  try {
    // Ensure valid protocol; URL requires something like "scheme://..."
    url = new URL(urlLike);
  } catch (e) {
    throw new Error(`Invalid url: ${urlLike}`);
  }

  const handler = getHandler(url.protocol.replace(/:\s*$/, ''));
  if (!handler) {
    throw new Error(`No handler registered for scheme: ${url.protocol}`);
  }
  const ctx: HandlerContext = { options };
  return handler(url, data || {}, ctx);
}

export function register(scheme: string, handler: UrlTaskHandler) {
  registerHandler(scheme, handler);
}

// Register built-in handlers at module init time
registerDefaultHandlers();

export * from './types.js';

// describe(url): get form schema/inputs via client.getNodes
export async function describe(urlLike: string, options?: RunOptions): Promise<DescribeResult> {
  let url: URL;
  try { url = new URL(urlLike); } catch { throw new Error(`Invalid url: ${urlLike}`); }

  const scheme = url.protocol.replace(/:\s*$/, '').toLowerCase();
  switch (scheme) {
    case 'replicate': {
      const { SDPPPReplicateClient } = await import('./clients/replicate.js');
      const { parseModel } = await import('./providers/replicate.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      if (!apiKey) throw new Error('replicate apiKey is required');
      const client = new SDPPPReplicateClient({ apiKey });
      const model = (parseModel as any)(url);
      return await client.getNodes(model);
    }
    case 'runninghub': {
      const { SDPPPRunningHubClient } = await import('./clients/runninghub.js');
      const { parseRunninghubWebappId } = await import('./providers/runninghub.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      if (!apiKey) throw new Error('runninghub apiKey is required');
      const client = new SDPPPRunningHubClient({ apiKey });
      const webappId = (parseRunninghubWebappId as any)(url);
      return await client.getNodes(webappId);
    }
    case 'customapi': {
      const { SDPPPCustomApiClient } = await import('./clients/customapi.js');
      const { parseCustomApiFormat } = await import('./providers/customapi.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      const baseURL = options?.config?.baseURL || url.searchParams.get('baseURL') || '';
      if (!apiKey) throw new Error('customapi apiKey is required');
      const format = (parseCustomApiFormat as any)(url);
      const client = new SDPPPCustomApiClient({ apiKey, baseURL, format });
      return await client.getNodes(format);
    }
    case 'comfy': {
      // For Comfy, we don't have a direct getNodes; build a minimal schema
      // Optionally verify workflow exists via ComfyCaller when available
      try {
        // @ts-ignore
        const sdk = (await import('../../../packages/ps-common/sdk/sdppp-ps-sdk.js')).sdpppSDK || (globalThis as any).sdpppSDK;
        const list = await sdk?.plugins?.ComfyCaller?.listWorkflows?.({});
        // list.workflows is optional; ignore mismatch
      } catch {}
      const widgetableNodes = [
        {
          id: 'size',
          title: 'Batch Size',
          widgets: [{ name: '', uiWeight: 12, outputType: 'number', options: { min: 1, max: 100, step: 1 } }],
          uiWeightSum: 12,
        },
      ];
      const defaultInput = { size: 1 } as Record<string, any>;
      return { widgetableNodes, defaultInput, rawData: { provider: 'comfy' } };
    }
    default:
      throw new Error(`No handler registered for scheme: ${url.protocol}`);
  }
}

// upload(url): provider-agnostic upload api via client.uploadImage
export async function upload(urlLike: string, input: UploadInput, options?: RunOptions): Promise<string> {
  let url: URL;
  try { url = new URL(urlLike); } catch { throw new Error(`Invalid url: ${urlLike}`); }

  const scheme = url.protocol.replace(/:\s*$/, '').toLowerCase();
  switch (scheme) {
    case 'replicate': {
      const { SDPPPReplicateClient } = await import('./clients/replicate.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      if (!apiKey) throw new Error('replicate apiKey is required');
      const client = new SDPPPReplicateClient({ apiKey });
      return await client.uploadImage(input.type, input.image, input.format, options?.signal);
    }
    case 'runninghub': {
      const { SDPPPRunningHubClient } = await import('./clients/runninghub.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      if (!apiKey) throw new Error('runninghub apiKey is required');
      const client = new SDPPPRunningHubClient({ apiKey });
      return await client.uploadImage(input.type, input.image, input.format, options?.signal);
    }
    case 'customapi': {
      const { SDPPPCustomApiClient } = await import('./clients/customapi.js');
      const { parseCustomApiFormat } = await import('./providers/customapi.js');
      const apiKey = options?.config?.apiKey || url.searchParams.get('apiKey');
      const baseURL = options?.config?.baseURL || url.searchParams.get('baseURL') || '';
      if (!apiKey) throw new Error('customapi apiKey is required');
      const format = (parseCustomApiFormat as any)(url);
      const client = new SDPPPCustomApiClient({ apiKey, baseURL, format });
      return await client.uploadImage(input.type, input.image, input.format, options?.signal);
    }
    case 'comfy': {
      // Delegate to Photoshop plugin's uploadComfyImage just like renderer does
      // @ts-ignore
      const sdk = (await import('../../../packages/ps-common/sdk/sdppp-ps-sdk.js')).sdpppSDK || (globalThis as any).sdpppSDK;
      if (!sdk?.plugins?.photoshop?.uploadComfyImage) {
        throw new Error('comfy upload unavailable: photoshop.uploadComfyImage not found');
      }
      const mime = `image/${input.format}`;
      // Normalize into UploadPass materialized shape for type 'buffer'
      let uploadInput: any;
      if (input.type === 'buffer') {
        uploadInput = {
          type: 'buffer',
          resource: { data: input.image as ArrayBuffer, mimeType: mime },
          fileName: `upload.${input.format}`,
        };
      } else {
        uploadInput = {
          type: input.type,
          resource: input.image,
          fileName: `upload.${input.format}`,
        };
      }
      const res = await sdk.plugins.photoshop.uploadComfyImage({ uploadInput, overwrite: true });
      return res?.name || '';
    }
    default:
      throw new Error(`No handler registered for scheme: ${url.protocol}`);
  }
}

// cancel(task): best-effort cancellation through task API
export async function cancel(task: TaskLike): Promise<void> {
  if (task && task.cancelable && typeof task.cancel === 'function') {
    await task.cancel();
    return;
  }
  throw new Error('Task is not cancelable');
}

// Optional namespaced export for convenience (aligns with README examples)
export const TaskRouter = {
  run,
  register,
  describe,
  upload,
  cancel,
};
