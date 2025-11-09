import { getCurrentLanguage } from '@sdppp/common';

export type TaskLike<T = any> = { taskId: string; promise: Promise<T>; cancelable?: boolean; cancel?: () => Promise<void> | void };

export class SDPPPRunningHubClient {
  private static nodeInfoListStore: Record<string, any[] | undefined> = {};
  constructor(private config: { apiKey: string }) {}

  private getBaseHost(): string {
    const locale = getCurrentLanguage();
    return locale === 'en-US' ? 'www.runninghub.ai' : 'www.runninghub.cn';
  }

  async getNodes(webappId: string): Promise<{ widgetableNodes: any[]; defaultInput: Record<string, any>; rawData: any }> {
    const apiUrl = `https://${this.getBaseHost()}/api/webapp/apiCallDemo?apiKey=${this.config.apiKey}&webappId=${webappId}`;
    const response = await fetch(apiUrl, { headers: { Host: this.getBaseHost() } });
    if (!response.ok) throw new Error(`getNodes HTTP ${response.status}`);
    const formData = await response.json();
    if (formData.code !== 0) throw new Error(`getNodes failed: ${formData.msg || 'unknown'}`);
    const { widgetableNodes, defaultInput } = this.convertFormDataToNodes(formData.data);
    SDPPPRunningHubClient.nodeInfoListStore[webappId] = Array.isArray(formData?.data?.nodeInfoList) ? formData.data.nodeInfoList : undefined;
    return { widgetableNodes, defaultInput, rawData: formData };
  }

