import React, { useMemo } from 'react';
import { WorkflowControlsPanel } from '@sdppp/ui-library';
import {
  AutoRunButton,
  RunButton,
  RunMultiButtons,
  StopAndCancelButton,
} from './RunControls';
import {
  BackButton,
  RefreshButton,
  SaveButton,
  WorkflowTitle,
} from './HeaderControls';
import { BoundaryPreview, BoundarySettingsLink } from './BoundarySection';
import { WorkflowRunStatus } from './RunStatus';
import { useBoundarySettings } from '../hooks/useBoundarySettings';
import { useRunHover } from '../hooks/useRunHover';

interface ComfyWorkflowControlPanelProps {
  currentWorkflow: string;
  setCurrentWorkflow: (workflow: string) => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}

export const ComfyWorkflowControlPanel: React.FC<ComfyWorkflowControlPanelProps> = ({
  currentWorkflow,
  setCurrentWorkflow,
  uploading,
  setUploading,
}) => {
  const boundarySettings = useBoundarySettings();
  const {
    onRunButtonEnter,
    onRunButtonLeave,
    onMultiplierEnter,
    onMultiplierLeave,
    showMultiplierControls,
  } = useRunHover();

  const headerRight = useMemo(() => (
    <div className="workflow-controls-actions">
      <SaveButton
        currentWorkflow={currentWorkflow}
        className="workflow-action-button"
      />
      <RefreshButton
        currentWorkflow={currentWorkflow}
        className="workflow-action-button"
      />
    </div>
  ), [currentWorkflow]);

  const middleTopRight = useMemo(() => (
    <div className="workflow-controls-actions">
      <StopAndCancelButton className="workflow-action-button" />
      <AutoRunButton
        currentWorkflow={currentWorkflow}
        setUploading={setUploading}
        className="workflow-action-button"
      />
    </div>
  ), [currentWorkflow, setUploading]);

  return (
    <WorkflowControlsPanel
      className="workflow-detail-controls"
      headerRow={{
        left: (
          <BackButton
            onBack={() => setCurrentWorkflow('')}
            className="workflow-action-button"
          />
        ),
        center: (
          <WorkflowTitle currentWorkflow={currentWorkflow} />
        ),
        right: headerRight,
      }}
      bodyRow={{
        left: (
          <BoundaryPreview previewQuality={boundarySettings.previewQuality} />
        ),
        right: (
          <RunButton
            currentWorkflow={currentWorkflow}
            setUploading={setUploading}
            onMouseEnter={onRunButtonEnter}
            onMouseLeave={onRunButtonLeave}
          />
        ),
      }}
      middleTopRow={{
        left: (
          <BoundarySettingsLink
            limitDisplay={boundarySettings.limitDisplay}
            qualityDisplay={boundarySettings.qualityDisplay}
            isModalOpen={boundarySettings.isModalOpen}
            openModal={boundarySettings.openModal}
            closeModal={boundarySettings.closeModal}
            handleSubmit={boundarySettings.handleSubmit}
            form={boundarySettings.form}
          />
        ),
        right: middleTopRight,
      }}
      middleBottomRow={{
        center: (
          <WorkflowRunStatus uploading={uploading} />
        ),
        right: showMultiplierControls ? (
          <RunMultiButtons
            currentWorkflow={currentWorkflow}
            setUploading={setUploading}
            onMouseEnter={onMultiplierEnter}
            onMouseLeave={onMultiplierLeave}
          />
        ) : undefined,
      }}
    />
  );
};
