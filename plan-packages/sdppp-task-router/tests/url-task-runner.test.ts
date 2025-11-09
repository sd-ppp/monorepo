import { describe, it, expect, vi, beforeEach } from 'vitest';

// Important: mock provider client modules that the handlers dynamically import
vi.mock('../src/clients/replicate', () => {
  class FakeReplicateClient {
    cfg: any;
    constructor(cfg: any) { this.cfg = cfg; }
    async getNodes(model: string) {
      return { widgetableNodes: [{ id: 'prompt' }], defaultInput: { prompt: '' }, rawData: { model } };
    }
    async run(model: string, input: any) {
      return {
        taskId: `replicate:${model}`,
        promise: Promise.resolve([{ url: 'replicate://output', rawData: { input, apiKey: this.cfg.apiKey } }])
      };
    }
    async uploadImage(type: any, image: any, format: any) {
      return `replicate-upload://${format}`;
    }
  }
  return { SDPPPReplicateClient: FakeReplicateClient };
});

vi.mock('../src/clients/runninghub', () => {
  class FakeRunningHubClient {
    cfg: any;
    constructor(cfg: any) { this.cfg = cfg; }
    async getNodes(webappId: string) {
      return { widgetableNodes: [{ id: 'image' }], defaultInput: {}, rawData: { webappId } };
    }
    async run(webappId: string, input: any) {
      return {
        taskId: `runninghub:${webappId}`,
        promise: Promise.resolve([{ url: 'runninghub://output', rawData: { input, apiKey: this.cfg.apiKey } }])
      };
    }
    async uploadImage(type: any, image: any, format: any) {
      return `runninghub-upload://${format}`;
    }
  }
  return { SDPPPRunningHubClient: FakeRunningHubClient };
});

vi.mock('../src/clients/customapi', () => {
  class FakeCustomApiClient {
    cfg: any;
    constructor(cfg: any) { this.cfg = cfg; }
    async getNodes(model: string) {
      return { widgetableNodes: [{ id: 'image_input' }], defaultInput: { image_input: null }, rawData: { model } };
    }
    async run(model: string, input: any) {
      return {
        taskId: `customapi:${model}`,
        promise: Promise.resolve([{ url: 'customapi://output', rawData: { input, cfg: this.cfg } }])
      };
    }
    async uploadImage(type: any, image: any, format: any) {
      return `customapi-upload://${format}`;
    }
  }
  return { SDPPPCustomApiClient: FakeCustomApiClient };
});

import { run, describe as describeTask, upload, cancel } from '../src/index';

