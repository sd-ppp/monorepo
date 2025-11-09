import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { shallow } from 'zustand/shallow';
import { sdpppSDK } from '@sdppp/common';
import { WidgetableRenderer as WorkflowEdit } from '@sdppp/widgetable-ui';
import './workflow-detail.less';
import { comfyWorkflowStore } from '../comfy_frontend';
import { ComfyWorkflowControlPanel } from './workflow-detail/components/ComfyWorkflowControlPanel';
import { EMPTY_OBJECT } from './workflow-detail/constants';

// 渲染计数器
let workflowDetailRenderCount = 0;

interface WorkflowDetailProps {
  currentWorkflow: string;
  setCurrentWorkflow: (workflow: string) => void;
}

export function WorkflowDetail({
  currentWorkflow,
  setCurrentWorkflow,
}: WorkflowDetailProps) {
  workflowDetailRenderCount++;
  const widgetableValues =
    useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableValues ?? EMPTY_OBJECT, shallow) ??
    EMPTY_OBJECT;
  const widgetableStructure =
    useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableStructure ?? EMPTY_OBJECT, shallow) ??
    EMPTY_OBJECT;
  const widgetableErrors = useStore(sdpppSDK.stores.ComfyStore, (state) => state.widgetableErrors ?? null, shallow);

  const widgetablePath = useMemo(
    () => (typeof (widgetableStructure as any)?.widgetablePath === 'string'
      ? (widgetableStructure as any).widgetablePath
      : ''),
    [widgetableStructure],
  );

  const [uploading, setUploading] = useState<boolean>(false);
  const [prevWidgetableValues, setPrevWidgetableValues] = useState<Record<string, any>>(widgetableValues);
  const prevWidgetableHashRef = useRef<string>('');
  const historyRecoveryRef = useRef<{ workflow: string | null; recovered: boolean }>({
    workflow: null,
    recovered: false,
  });

  useEffect(() => {
    const pathMatches =
      currentWorkflow &&
      widgetablePath &&
      currentWorkflow === widgetablePath.replace(/^workflows\//, '');

    const recoveredState = historyRecoveryRef.current;
    if (!pathMatches) {
      historyRecoveryRef.current = { workflow: currentWorkflow, recovered: false };
      return;
    }

    if (
      recoveredState.workflow === currentWorkflow &&
      recoveredState.recovered
    ) {
      return;
    }

    const historyValues = comfyWorkflowStore.getState().historyValues[currentWorkflow];
    if (historyValues) {
      const values = Object.entries(historyValues)
        .reduce((acc, [nodeID, values]) => {
          return acc.concat(
            values.map((value: any, widgetIndex: number) => ({
              nodeID,
              widgetIndex,
              value,
            })),
          );
        }, [] as Array<{ nodeID: string; widgetIndex: number; value: any }>);
      sdpppSDK.plugins.ComfyCaller.setWidgetValue({ values });
    }

    historyRecoveryRef.current = { workflow: currentWorkflow, recovered: true };
  }, [currentWorkflow, widgetablePath]);

  const handleWidgetChange = useCallback((
    nodeID: string,
    widgetIndex: number,
    value: any,
  ) => {
    sdpppSDK.plugins.ComfyCaller.setWidgetValue({
      values: [{
        nodeID,
        widgetIndex,
        value,
      }],
    });
  }, []);

  const handleTitleChange = useCallback((nodeID: string, title: string) => {
    sdpppSDK.plugins.ComfyCaller.setNodeTitle({
      title,
      node_id: nodeID,
    });
  }, []);

  useEffect(() => {
    const nextHash = JSON.stringify(widgetableValues ?? EMPTY_OBJECT);
    const prevHash = prevWidgetableHashRef.current;
    if (prevHash !== nextHash) {
      comfyWorkflowStore.getState().setHistoryValues({
        ...comfyWorkflowStore.getState().historyValues,
        [currentWorkflow]: widgetableValues,
      });
      setPrevWidgetableValues(widgetableValues);
      prevWidgetableHashRef.current = nextHash;
    }
  }, [widgetableValues, currentWorkflow]);

  return (
    <div className="workflow-edit-wrap">
      <div className="workflow-edit-top">
        <ComfyWorkflowControlPanel
          currentWorkflow={currentWorkflow}
          setCurrentWorkflow={setCurrentWorkflow}
          uploading={uploading}
          setUploading={setUploading}
        />
      </div>
      <WorkflowEdit
        widgetableStructure={widgetableStructure as any}
        widgetableValues={widgetableValues}
        widgetableErrors={widgetableErrors}
        onWidgetChange={handleWidgetChange}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
}
