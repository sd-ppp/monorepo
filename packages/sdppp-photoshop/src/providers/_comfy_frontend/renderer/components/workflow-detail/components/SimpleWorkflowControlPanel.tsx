import { CloseCircleOutlined, PlayCircleFilled } from '@ant-design/icons';
import { WorkflowControlsPanel, WorkflowStatusDisplay, type WorkflowStatusDescriptor } from '@sdppp/ui-library';
import { Button, Flex, Tooltip } from 'antd';
import React from 'react';
import { useBoundarySettings } from '../hooks/useBoundarySettings';
import { BoundaryPreview, BoundarySettingsLink } from './BoundarySection';

interface SimpleWorkflowControlPanelProps {
  headerLeft?: React.ReactNode;
  headerCenter?: React.ReactNode;
  headerRight?: React.ReactNode;
  bodyCenter?: React.ReactNode;
  runDisabled?: boolean;
  runTooltip: string;
  onRun: () => void;
  cancelTooltip?: string;
  canCancel?: boolean;
  onCancel?: () => void;
  status: WorkflowStatusDescriptor;
}

export const SimpleWorkflowControlPanel: React.FC<SimpleWorkflowControlPanelProps> = ({
  headerLeft,
  headerCenter,
  headerRight,
  bodyCenter,
  runDisabled,
  runTooltip,
  onRun,
  cancelTooltip,
  canCancel,
  onCancel,
  status,
}) => {
  const boundarySettings = useBoundarySettings();

  const statusContent = status.type === 'empty'
    ? <div className="workflow-controls-middle-bottom-placeholder" />
    : (
      <WorkflowStatusDisplay
        status={status}
        className="workflow-run-status"
      />
    );

  return (
    <WorkflowControlsPanel
      className="workflow-detail-controls"
      headerRow={{
        left: headerLeft,
        center: headerCenter,
        right: headerRight,
      }}
      bodyRow={{
        left: <BoundaryPreview previewQuality={boundarySettings.previewQuality} />,
        center: bodyCenter ? (
          <Flex style={{ width: '100%' }}>
            {bodyCenter}
          </Flex>
        ) : undefined,
        right: (
          <Tooltip title={runTooltip}>
            <Button
              type="primary"
              icon={<PlayCircleFilled />}
              className="workflow-main-action-button workflow-detail-run-button"
              onClick={onRun}
              disabled={runDisabled}
            />
          </Tooltip>
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
        right: canCancel ? (
          <Tooltip title={cancelTooltip}>
            <Button
              danger={true}
              className="workflow-action-button"
              icon={<CloseCircleOutlined />}
              onClick={onCancel}
            />
          </Tooltip>
        ) : undefined,
      }}
      middleBottomRow={{
        center: statusContent,
        right: undefined,
      }}
    />
  );
};
