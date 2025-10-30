import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SaveOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  PlayCircleFilled,
  ForwardOutlined,
} from '@ant-design/icons';
import { sdpppSDK } from '@sdppp/common';
import { useStore } from 'zustand';
import { WidgetableRenderer as WorkflowEdit } from '@sdppp/widgetable-ui';
import { useUploadPasses } from '../../../base/upload-pass-context';
import { comfyWorkflowStore } from '../comfy_frontend';
import { useTranslation } from '@sdppp/common';
import { ComfyTask } from '../../ComfyTask';
import { WorkBoundary } from '../../../base/components';
import {
  WorkflowControlsPanel,
  WorkflowStatusDisplay,
  type WorkflowStatusDescriptor,
  type WorkflowActionConfig,
  type WorkflowMainActionConfig,
  type WorkflowSecondaryActionConfig,
} from '@sdppp/ui-library';

async function runAndWaitResult(multi: number, currentWorkflow: string): Promise<ComfyTask> {
  // 获取当前文档ID和边界信息
  const activeDocumentID = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const boundary = sdpppSDK.stores.WebviewStore.getState().workBoundaries[activeDocumentID];

  const task = new ComfyTask({ size: multi }, currentWorkflow, activeDocumentID, boundary);

  // 返回 task 以便外部可以跟踪状态
  task.promise.catch(error => {
    console.error('ComfyUI task failed:', error);
  });

  return task;
}

const useWorkflowStatusDescriptor = (
  currentWorkflow: string,
  uploading: boolean,
): WorkflowStatusDescriptor => {
  const { t } = useTranslation();
  const lastError = useStore(sdpppSDK.stores.ComfyStore, (s) => s.lastError);
  const progress = useStore(sdpppSDK.stores.ComfyStore, (s) => s.progress);
  const executingNodeTitle = useStore(sdpppSDK.stores.ComfyStore, (s) => s.executingNodeTitle);
  const queueSize = useStore(sdpppSDK.stores.ComfyStore, (s) => s.queueSize);
  const autoRunning = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyAutoRunning);

  if (uploading) {
    return { type: 'uploading', message: t('comfy.uploading') };
  }
  if (lastError) {
    return { type: 'error', message: lastError };
  }
  if (executingNodeTitle) {
    return {
      type: 'progress',
      message: t('comfy.queue_progress', { queueSize, progress, executingNodeTitle }),
      percent: progress,
      showInfo: false,
    };
  }
  if (autoRunning) {
    return { type: 'text', message: 'auto run workflow after change..', tone: 'secondary' };
  }
  if (currentWorkflow) {
    return { type: 'text', message: currentWorkflow, tone: 'secondary' };
  }
  return { type: 'empty' };
};

const useBackAction = (
  setCurrentWorkflow: (workflow: string) => void,
): WorkflowActionConfig => {
  const { t } = useTranslation();
  return useMemo(() => ({
    icon: <ArrowLeftOutlined />,
    tooltip: t('comfy.back'),
    onClick: () => setCurrentWorkflow(''),
    'data-testid': 'workflow-back-button',
  }), [setCurrentWorkflow, t]);
};

const useSaveAction = (currentWorkflow: string): WorkflowActionConfig => {
  const { t } = useTranslation();
  return useMemo(() => ({
    icon: <SaveOutlined />,
    tooltip: t('comfy.save'),
    onClick: () => {
      sdpppSDK.plugins.ComfyCaller.saveWorkflow({ workflow_path: currentWorkflow });
    },
    'data-testid': 'workflow-save-button',
  }), [currentWorkflow, t]);
};

const useRefreshAction = (currentWorkflow: string): WorkflowActionConfig => {
  const { t } = useTranslation();
  return useMemo(() => ({
    icon: <ReloadOutlined />,
    tooltip: t('comfy.refresh'),
    onClick: () => {
      sdpppSDK.plugins.ComfyCaller.openWorkflow({
        workflow_path: currentWorkflow,
        reset: true,
      });
    },
    'data-testid': 'workflow-refresh-button',
  }), [currentWorkflow, t]);
};

