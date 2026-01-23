import { sdpppSDK, t } from '@sdppp/common';
export interface TaskCtorParams {
    statusGetter: (id: string) => Promise<{
        isCompleted: boolean;
        progress: number;
        progressMessage: string;
        rawData: any;
    }>;
    resultGetter: (id: string, lastStatusResult: any) => Promise<any>;
    canceler: ((id: string) => Promise<void>) | null;
}

export class Task<T> {
    public readonly promise: Promise<T>;
    public progress: number = 0;
    public progressMessage: string = '';
    public readonly taskId: string;
    public readonly taskCtorParams: TaskCtorParams;
    public taskName?: string;
    public metadata?: Record<string, any>;

    constructor(taskId: string, taskCtorParams: TaskCtorParams) {
        this.taskId = taskId;
        this.taskCtorParams = taskCtorParams;
        
        // 注册到 Photoshop
        this.registerWithPhotoshop();
        
        this.promise = new Promise(async (resolve, reject) => {
            while (true) {
                try {
                    const status = await this.taskCtorParams.statusGetter(this.taskId);
                    if (status.isCompleted) {
                        // 任务完成时更新状态
                        await this.updatePhotoshopStatus('completed');
                        const result = await this.taskCtorParams.resultGetter(this.taskId, status);
                        resolve(result);
                        break;
                    } else {
                        this.progress = status.progress;
                        this.progressMessage = status.progressMessage;
                        // 实时更新进度
                        await this.updatePhotoshopProgress();
                    }
                } catch (error) {
                    // 错误时更新状态
                    await this.updatePhotoshopStatus('failed', error.message);
                    reject(error);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        });
        this.cancelable = !!this.taskCtorParams.canceler;
    }

    public readonly cancelable: boolean = false;
    
    private async registerWithPhotoshop() {
        try {
            await sdpppSDK.plugins.photoshop.taskAdd({
                taskId: this.taskId,
                taskName: this.taskName || t('task.default_name', { defaultValue: 'AI Generation Task' }),
                status: 'running',
                startTime: new Date().toISOString(),
                currentStep: 0,
                totalSteps: 100,
                progressPercentage: 0,
                metadata: this.metadata
            });
        } catch (error) {
            console.warn('Failed to register task with Photoshop:', error);
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
            console.warn('Failed to update task progress:', error);
        }
    }

    private async updatePhotoshopStatus(status: 'completed' | 'failed' | 'cancelled', error?: string) {
        try {
            await sdpppSDK.plugins.photoshop.taskUpdate({
                taskId: this.taskId,
                status: status,
                endTime: new Date().toISOString(),
                ...(error && { error, errorCode: 'TASK_ERROR' })
            });
        } catch (err) {
            console.warn('Failed to update task status:', err);
        }
    }

    async cancel() {
        if (this.taskCtorParams.canceler) {
            await this.taskCtorParams.canceler(this.taskId);
            await this.updatePhotoshopStatus('cancelled');
        }
    }
}
