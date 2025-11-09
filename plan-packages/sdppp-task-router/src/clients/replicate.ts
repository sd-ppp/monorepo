import Replicate from 'replicate';

export type ReplicateClientConfig = { apiKey: string };

export type TaskLike<T = any> = {
  taskId: string;
  promise: Promise<T>;
  cancelable?: boolean;
  cancel?: () => Promise<void> | void;
};

export class SDPPPReplicateClient {
  private replicate: Replicate;
  private modelVersionCache: Record<string, string | undefined> = {};

  constructor(private config: ReplicateClientConfig) {
    this.replicate = new Replicate({ auth: config.apiKey });
  }

  async getNodes(model: string): Promise<{ widgetableNodes: any[]; defaultInput: Record<string, any>; rawData: any }> {
    const [owner, name] = model.split('/');
    const modelInfo: any = await this.replicate.models.get(owner, name);
    const version = modelInfo?.latest_version?.id;
    if (version) this.modelVersionCache[model] = version;
    // Build a minimal widgetable structure from openapi schema if available
    const schemas = modelInfo?.latest_version?.openapi_schema?.components?.schemas;
    const nodes: any[] = [];
    const defaults: Record<string, any> = modelInfo?.default_example?.input ?? {};
    if (schemas?.Input?.properties) {
      const entries = Object.entries(schemas.Input.properties as Record<string, any>);
      entries.sort((a: any, b: any) => (a[1]['x-order'] ?? 0) - (b[1]['x-order'] ?? 0));
      for (const [name, prop] of entries) {
        let outputType: string = prop.type;
        let options: any = undefined;
        if (prop.enum || prop.oneOf || prop.allOf) {
          outputType = 'combo';
          options = { values: prop.enum ?? prop.oneOf?.map((o: any) => o.const ?? o) ?? prop.allOf };
        } else if (prop.type === 'number' || prop.type === 'integer') {
          outputType = 'number';
          options = { max: prop.maximum, min: prop.minimum, step: prop.type === 'integer' ? 1 : 0.01 };
        } else if (prop.type === 'string') {
          if (prop.format === 'uri') { outputType = 'images'; options = { maxCount: 1 }; }
          else outputType = 'string';
        } else if (prop.type === 'array' && prop.items?.type === 'string' && prop.items?.format === 'uri') {
          outputType = 'images'; options = { maxCount: 4 };
        }
        nodes.push({ id: name, title: name, widgets: [{ name: '', uiWeight: 12, outputType, options }], uiWeightSum: 12 });
        if (!(name in defaults)) defaults[name] = null;
      }
    }
    return { widgetableNodes: nodes, defaultInput: defaults, rawData: modelInfo };
  }

  async run(model: string, input: any, signal?: { aborted?: boolean }): Promise<TaskLike> {
    const [owner, name] = model.split('/');
    if (signal?.aborted) throw new DOMException('Task creation aborted', 'AbortError');
    let version = this.modelVersionCache[model];
    if (!version) {
      const info: any = await this.replicate.models.get(owner, name);
      version = info?.latest_version?.id;
      if (version) this.modelVersionCache[model] = version;
    }
    const created: any = await this.replicate.predictions.create({ model: `${owner}/${name}`, version, input });
    const id = created.id;
    const promise = new Promise<any[]>(async (resolve, reject) => {
      try {
        while (true) {
          if (signal?.aborted) throw new DOMException('Result fetch aborted', 'AbortError');
          const r: any = await this.replicate.predictions.get(id);
          if (r.status === 'failed') throw new Error(String(r.error || 'failed'));
          if (r.status === 'succeeded') { resolve((r.output ?? []).map((u: any) => ({ url: u, rawData: r }))); return; }
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (e) { reject(e); }
    });
    const task: TaskLike = {
      taskId: id,
      promise,
      cancelable: true,
      cancel: async () => { try { await this.replicate.predictions.cancel(id); } catch {} },
    };
    return task;
  }

  async uploadImage(type: 'token'|'buffer'|'resource', image: ArrayBuffer|string, format: 'png'|'jpg'|'jpeg'|'webp', signal?: { aborted?: boolean }): Promise<string> {
    if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
    if (type === 'buffer') {
      const arrayBuffer = image as ArrayBuffer;
      const base64 = typeof Buffer !== 'undefined' ? Buffer.from(arrayBuffer).toString('base64') : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      return `data:image/${format};base64,${base64}`;
    }
    const blob = new Blob([String(image)], { type: 'image/uxp' });
    // files.create accepts Blob in the official SDK
    const file: any = await (this.replicate as any).files.create(blob);
    return file?.urls?.get ?? '';
  }
}

