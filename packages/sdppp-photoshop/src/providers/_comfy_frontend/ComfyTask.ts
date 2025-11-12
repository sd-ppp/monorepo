import { sdpppSDK, t } from '@sdppp/common';
import { MainStore } from '../../tsx/App.store';
import { BoundaryRectSchema } from '@sdppp/common/schemas/schemas';
import { z } from 'zod';

type BoundaryRect = z.infer<typeof BoundaryRectSchema>;


export class ComfyTask {
    public readonly taskId: string;
    public readonly promise: Promise<any[]>;
    public progress: number = 0;
    public progressMessage: string = '';
    public taskName: string;
    private cancelled = false;
    private docId: number;
    private boundary: BoundaryRect;

    constructor(runParams: { size: number }, workflowName: string, docId: number, boundary: any) {
        this.taskId = `comfy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        this.taskName = t('comfy.task.name', {
            workflowName,
            defaultValue: 'ComfyUI - {{workflowName}}'
        });
        this.docId = docId;
        this.boundary = boundary;

        // 注册到 Photoshop
        this.registerWithPhotoshop();

        // 执行任务
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
                metadata: {
                    provider: 'comfyui',
                    type: 'workflow_execution',
                    docId: this.docId,
                    boundary: this.boundary
                }
            });
        } catch (error) {
            console.warn('Failed to register ComfyUI task:', error);
        }
    }

    private async executeComfyTask(runParams: { size: number }, workflowName: string): Promise<any[]> {
        try {
            const result = await sdpppSDK.plugins.ComfyCaller.run(runParams);
            const images: any[] = [];
            let processedCount = 0;

            for await (const item of result) {
                if (this.cancelled) {
                    throw new Error(t('comfy.error.task_cancelled', { defaultValue: 'Task cancelled' }));
                }

                // 更新进度
                processedCount++;
                this.progress = Math.min((processedCount / runParams.size) * 100, 95);
                this.progressMessage = t('comfy.task.processing_progress', {
                    processed: processedCount,
                    total: runParams.size,
                    defaultValue: 'Processing {{processed}}/{{total}}'
                });

                await this.updatePhotoshopProgress();

                if (item.images) {
                    images.push(...item.images);
                    // 处理图片结果（保持现有逻辑）
                    item.images.forEach((image: any) => {
                        MainStore.getState().downloadAndAppendImage({
                            url: image.url,
                            source: workflowName,
                            docId: this.docId,
                            boundary: this.boundary
                        });
                    });
                }
            }

            // 任务完成
            this.progress = 100;
            await this.updatePhotoshopStatus('completed');
            return images;

        } catch (error) {
            await this.updatePhotoshopStatus('failed', (error as Error).message);
            throw error;
        }
    }

    private async updatePhotoshopProgress() {
        try {
            await sdpppSDK.plugins.photoshop.taskUpdate({
                taskId: this.taskId,
                progressPercentage: this.progress,
                stepDescription: this.progressMessage
            });
        } catch (error) {
            console.warn('Failed to update ComfyUI task progress:', error);
        }
    }

    private async updatePhotoshopStatus(status: 'completed' | 'failed' | 'cancelled', error?: string) {
        try {
            await sdpppSDK.plugins.photoshop.taskUpdate({
                taskId: this.taskId,
                status: status,
                endTime: new Date().toISOString(),
                ...(error && { error, errorCode: 'COMFY_ERROR' })
            });
        } catch (err) {
            console.warn('Failed to update ComfyUI task status:', err);
        }
    }

    async cancel() {
        this.cancelled = true;
        try {
            await sdpppSDK.plugins.ComfyCaller.stopAll();
            await this.updatePhotoshopStatus('cancelled');
        } catch (error) {
            console.warn('Failed to cancel ComfyUI task:', error);
        }
    }
}