  async run(webappId: string, input: any, signal?: { aborted?: boolean }): Promise<TaskLike> {
    if (signal?.aborted) throw new DOMException('Task creation aborted', 'AbortError');
    let current = SDPPPRunningHubClient.nodeInfoListStore[webappId];
    if (!current || current.length === 0) {
      await this.getNodes(webappId);
      current = SDPPPRunningHubClient.nodeInfoListStore[webappId];
    }
    if (!current || current.length === 0) throw new Error('nodeInfoList unavailable');
    const nodeInfoList = this.mergeInputWithNodeInfoList(current, input);
    const apiUrl = `https://${this.getBaseHost()}/task/openapi/ai-app/run`;
    const resp = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: this.config.apiKey, webappId, nodeInfoList, instanceType: 'default' }) });
    if (!resp.ok) throw new Error(`run HTTP ${resp.status}`);
    const result = await resp.json();
    if (result.code !== 0) throw new Error(result.msg || 'run failed');
    const taskId: string = result.data.taskId;
    const promise = new Promise<any[]>(async (resolve, reject) => {
      try {
        while (true) {
          if (signal?.aborted) throw new DOMException('Status check aborted', 'AbortError');
          const statusResp = await fetch(`https://${this.getBaseHost()}/task/openapi/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: this.config.apiKey, taskId }), });
          if (!statusResp.ok) throw new Error(`status HTTP ${statusResp.status}`);
          const statusData = await statusResp.json();
          if (statusData.code !== 0) throw new Error(statusData.msg || 'status failed');
          const st = statusData.data;
          if (st === 'SUCCESS') {
            const outputsResp = await fetch(`https://${this.getBaseHost()}/task/openapi/outputs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: this.config.apiKey, taskId }), });
            if (!outputsResp.ok) throw new Error(`outputs HTTP ${outputsResp.status}`);
            const outputsData = await outputsResp.json();
            if (outputsData.code !== 0) throw new Error(outputsData.msg || 'outputs failed');
            const outputs = (outputsData.data || []).map((o: any) => ({ url: o.fileUrl, rawData: o }));
            resolve(outputs);
            return;
          }
          if (st === 'FAILED') throw new Error(statusData.msg || 'FAILED');
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (e) { reject(e); }
    });
    return { taskId, promise, cancelable: true, cancel: async () => { await fetch(`https://${this.getBaseHost()}/task/openapi/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: this.config.apiKey, taskId }) }); } };
  }

  async uploadImage(type: 'token'|'buffer'|'resource', image: ArrayBuffer|string, format: 'png'|'jpg'|'jpeg'|'webp', signal?: { aborted?: boolean }): Promise<string> {
    if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
    let buffer: ArrayBuffer;
    if (type === 'buffer') {
      buffer = image as ArrayBuffer;
    } else {
      const { sdpppSDK } = await import('../../ps-common/sdk/sdppp-ps-sdk.js');
      const token = image as string;
      const { base64, error } = await sdpppSDK.plugins.photoshop.getImageBase64({ token });
      if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
      if (error || !base64) throw new Error(error || 'Failed to load resource data');
      const payload = base64.startsWith('data:') ? base64.split(',')[1] : base64;
      const bytes = typeof Buffer !== 'undefined' ? Buffer.from(payload, 'base64') : new Uint8Array(atob(payload).split('').map(c => c.charCodeAt(0)));
      buffer = bytes.buffer ?? (bytes as any);
    }
    const apiUrl = `https://${this.getBaseHost()}/task/openapi/upload`;
    const filename = `runninghub_${Math.random().toString(36).slice(2,8)}_${Date.now()}.${format}`;
    const blob = new Blob([buffer], { type: `image/${format}` });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('fileType', 'image');
    form.append('apiKey', this.config.apiKey);
    const resp = await fetch(apiUrl, { method: 'POST', body: form, signal: (signal as any)?.signal });
    if (!resp.ok) throw new Error(`upload HTTP ${resp.status}`);
    const result = await resp.json();
    if (result.code !== 0) throw new Error(result.msg || 'upload failed');
    return result.data.fileName;
  }

  private mergeInputWithNodeInfoList(nodeInfoList: any[], input: Record<string, any>): any[] {
    return nodeInfoList.map(node => {
      const nodeKey = `${node.nodeId}_${node.fieldName}`;
      let fieldValue = input[nodeKey] !== undefined ? input[nodeKey] : node.fieldValue;
      const ft = String(node.fieldType || '').toUpperCase();
      if (ft === 'IMAGE' || ft === 'FILE') {
        if (Array.isArray(fieldValue)) {
          const first = fieldValue[0];
          fieldValue = first && typeof first === 'object' && (first as any).url ? (first as any).url : first;
        } else if (fieldValue && typeof fieldValue === 'object' && (fieldValue as any).url) {
          fieldValue = (fieldValue as any).url;
        }
      }
      return { ...node, fieldValue };
    });
  }

  private convertFormDataToNodes(formData: any): { widgetableNodes: any[]; defaultInput: Record<string, any> } {
    const widgetableNodes: any[] = [];
    const defaultInput: Record<string, any> = {};
    if (formData.nodeInfoList && Array.isArray(formData.nodeInfoList)) {
      formData.nodeInfoList.forEach((node: any, index: number) => {
        const widget: any = { name: '', uiWeight: 12, outputType: this.mapFieldTypeToOutputType(node.fieldType), options: this.createFieldOptions(node) };
        const widgetableNode: any = { id: `${node.nodeId}_${node.fieldName}`, title: node.description || node.fieldName || `field_${index}`, widgets: [widget], uiWeightSum: widget.uiWeight };
        widgetableNodes.push(widgetableNode);
        defaultInput[widgetableNode.id] = widget.outputType === 'images' ? null : node.fieldValue || this.getDefaultValueForType(widget.outputType);
      });
    }
    return { widgetableNodes, defaultInput };
  }

  private mapFieldTypeToOutputType(fieldType: string): string {
    switch ((fieldType || '').toLowerCase()) {
      case 'text': case 'string': return 'string';
      case 'number': case 'integer': case 'int': case 'float': return 'number';
      case 'list': case 'select': case 'dropdown': case 'switch': return 'combo';
      case 'image': case 'file': return 'images';
      case 'boolean': return 'boolean';
      default: return 'string';
    }
  }
  private createFieldOptions(node: any): any {
    const options: any = { required: node.required || false };
    let fieldData: any = [];
    try { fieldData = JSON.parse(node.fieldData || '[]'); } catch {}
    if (node.fieldType === 'FLOAT' || node.fieldType === 'INT') {
      options.min = fieldData[1]?.min; options.max = fieldData[1]?.max; options.step = node.fieldType === 'INT' ? 1 : 0.01; options.slider = (options.max - options.min) < 1000;
    }
    if (node.fieldType === 'LIST' || node.fieldType === 'select' || node.fieldType === 'dropdown' || node.fieldType === 'SWITCH') {
      if (Array.isArray(fieldData[0])) options.values = fieldData[0];
      else if (Array.isArray(fieldData)) { options.values = fieldData.filter((i: any) => i.name && i.index).map((i: any) => i.name); options.labels = fieldData.filter((i: any) => i.name && i.index).map((i: any) => i.description || i.name); }
      else options.values = [];
    }
    if (node.fieldType === 'IMAGE' || node.fieldType === 'file') options.maxCount = node.maxCount || 1;
    return options;
  }
  private getDefaultValueForType(outputType: string): any {
    switch (outputType) { case 'string': return ''; case 'number': return 0; case 'boolean': return false; case 'combo': return null; case 'images': return []; default: return null; }
  }
}