const useStopAction = (): WorkflowActionConfig => {
  const { t } = useTranslation();
  const onClearAndInterrupt = useCallback(() => {
    sdpppSDK.plugins.ComfyCaller.stopAll({});
  }, []);
  return useMemo(() => ({
    icon: <CloseCircleOutlined />,
    tooltip: t('comfy.stop_cancel_all'),
    danger: true,
    onClick: onClearAndInterrupt,
    'data-testid': 'workflow-stop-button',
  }), [onClearAndInterrupt, t]);
};

const useAutoRunAction = (
  currentWorkflow: string,
  setUploading: (uploading: boolean) => void,
): WorkflowActionConfig => {
  const { t } = useTranslation();
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const canvasStateID = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.canvasStateID);
  const { waitAllUploadPasses } = useUploadPasses();
  const waitAllUploadPassesRef = useRef(waitAllUploadPasses);
  useEffect(() => { waitAllUploadPassesRef.current = waitAllUploadPasses; }, [waitAllUploadPasses]);

  const currentWorkflowRef = useRef(currentWorkflow);
  useEffect(() => { currentWorkflowRef.current = currentWorkflow; }, [currentWorkflow]);

  useEffect(() => {
    if (!isAutoRunning || !canvasStateID) return;
    let cancelled = false;
    (async () => {
      setUploading(true);
      try {
        await waitAllUploadPassesRef.current();
      } finally {
        setUploading(false);
      }
      if (!cancelled) {
        await runAndWaitResult(1, currentWorkflowRef.current);
      }
    })();
    return () => { cancelled = true; };
  }, [canvasStateID, isAutoRunning, setUploading]);

  return useMemo(() => ({
    icon: <ForwardOutlined />,
    tooltip: isAutoRunning ? t('comfy.stop_auto_run') : t('comfy.start_auto_run'),
    type: isAutoRunning ? 'primary' : 'default',
    active: isAutoRunning,
    onClick: () => setIsAutoRunning((prev) => !prev),
    'data-testid': 'workflow-auto-run-button',
  }), [isAutoRunning, t]);
};

const useRunMainAction = (
  currentWorkflow: string,
  setUploading: (uploading: boolean) => void,
): WorkflowMainActionConfig => {
  const { t } = useTranslation();
  const { waitAllUploadPasses } = useUploadPasses();
  const [isDisabled, setIsDisabled] = useState(false);

  const doRun = useCallback(async () => {
    setIsDisabled(true);
    setTimeout(() => setIsDisabled(false), 500);

    setUploading(true);
    await waitAllUploadPasses();
    setUploading(false);
    await runAndWaitResult(1, currentWorkflow);
  }, [currentWorkflow, setUploading, waitAllUploadPasses]);

  return useMemo(() => ({
    icon: <PlayCircleFilled />,
    tooltip: t('comfy.run'),
    onClick: doRun,
    disabled: isDisabled,
    type: 'primary',
    size: 81,
    'data-testid': 'workflow-run-button',
  }), [doRun, isDisabled, currentWorkflow, t]);
};

const useRunMultiActions = (
  currentWorkflow: string,
  setUploading: (uploading: boolean) => void,
): WorkflowSecondaryActionConfig[] => {
  const { waitAllUploadPasses } = useUploadPasses();
  const [disabledButtons, setDisabledButtons] = useState<Set<number>>(new Set());

  const doRun = useCallback(async (multi: number) => {
    setDisabledButtons((prev) => new Set(prev).add(multi));
    setTimeout(() => {
      setDisabledButtons((prev) => {
        const next = new Set(prev);
        next.delete(multi);
        return next;
      });
    }, 500);

    setUploading(true);
    await waitAllUploadPasses();
    setUploading(false);
    const task = await runAndWaitResult(multi, currentWorkflow);
    task.promise.finally(() => { /* no-op, caller monitors externally */ });
  }, [currentWorkflow, setUploading, waitAllUploadPasses]);

  return useMemo(() => {
    const multipliers = [2, 5, 9];
    return multipliers.map<WorkflowSecondaryActionConfig>((multi) => ({
      label: `x${multi}`,
      onClick: () => void doRun(multi),
      disabled: disabledButtons.has(multi),
      'data-testid': `workflow-run-multi-${multi}`,
    }));
  }, [currentWorkflow, disabledButtons, doRun]);
};