describe('UrlTaskRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs replicate task', async () => {
    const task = await run('replicate://owner/modelX', { prompt: 'a cat' }, { config: { apiKey: 'rk' } });
    expect(task.taskId).toBe('replicate:owner/modelX');
    const outputs = await task.promise;
    expect(outputs[0].url).toContain('replicate://');
    expect(outputs[0].rawData.input.prompt).toBe('a cat');
  });

  it('runs runninghub task with nodeInfoList', async () => {
    const data = { nodeInfoList: [{ nodeId: '1', fieldName: 'prompt', fieldValue: 'hi' }] };
    const task = await run('runninghub://app-123', data, { config: { apiKey: 'hk' } });
    expect(task.taskId).toBe('runninghub:app-123');
    const outputs = await task.promise;
    expect(outputs[0].rawData.input.nodeInfoList[0].fieldName).toBe('prompt');
  });

  it('runs customapi (google) task', async () => {
    const url = 'customapi://google?baseURL=https://api.example.com';
    const data = { prompt: 'draw', image_input: 'data:image/png;base64,xxx' };
    const task = await run(url, data, { config: { apiKey: 'gk' } });
    expect(task.taskId).toBe('customapi:google');
    const outputs = await task.promise;
    expect(outputs[0].rawData.cfg.baseURL).toContain('api.example.com');
  });

  it('describe returns form schema via url', async () => {
    const rep = await describeTask('replicate://owner/modelX', { config: { apiKey: 'rk' } });
    expect(rep.widgetableNodes[0].id).toBe('prompt');
    const rh = await describeTask('runninghub://app-123', { config: { apiKey: 'hk' } });
    expect(rh.rawData.webappId).toBe('app-123');
    const ca = await describeTask('customapi://google?baseURL=https://x', { config: { apiKey: 'gk' } });
    expect(ca.defaultInput).toHaveProperty('image_input');
  });

  it('upload delegates to provider client', async () => {
    const res1 = await upload('replicate://owner/modelX', { type: 'buffer', image: new Uint8Array([1]).buffer, format: 'png' }, { config: { apiKey: 'rk' } });
    expect(res1).toMatch(/replicate-upload:\/\//);
    const res2 = await upload('runninghub://app-1', { type: 'buffer', image: new Uint8Array([1]).buffer, format: 'png' }, { config: { apiKey: 'hk' } });
    expect(res2).toMatch(/runninghub-upload:\/\//);
    const res3 = await upload('customapi://google', { type: 'buffer', image: new Uint8Array([1]).buffer, format: 'png' }, { config: { apiKey: 'gk' } });
    expect(res3).toMatch(/customapi-upload:\/\//);
  });

  it('cancel calls task.cancel when available', async () => {
    const t = {
      taskId: 't1',
      promise: Promise.resolve([]),
      cancelable: true,
      cancel: vi.fn().mockResolvedValue(undefined)
    };
    await cancel(t as any);
    expect(t.cancel).toHaveBeenCalled();
  });

  it('throws on invalid url', async () => {
    await expect(run('not-a-url', {}, {})).rejects.toThrow(/Invalid url/);
  });

  it('throws on missing apiKey for replicate', async () => {
    await expect(run('replicate://owner/model', {})).rejects.toThrow(/apiKey/);
  });

  it('runs comfy workflow via handler', async () => {
    vi.resetModules();
    vi.doMock('../src/clients/comfy', () => {
      class FakeComfyTask {
        taskId: string;
        promise: Promise<any[]>;
        constructor(runParams: { size: number }, workflowName: string, docId: number, boundary: any) {
          this.taskId = `comfy_${workflowName}`;
          this.promise = Promise.resolve([{ images: [{ url: 'x' }] } as any]);
        }
        async cancel() { /* noop */ }
      }
      return { ComfyTaskInternal: FakeComfyTask };
    });
    vi.doMock('../../ps-common/sdk/sdppp-ps-sdk.js', () => ({ sdpppSDK: { plugins: { photoshop: { uploadComfyImage: vi.fn().mockResolvedValue({ name: 'fname' }) }, ComfyCaller: { listWorkflows: vi.fn().mockResolvedValue({ workflows: ['wf'] }) } } } }));
    const task = await run('comfy://my-workflow?size=2', {});
    expect(task.taskId).toBe('comfy_my-workflow');
    const outputs = await task.promise;
    expect(outputs[0].images?.length ?? 0).toBeGreaterThan(0);
  });

  it('comfy describe and upload work', async () => {
    vi.resetModules();
    vi.doMock('../src/clients/comfy', () => ({ ComfyTaskInternal: class {} }));
    const uploadSpy = vi.fn().mockResolvedValue({ name: 'uploaded_name' });
    vi.doMock('../../ps-common/sdk/sdppp-ps-sdk.js', () => ({ sdpppSDK: { plugins: { photoshop: { uploadComfyImage: uploadSpy }, ComfyCaller: { listWorkflows: vi.fn().mockResolvedValue({ workflows: ['wf'] }) } } } }));

    const meta = await describeTask('comfy://wf1');
    expect(Array.isArray(meta.widgetableNodes)).toBe(true);
    expect(meta.defaultInput).toHaveProperty('size');

    const res = await upload('comfy://wf1', { type: 'buffer', image: new ArrayBuffer(1), format: 'png' });
    expect(res).toBe('uploaded_name');
    expect(uploadSpy).toHaveBeenCalled();
  });
});
