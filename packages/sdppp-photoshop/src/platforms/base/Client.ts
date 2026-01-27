import { WidgetableNode } from "@sdppp/common/schemas/schemas";
import type { Task } from "./Task";

export abstract class Client<T> {
    protected readonly config: T
    private activeTasks: Set<Task<any>> = new Set()
    private abortController: AbortController | null = null

    constructor(config: T) {
        this.config = config
    }

    abstract getNodes(model: string): Promise<{
        widgetableNodes: WidgetableNode[],  
        defaultInput: Record<string, any>,
        rawData: any
    }>;
    
    abstract run(model: string, input: any, signal?: AbortSignal): Promise<Task<any>>;
    
    abstract uploadImage(type: 'token' | 'buffer' | 'resource', image: ArrayBuffer | string, format: 'png' | 'jpg' | 'jpeg' | 'webp', signal?: AbortSignal): Promise<string>;

    /**
     * 执行任务并跟踪活动任务
     */
    async runWithTracking(model: string, input: any, signal?: AbortSignal): Promise<Task<any>> {
        const task = await this.run(model, input, signal);
        this.activeTasks.add(task);
        
        // 任务完成或失败时从活动任务中移除
        task.promise.finally(() => {
            this.activeTasks.delete(task);
        });
        
        return task;
    }

    /**
     * 中断所有活动任务
     */
    async cancelAllTasks(): Promise<void> {
        const cancelPromises = Array.from(this.activeTasks).map(async (task) => {
            if (task.cancelable) {
                await task.cancel();
            }
        });
        
        await Promise.allSettled(cancelPromises);
        this.activeTasks.clear();
    }

    /**
     * 创建新的AbortController用于后续操作
     */
    createAbortController(): AbortController {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        return this.abortController;
    }

    /**
     * 中断当前的AbortController
     */
    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * 获取当前活动任务数量
     */
    getActiveTaskCount(): number {
        return this.activeTasks.size;
    }

    /**
     * 获取所有活动任务
     */
    getActiveTasks(): Task<any>[] {
        return Array.from(this.activeTasks);
    }

    /**
     * 检查是否有活动任务
     */
    hasActiveTasks(): boolean {
        return this.activeTasks.size > 0;
    }
}