// 渲染计数器
let workflowDetailRenderCount = 0;

export function WorkflowDetail({ currentWorkflow, setCurrentWorkflow }: { currentWorkflow: string, setCurrentWorkflow: (workflow: string) => void }) {
  workflowDetailRenderCount++;
  const widgetableValues = useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableValues)
  const widgetableStructure = useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableStructure)
  const widgetableErrors = useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableErrors)

  // Removed debug render logging per request
  const [hasRecoverHistory, setHasRecoverHistory] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  useEffect(() => {
    if (currentWorkflow === widgetableStructure.widgetablePath.replace(/^workflows\//, '') && !hasRecoverHistory) {
      const historyValues = comfyWorkflowStore.getState().historyValues[currentWorkflow]
      if (historyValues) {
        const values = Object.entries(historyValues)
          .reduce((acc, [nodeID, values]) => {
            return acc.concat(values.map((value: any, widgetIndex: number) => ({
              nodeID,
              widgetIndex,
              value
            })))
          }, [])
        sdpppSDK.plugins.ComfyCaller.setWidgetValue({ values })
      }
      setHasRecoverHistory(true)
    } else {
      setHasRecoverHistory(false)
    }
  }, [currentWorkflow, widgetableStructure.widgetablePath])

  const [prevWidgetableValues, setPrevWidgetableValues] = useState<Record<string, any>>(widgetableValues)

  // 稳定的回调函数
  const handleWidgetChange = useCallback((nodeID: string, widgetIndex: number, value: any, fieldInfo: any) => {
    sdpppSDK.plugins.ComfyCaller.setWidgetValue({
      values: [{
        nodeID,
        widgetIndex,
        value
      }]
    })
  }, []);

  const handleTitleChange = useCallback((nodeID: string, title: string) => {
    sdpppSDK.plugins.ComfyCaller.setNodeTitle({
      title,
      node_id: nodeID
    })
  }, []);
  useEffect(() => {
    if (JSON.stringify(prevWidgetableValues) !== JSON.stringify(widgetableValues)) {
      comfyWorkflowStore.getState().setHistoryValues({
        ...comfyWorkflowStore.getState().historyValues,
        [currentWorkflow]: widgetableValues
      })
      setPrevWidgetableValues(widgetableValues)
    }
  }, [widgetableValues, currentWorkflow])

  const statusDescriptor = useWorkflowStatusDescriptor(currentWorkflow, uploading);
  const backAction = useBackAction(setCurrentWorkflow);
  const saveAction = useSaveAction(currentWorkflow);
  const refreshAction = useRefreshAction(currentWorkflow);
  const stopAction = useStopAction();
  const autoRunAction = useAutoRunAction(currentWorkflow, setUploading);
  const runMainAction = useRunMainAction(currentWorkflow, setUploading);
  const runMultiActions = useRunMultiActions(currentWorkflow, setUploading);

  const leftActions = useMemo<WorkflowActionConfig[]>(() => (
    [backAction, saveAction, refreshAction]
  ), [backAction, refreshAction, saveAction]);

  const rightActions = useMemo<WorkflowActionConfig[]>(() => (
    [stopAction, autoRunAction]
  ), [autoRunAction, stopAction]);

  return (
    <div className="workflow-edit-wrap">
      <div className="workflow-edit-top">
        <WorkflowControlsPanel
          leftActions={leftActions}
          rightActions={rightActions}
          mainAction={runMainAction}
          secondaryActions={runMultiActions}
          statusArea={<WorkflowStatusDisplay status={statusDescriptor} />}
          auxiliarySlot={<WorkBoundary />}
        />
      </div>
      <WorkflowEdit
        widgetableStructure={widgetableStructure}
        widgetableValues={widgetableValues}
        widgetableErrors={widgetableErrors}
        onWidgetChange={handleWidgetChange}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
};
