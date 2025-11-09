import { sdpppSDK } from '../../ps-common/sdk/sdppp-ps-sdk.js';

export class ComfyTaskInternal {
  public readonly taskId: string;
  public readonly promise: Promise<any[]>;
  public progress: number = 0;
  public progressMessage: string = '';
  public taskName: string;
  private cancelled = false;
  private docId: number;
  private boundary: any;

  constructor(runParams: { size: number }, workflowName: string, docId: number, boundary: any) {
    this.taskId = `comfy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.taskName = `ComfyUI - ${workflowName}`;
    this.docId = docId;
    this.boundary = boundary;
    this.registerWithPhotoshop();
    this.promise = this.executeComfyTask(runParams, workflowName);
  }

  private async registerWithPhotoshop() {
    try {
      await sdpppSDK.plugins.photoshop.taskAdd({
        taskId: this.taskId,
        taskName: this.taskName,
        status: 'running',
        startTime: new Date().toISOString(),
        currentStep: 0,
        totalSteps: 100,
        progressPercentage: 0,
        metadata: { provider: 'comfyui', type: 'workflow_execution', docId: this.docId, boundary: this.boundary }
      });
    } catch {}
  }

  private async executeComfyTask(runParams: { size: number }, workflowName: string): Promise<any[]> {
    try {
      const result = await sdpppSDK.plugins.ComfyCaller.run(runParams);
      const images: any[] = [];
      let processed = 0;
      for await (const item of result) {
        if (this.cancelled) throw new Error('Task cancelled');
        processed++;
        this.progress = Math.min((processed / runParams.size) * 100, 95);
        this.progressMessage = `Processing ${processed}/${runParams.size}`;
        await this.updatePhotoshopProgress();
        if ((item as any).images) {
          images.push(...(item as any).images);
        }
      }
      this.progress = 100;
      await this.updatePhotoshopStatus('completed');
      return images;
    } catch (error: any) {
      await this.updatePhotoshopStatus('failed', String(error?.message || error));
      throw error;
    }
  }

  private async updatePhotoshopProgress() {
    try {
      await sdpppSDK.plugins.photoshop.taskUpdate({ taskId: this.taskId, progressPercentage: this.progress, stepDescription: this.progressMessage });
    } catch {}
  }
  private async updatePhotoshopStatus(status: 'completed' | 'failed' | 'cancelled', error?: string) {
    try { await sdpppSDK.plugins.photoshop.taskUpdate({ taskId: this.taskId, status, endTime: new Date().toISOString(), ...(error && { error, errorCode: 'COMFY_ERROR' }) }); } catch {}
  }
  async cancel() { this.cancelled = true; try { await sdpppSDK.plugins.ComfyCaller.stopAll(); await this.updatePhotoshopStatus('cancelled'); } catch {} }
}

