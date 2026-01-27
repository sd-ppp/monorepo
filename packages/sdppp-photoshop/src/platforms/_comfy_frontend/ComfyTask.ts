import { sdpppSDK, t } from '@sdppp/common';
import { MainStore } from '../../tsx/App.store';

export interface ComfyTaskImageContext {
    workflowName: string;
    docId: number;
    boundaryUri: string | null;
    maskUri: string | null;
    replaceExisting?: boolean;
}

export interface ComfyTaskOptions {
    handleImageResult?: (image: any, context: ComfyTaskImageContext) => void | Promise<void>;
    replaceExisting?: boolean;
}

export const defaultComfyTaskImageHandler = (image: any, context: ComfyTaskImageContext) => {
    return MainStore.getState().downloadAndAppendImage({
        url: image.url,
        source: context.workflowName,
        docId: context.docId,
        boundaryUri: context.boundaryUri,
        maskUri: context.maskUri,
        maskHandle: null,
    }, {
        replaceExisting: context.replaceExisting === true,
    });
};

export class ComfyTask {
    public readonly taskId: string;
    public readonly promise: Promise<any[]>;
    public progress: number = 0;
    public progressMessage: string = '';
    public taskName: string;
    private cancelled = false;
    private docId: number;
    private boundaryUri: string | null;
    private maskUri: string | null;
    private readonly handleImageResult: (image: any, context: ComfyTaskImageContext) => void | Promise<void>;
    private readonly replaceExisting: boolean;

    constructor(
        runParams: { size: number, mode?: 'app' | 'api' },
        workflowName: string,
        docId: number,
        boundaryUri: string | null,
        maskUri: string | null = null,
        options: ComfyTaskOptions = {}
    ) {
        this.taskId = `comfy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        this.taskName = t('comfy.task.name', {
            workflowName,
            defaultValue: 'ComfyUI - {{workflowName}}'
        });
        this.docId = docId;
        this.boundaryUri = boundaryUri ?? null;
        this.maskUri = maskUri ?? null;
        this.replaceExisting = options.replaceExisting === true;
        this.handleImageResult = options.handleImageResult ?? defaultComfyTaskImageHandler;

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
                metadata: {
                    provider: 'comfyui',
                    type: 'workflow_execution',
                    docId: this.docId,
                    boundaryUri: this.boundaryUri,
                    maskUri: this.maskUri,
                }
            });
        } catch (error) {
            console.warn('Failed to register ComfyUI task:', error);
        }
    }

    private async executeComfyTask(runParams: { size: number, mode?: 'app' | 'api' }, workflowName: string): Promise<any[]> {
        try {
            const result = await sdpppSDK.plugins.ComfyCaller.run(runParams);
            const images: any[] = [];
            let processedCount = 0;

            for await (const item of result) {
                if (this.cancelled) {
                    throw new Error(t('comfy.error.task_cancelled', { defaultValue: 'Task cancelled' }));
                }

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
                    for (const image of item.images) {
                        await this.handleImageResult(image, {
                            workflowName,
                            docId: this.docId,
                            boundaryUri: this.boundaryUri,
                            maskUri: this.maskUri,
                            replaceExisting: this.replaceExisting,
                        });
                    }
                }
            }

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
            await sdpppSDK.plugins.ComfyCaller.stopAll({});
            await this.updatePhotoshopStatus('cancelled');
        } catch (error) {
            console.warn('Failed to cancel ComfyUI task:', error);
        }
    }
}
