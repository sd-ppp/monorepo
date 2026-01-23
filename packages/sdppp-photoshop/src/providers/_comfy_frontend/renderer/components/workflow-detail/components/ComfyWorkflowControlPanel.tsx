import { WorkflowControlsPanel } from '@sdppp/ui-library';
import React, { useMemo } from 'react';
import { useBoundarySettings } from '../hooks/useBoundarySettings';
import { useRunHover } from '../hooks/useRunHover';
import { BoundarySettingsLink } from './BoundarySection';
import {
  BackButton,
  RefreshButton,
  SaveButton,
  WorkflowTitle,
} from './HeaderControls';
import {
  AutoRunButton,
  RunButton,
  RunMultiButtons,
  StopAndCancelButton,
} from './RunControls';
import { WorkflowRunStatus } from './RunStatus';

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
  // const { t } = useTranslation();
  // const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  // const [isBoundaryPreviewVisible, setIsBoundaryPreviewVisible] = useState(false);
  // const boundarySettings = useBoundarySettings();
  const {
    onRunButtonEnter,
    onRunButtonLeave,
    onMultiplierEnter,
    onMultiplierLeave,
    showMultiplierControls,
  } = useRunHover();
  const boundarySettings = useBoundarySettings();

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
        // left: isBoundaryPreviewVisible ? (
        //   <BoundaryPreview previewQuality={boundarySettings.previewQuality} />
        // ) : undefined,
        left: undefined,
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
        // left: !isBoundaryPreviewVisible ? (
        //   <Link
        //     className="workflow-boundary-limit"
        //     onClick={handleEnableBoundaryPreview}
        //     style={{
        //       height: 32,
        //     }}
        //     type="secondary"
        //   >
        //     <span>{translate('workflow.output.destination.title', { defaultMessage: '输出至：' })}</span>
        //     <span>{translate('workflow.output.destination.canvas', { defaultMessage: '全图' })}</span>
        //   </Link>
        // ) : undefined,
        left: undefined,
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
