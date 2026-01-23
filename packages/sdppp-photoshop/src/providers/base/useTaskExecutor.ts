import { t, sdpppSDK } from '@sdppp/common';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { useEffect, useState } from 'react';
import { MainStore } from '../../tsx/App.store';
import { useUploadPasses } from './upload-pass-context';

export interface UseTaskExecutorOptions {
    selectedModel: string;
    currentValues: any;
    getCurrentValues?: () => any;
    createTask: (model: string, values: any) => Promise<any>;
    runningTasks: any[];
    beforeCreateTaskHook: (values: any) => any;
}

export function useTaskExecutor({
    selectedModel,
    currentValues,
    getCurrentValues,
    createTask,
    runningTasks,
    beforeCreateTaskHook
}: UseTaskExecutorOptions) {
    const [runError, setRunError] = useState<string>('');
    const [lastStartTime, setLastStartTime] = useState<number>(0);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [currentTask, setCurrentTask] = useState<any>(null);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const { waitAllUploadPasses } = useUploadPasses();
    const downloadAndAppendImage = MainStore((state) => state.downloadAndAppendImage);

    // 进度跟踪逻辑
    useEffect(() => {
        if (!lastStartTime) {
            return;
        }
        const interval = setInterval(() => {
            if (lastStartTime > 0 && runningTasks.length > 0) {
                setProgressMessage(t('task.running_duration', { 
                    duration: ((Date.now() - lastStartTime) / 1000).toFixed(2), 
                    message: runningTasks[0].progressMessage 
                }));
            }
        }, 100);

        return () => {
            clearInterval(interval);
            setProgressMessage('');
        }
    }, [lastStartTime, runningTasks]);

    // 任务执行逻辑
    const handleRun = async () => {
        // must call waitAllUploadPasses, otherwise the image component may not finished uploading
        // waitAllUploadPasses一定要调，否则图片组件的上传可能还未完成
        setRunError('');
        setProgressMessage(t('task.waiting_upload'));
        setIsRunning(true);
        await waitAllUploadPasses();
        // 等待一帧以确保各 UploadProvider 通过 onCallOnValueChange 将最终值写回表单
        await new Promise(resolve => setTimeout(resolve, 100));

        setProgressMessage(t('task.creating_task'));
        // 在任务开始时读取并冻结 docId 与 boundary，保持与 ComfyTask 一致
        const docIdAtStart = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID ?? 0;
        const webviewStateAtStart = sdpppSDK.stores.WebviewStore.getState();
        const boundaryAtStart = webviewStateAtStart?.workBoundaries?.[docIdAtStart] ?? null;
        const sizeLimitAtStart = webviewStateAtStart?.workBoundaryMaxSizes?.[docIdAtStart];
        const imageQualityAtStart = webviewStateAtStart?.workBoundaryImageQualities?.[docIdAtStart];
        const boundaryUriAtStart = buildBoundaryUri(docIdAtStart, boundaryAtStart ?? null, {
            imageSize: typeof sizeLimitAtStart === 'number' && Number.isFinite(sizeLimitAtStart) && sizeLimitAtStart > 0
                ? Math.round(sizeLimitAtStart)
                : undefined,
            imageQuality: typeof imageQualityAtStart === 'number' && Number.isFinite(imageQualityAtStart)
                ? Math.round(imageQualityAtStart)
                : undefined,
        });
        
        // 在创建任务前调用 hook 来修改 currentValues
        const liveValues = getCurrentValues ? getCurrentValues() : currentValues;
        const finalValues = beforeCreateTaskHook ? beforeCreateTaskHook(liveValues) : liveValues;
        
        try {
            const task = await createTask(selectedModel, finalValues);
            setCurrentTask(task);
            setLastStartTime(Date.now());
            if (task) {
                try {
                    const result = await task.promise;
                    // 使用开始时读取的 docId 与 boundary 传入预览
                    await Promise.all(result.map((output: any) => downloadAndAppendImage({
                        url: output.url,
                        source: 'remote',
                        docId: docIdAtStart,
                        boundaryUri: boundaryUriAtStart,
                        maskUri: null,
                        maskHandle: null,
                    })));

                } catch (error: any) {
                    setProgressMessage('');
                    setRunError(error.message || error.toString());
                } finally {
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
            setRunError(error.message || error.toString());
            setIsRunning(false);
        } finally {
            if (!currentTask) {
                setProgressMessage('');
                setIsRunning(false);
            }
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
        runError,
        progressMessage,
        handleRun,
        handleCancel,
        isRunning,
        canCancel: currentTask && currentTask.cancelable
    };
} 
