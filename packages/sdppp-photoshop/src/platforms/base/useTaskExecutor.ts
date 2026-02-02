import { t, sdpppSDK } from '@sdppp/common';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { useEffect } from 'react';
import { MainStore } from '../../tsx/App.store';
import { useTaskExecutionStore } from './taskExecutionStore';

export interface UseTaskExecutorOptions {
    selectedModel: string;
    currentValues: any;
    getCurrentValues?: () => any;
    createTask: (model: string, values: any) => Promise<any>;
    runningTasks: any[];
    beforeCreateTaskHook: (values: any) => any;
    templateCancelable?: boolean | null;
}

export function useTaskExecutor({
    selectedModel,
    currentValues,
    getCurrentValues,
    createTask,
    runningTasks,
    beforeCreateTaskHook,
    templateCancelable,
}: UseTaskExecutorOptions) {
    // 🎯 使用独立的 store，不触发组件重渲染
    const setProgressMessage = useTaskExecutionStore(state => state.setProgressMessage);
    const setLastStartTime = useTaskExecutionStore(state => state.setLastStartTime);
    const setIsRunning = useTaskExecutionStore(state => state.setIsRunning);
    const setIsImporting = useTaskExecutionStore(state => state.setIsImporting);
    const setCurrentTask = useTaskExecutionStore(state => state.setCurrentTask);
    const setRunError = useTaskExecutionStore(state => state.setRunError);
    
    // 🎯 只在需要时订阅（用于返回给调用方）
    const isRunning = useTaskExecutionStore(state => state.isRunning);
    const lastStartTime = useTaskExecutionStore(state => state.lastStartTime);
    const isImporting = useTaskExecutionStore(state => state.isImporting);
    const currentTask = useTaskExecutionStore(state => state.currentTask);
    // 🎯 runError 不再返回给调用方，由 useTaskStatus hook 订阅

    // 进度跟踪逻辑 - 🎯 直接更新 store，不触发调用方组件重渲染
    useEffect(() => {
        if (!lastStartTime || isImporting) {
            return;
        }
        const interval = setInterval(() => {
            const state = useTaskExecutionStore.getState();
            if (state.isImporting) {
                return;
            }
            if (state.lastStartTime > 0 && runningTasks.length > 0) {
                setProgressMessage(t('task.running_duration', { 
                    duration: ((Date.now() - state.lastStartTime) / 1000).toFixed(2), 
                    message: runningTasks[0].progressMessage 
                }));
            }
        }, 10);  // 🎯 改为 10ms (0.01秒) 更新一次

        return () => {
            clearInterval(interval);
            const state = useTaskExecutionStore.getState();
            if (!state.isImporting) {
                setProgressMessage('');
            }
        }
    }, [lastStartTime, runningTasks, setProgressMessage, isImporting]);

    // 当存在正在运行的任务时，从 store 中恢复本地状态
    useEffect(() => {
        if (useTaskExecutionStore.getState().isImporting) {
            return;
        }
        if (!runningTasks.length) {
            // 🎯 任务结束时只清空进度相关状态，保留错误信息以便用户查看
            if (useTaskExecutionStore.getState().isImporting) {
                return;
            }
            setProgressMessage('');
            setLastStartTime(0);
            setIsRunning(false);
            setCurrentTask(null);
            // ❌ 不清空 runError，让错误信息保持显示
            return;
        }

        const activeTask = runningTasks[0];
        if (currentTask === activeTask && lastStartTime) {
            return;
        }

        setCurrentTask(activeTask);
        setIsRunning(true);
        const fallbackStartedAt =
            typeof activeTask?.startedAt === 'number' && Number.isFinite(activeTask.startedAt)
                ? activeTask.startedAt
                : Date.now();
        setLastStartTime(fallbackStartedAt);
        setProgressMessage(
            activeTask?.progressMessage
                ? activeTask.progressMessage
                : t('task.running', { defaultValue: '运行中...' })
        );
    }, [runningTasks, currentTask, lastStartTime, setCurrentTask, setIsRunning, setLastStartTime, setProgressMessage, isImporting]);

    // 任务执行逻辑
    const handleRun = async () => {
        setRunError('');
        setProgressMessage(t('task.waiting_upload'));
        setIsRunning(true);
        setIsImporting(false);

        // 🆕 获取选区遮罩信息
        const photoshopState = sdpppSDK.stores.PhotoshopStore.getState();
        const activeDocId = photoshopState?.activeDocumentID;
        const selectionBoundary = photoshopState?.selectionBoundary ?? null;

        // 🆕 检查是否有有效选区
        const hasSelectionMask = Boolean(
            selectionBoundary &&
            Number.isFinite(selectionBoundary.width) &&
            Number.isFinite(selectionBoundary.height) &&
            selectionBoundary.width > 0 &&
            selectionBoundary.height > 0
        );

        // 🆕 构建选区遮罩 URI
        const selectionMaskUri =
            typeof activeDocId === 'number' && Number.isFinite(activeDocId)
            && hasSelectionMask
            ? `uxp://mask/${activeDocId}/selection`
            : null;

        // 等待一帧以确保各 UploadProvider 通过 onCallOnValueChange 将最终值写回表单
        await new Promise(resolve => setTimeout(resolve, 100));

        setProgressMessage(t('task.creating_task'));
        // 在任务开始时读取并冻结 docId 与 boundary，保持与 ComfyTask 一致
        const docIdAtStart = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID ?? 0;
        const webviewStateAtStart = sdpppSDK.stores.WebviewStore.getState();
        const boundaryAtStart = webviewStateAtStart?.workBoundaries?.[docIdAtStart] ?? null;
        const imageSizeLimitAtStart = webviewStateAtStart?.workBoundaryMaxSizes?.[docIdAtStart];
        const imageQualityAtStart = webviewStateAtStart?.workBoundaryImageQualities?.[docIdAtStart];
        const boundaryUriAtStart = buildBoundaryUri(docIdAtStart, boundaryAtStart ?? null, {
            imageSize: typeof imageSizeLimitAtStart === 'number' && Number.isFinite(imageSizeLimitAtStart) && imageSizeLimitAtStart > 0
                ? Math.round(imageSizeLimitAtStart)
                : undefined,
            imageQuality: typeof imageQualityAtStart === 'number' && Number.isFinite(imageQualityAtStart)
                ? Math.round(imageQualityAtStart)
                : undefined
        });

        // 🆕 创建遮罩文件资源
        let maskFileResourceUri: string | null = null;
        if (selectionMaskUri) {
            const psActions = sdpppSDK.plugins?.photoshop as Record<string, any> | undefined;
            const createMaskAction = psActions?.['fileResource.createByMask'];
            if (typeof createMaskAction === 'function') {
                try {
                    const maskResult = await createMaskAction({
                        maskUri: selectionMaskUri,
                        boundaryUri: boundaryUriAtStart
                    });
                    if (maskResult?.error) {
                        console.warn('[TaskRouter] selection mask materialization failed:', maskResult.error);
                    } else if (typeof maskResult?.resource === 'string') {
                        const normalizedResource = maskResult.resource.trim();
                        if (normalizedResource) {
                            maskFileResourceUri = normalizedResource;
                        }
                    }
                } catch (maskError) {
                    console.warn('[TaskRouter] selection mask materialization error:', maskError);
                }
            } else {
                console.warn('[TaskRouter] selection mask action unavailable');
            }
        }

        // 在创建任务前调用 hook 来修改 currentValues
        const liveValues = getCurrentValues ? getCurrentValues() : currentValues;
        console.log('[TaskRouter:Executor] Live values from getCurrentValues:', {
          liveValues: JSON.stringify(liveValues, null, 2),
        });
        
        const finalValues = beforeCreateTaskHook ? beforeCreateTaskHook(liveValues) : liveValues;
        console.log('[TaskRouter:Executor] Final values after hook:', {
          finalValues: JSON.stringify(finalValues, null, 2),
        });
        
        try {
            const task = await createTask(selectedModel, finalValues);

            setCurrentTask(task);
            setLastStartTime(Date.now());
            if (task) {
                try {
                    const result = await task.promise;
                    sdpppSDK.logger?.('[TaskRouter] Task completed, result:', result);
                    
                    // 🎯 兼容多种结果结构：
                    // - TaskRouter: { status, outputs: [...] }
                    // - Replicate/RunningHub/CustomAPI: outputs[]
                    const outputs = Array.isArray(result)
                        ? result
                        : (Array.isArray((result as any)?.outputs) ? (result as any).outputs : []);
                    const resultStatusRaw = (result as any)?.status;
                    const resultStatus = typeof resultStatusRaw === 'string' ? resultStatusRaw.trim().toLowerCase() : null;
                    const looksFailed = resultStatus && ['failed', 'error', 'cancelled', 'canceled'].includes(resultStatus);
                    if (looksFailed) {
                        const errorMessage =
                            (result as any)?.errorMessage ||
                            (result as any)?.error ||
                            (result as any)?.message ||
                            `Task failed: ${resultStatusRaw}`;
                        setRunError(String(errorMessage));
                        return;
                    }
                    
                    if (!Array.isArray(outputs) || outputs.length === 0) {
                        sdpppSDK.logger?.('[TaskRouter] No outputs to import');
                        return;
                    }
                    
                    sdpppSDK.logger?.(`[TaskRouter] Starting to import ${outputs.length} images...`);
                    
                    // 🎯 标记正在导入，防止 useEffect 覆盖进度消息
                    setIsImporting(true);
                    setIsRunning(false);
                    setLastStartTime(0);
                    
                    // 将结果图片发送到预览区
                    for (let i = 0; i < outputs.length; i++) {
                        const output = outputs[i];
                        console.log(`[TaskRouter] Processing image ${i + 1}/${outputs.length}, output:`, output);
                        
                        try {
                            // 🎯 显示图片导入进度
                            setProgressMessage(`正在导入图片 ${i + 1}/${outputs.length}...`);
                            sdpppSDK.logger?.(`[TaskRouter] Set progress message: 正在导入图片 ${i + 1}/${outputs.length}...`);
                            
                            await MainStore.getState().downloadAndAppendImage({
                                url: output.url,
                                source: selectedModel || 'task',
                                fileName: `taskrouter_result_${Date.now()}_${i}.png`,
                                docId: docIdAtStart,
                                boundaryUri: boundaryUriAtStart,
                                maskUri: maskFileResourceUri,
                                maskHandle: null,
                            });
                            console.log(`[TaskRouter] Image ${i + 1}/${outputs.length} sent to preview`);
                        } catch (sendError: any) {
                            console.error('[TaskRouter] Failed to send image to preview:', sendError);
                            setRunError(`Failed to send image ${i + 1}: ${sendError.message || sendError.toString()}`);
                        }
                    }
                    
                    // 🎯 清除进度消息
                    setProgressMessage('');

                } catch (error: any) {
                    setProgressMessage('');
                    sdpppSDK.logger?.('[TaskRouter] ===== TASK ERROR DEBUG =====');
                    sdpppSDK.logger?.(`[TaskRouter] typeof error: ${typeof error}`);
                    sdpppSDK.logger?.(`[TaskRouter] error.constructor.name: ${error?.constructor?.name}`);
                    sdpppSDK.logger?.(`[TaskRouter] error keys: ${Object.keys(error || {}).join(', ')}`);
                    sdpppSDK.logger?.(`[TaskRouter] error.message: ${error?.message}`);
                    sdpppSDK.logger?.(`[TaskRouter] error.error: ${error?.error}`);
                    sdpppSDK.logger?.(`[TaskRouter] error.errorMessage: ${error?.errorMessage}`);
                    sdpppSDK.logger?.(`[TaskRouter] error.status: ${error?.status}`);
                    if (error?.stack) {
                        sdpppSDK.logger?.(`[TaskRouter] error.stack: ${error.stack}`);
                    }
                    sdpppSDK.logger?.(`[TaskRouter] error object: ${JSON.stringify(error, null, 2)}`);
                    sdpppSDK.logger?.('[TaskRouter] ===== END ERROR DEBUG =====');
                    
                    // 尝试从不同字段提取错误信息
                    const errorMessage = error?.message || error?.error || error?.errorMessage || error?.toString() || 'Unknown error';
                    setRunError(errorMessage);
                } finally {
                    setIsImporting(false);
                    // 任务完成后从 Photoshop 面板移除
                    if (task && task.taskId) {
                        try {
                            await sdpppSDK.plugins.photoshop.taskRemove({
                                taskId: task.taskId
                            });
                        } catch (error) {
                            console.warn('Failed to remove task from Photoshop panel:', error);
                        }
                    }
                    setLastStartTime(0);
                    setCurrentTask(null);
                    setIsRunning(false);
                }
            }
        } catch (error: any) {
            setProgressMessage('');
            sdpppSDK.logger?.('[TaskRouter] ===== OUTER ERROR DEBUG =====');
            sdpppSDK.logger?.(`[TaskRouter] typeof error: ${typeof error}`);
            sdpppSDK.logger?.(`[TaskRouter] error.constructor.name: ${error?.constructor?.name}`);
            sdpppSDK.logger?.(`[TaskRouter] error keys: ${Object.keys(error || {}).join(', ')}`);
            sdpppSDK.logger?.(`[TaskRouter] error.message: ${error?.message}`);
            sdpppSDK.logger?.(`[TaskRouter] error.error: ${error?.error}`);
            sdpppSDK.logger?.(`[TaskRouter] error object: ${JSON.stringify(error, null, 2)}`);
            sdpppSDK.logger?.('[TaskRouter] ===== END OUTER ERROR DEBUG =====');
            
            const errorMessage = error?.message || error?.error || error?.toString() || 'Unknown error';
            setRunError(errorMessage);
            setIsRunning(false);
        } finally {
            if (!currentTask) {
                setProgressMessage('');
                setIsRunning(false);
            }
            setIsImporting(false);
        }
    };

    // 任务中断逻辑
    const handleCancel = async () => {
        if (currentTask && currentTask.cancelable) {
            try {
                await currentTask.cancel();
                setProgressMessage(t('task.cancelled'));
                setRunError('');
            } catch (error: any) {
                setRunError(t('task.cancel_failed', { error: error.message || error.toString() }));
            } finally {
                // 取消后从面板移除
                if (currentTask && currentTask.taskId) {
                    try {
                        await sdpppSDK.plugins.photoshop.taskRemove({
                            taskId: currentTask.taskId
                        });
                    } catch (error) {
                        console.warn('Failed to remove cancelled task:', error);
                    }
                }
                setLastStartTime(0);
                setCurrentTask(null);
                setIsRunning(false);
            }
        }
    };

    return {
        // 🎯 不返回 runError 和 progressMessage，避免触发调用方重渲染
        // runError,  // ❌ 移除，由 useTaskStatus hook 订阅
        // progressMessage,  // ❌ 移除
        handleRun,
        handleCancel,
        isRunning,
        // ✅ 优先使用任务运行时的 cancelable，如果没有则使用模板的 cancelable
        canCancel: currentTask ? (currentTask.cancelable ?? templateCancelable ?? false) : (templateCancelable ?? false)
    };
} 
