import { sdpppSDK, t } from '@sdppp/common';

type TaskHandleLike<T> = {
    taskId: string;
    promise: Promise<T>;
    cancelable: boolean;
    cancel: () => Promise<void>;
};

export type TaskCtorParams =
    | {
          statusGetter: (id: string) => Promise<{
              isCompleted: boolean;
              progress: number;
              progressMessage: string;
              rawData: any;
          }>;
          resultGetter: (id: string, lastStatusResult: any) => Promise<any>;
          canceler: ((id: string) => Promise<void>) | null;
      }
    | {
          handle: TaskHandleLike<any>;
          attachReporter?: (task: Task<any>) => void;
      };

export class Task<T> {
    public readonly promise: Promise<T>;
    public progress: number = 0;
    public progressMessage: string = '';
    public readonly taskId: string;
    public readonly taskCtorParams: TaskCtorParams;
    public taskName?: string;
    public metadata?: Record<string, any>;
    private canceler: ((id: string) => Promise<void>) | null = null;

    constructor(taskId: string, taskCtorParams: TaskCtorParams) {
        this.taskId = taskId;
        this.taskCtorParams = taskCtorParams;

        if (this.isHandleParams(taskCtorParams)) {
            taskCtorParams.attachReporter?.(this);
            this.registerWithPhotoshop();
            this.canceler = async () => {
                await taskCtorParams.handle.cancel();
            };
            this.cancelable = taskCtorParams.handle.cancelable;
            this.promise = taskCtorParams.handle.promise
                .then(async (result: T) => {
                    await this.updatePhotoshopStatus('completed');
                    return result;
                })
                .catch(async (error: any) => {
                    const message = error instanceof Error ? error.message : String(error);
                    await this.updatePhotoshopStatus('failed', message);
                    throw error;
                });
            return;
        }

        // 注册到 Photoshop
        this.registerWithPhotoshop();

        this.canceler = taskCtorParams.canceler;
        this.promise = new Promise(async (resolve, reject) => {
            while (true) {
                try {
                    const status = await taskCtorParams.statusGetter(this.taskId);
                    if (status.isCompleted) {
                        // 任务完成时更新状态
                        await this.updatePhotoshopStatus('completed');
                        const result = await taskCtorParams.resultGetter(this.taskId, status);
                        resolve(result);
                        break;
                    } else {
                        this.updateProgress(status.progress, status.progressMessage);
                    }
                } catch (error: any) {
                    // 错误时更新状态
                    const message = error instanceof Error ? error.message : String(error);
                    await this.updatePhotoshopStatus('failed', message);
                    reject(error);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        });
        this.cancelable = !!this.canceler;
    }

    public readonly cancelable: boolean = false;

    public updateProgress(progress: number, message?: string) {
        this.progress = this.normalizeProgress(progress);
        if (typeof message === 'string') {
            this.progressMessage = message;
        }
        void this.updatePhotoshopProgress();
    }
    
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
        if (this.canceler) {
            await this.canceler(this.taskId);
            await this.updatePhotoshopStatus('cancelled');
        }
    }

    private normalizeProgress(value: number): number {
        if (!Number.isFinite(value)) {
            return this.progress;
        }
        const normalized = value <= 1 ? value * 100 : value;
        return Math.min(100, Math.max(0, normalized));
    }

    private isHandleParams(params: TaskCtorParams): params is { handle: TaskHandleLike<any>; attachReporter?: (task: Task<any>) => void } {
        return !!(params as any).handle;
    }

    static createReporterBridge() {
        let boundTask: Task<any> | null = null;
        let cachedMetadata: Record<string, any> | undefined;
        let cachedProgress: { value: number; status?: string } | null = null;
        let cachedFinish: { outcome: 'completed' | 'failed' | 'cancelled'; errorMessage?: string } | null = null;

        const applyCached = () => {
            if (!boundTask) return;
            if (cachedMetadata) {
                boundTask.metadata = cachedMetadata;
            }
            if (cachedProgress) {
                boundTask.updateProgress(cachedProgress.value, cachedProgress.status);
            }
            if (cachedFinish && cachedFinish.outcome === 'completed') {
                boundTask.updateProgress(100, cachedFinish.outcome);
            } else if (cachedFinish) {
                boundTask.updateProgress(boundTask.progress, cachedFinish.errorMessage ?? cachedFinish.outcome);
            }
        };

        return {
            reporter: {
                onStart: (_taskId: string, metadata?: Record<string, any>) => {
                    cachedMetadata = metadata;
                    applyCached();
                },
                onProgress: (taskId: string, progress: number, status?: string) => {
                    cachedProgress = { value: progress, status };
                    if (boundTask && boundTask.taskId === taskId) {
                        applyCached();
                    }
                },
                onFinish: (taskId: string, outcome: 'completed' | 'failed' | 'cancelled', errorMessage?: string) => {
                    cachedFinish = { outcome, errorMessage };
                    if (boundTask && boundTask.taskId === taskId) {
                        applyCached();
                    }
                },
            },
            attach: (task: Task<any>) => {
                boundTask = task;
                applyCached();
            },
        };
    }
}
