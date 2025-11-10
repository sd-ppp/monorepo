import { CircleX, PlayCircle } from 'lucide-react';
import { useTranslation } from '@sdppp/common';
import { WorkflowControlsPanel, WorkflowStatusDisplay, type WorkflowStatusDescriptor } from '@sdppp/ui-library';
import { Button, Flex, Tooltip, Typography } from 'antd';
import React, { useCallback, useState } from 'react';
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
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const [isBoundaryPreviewVisible, setIsBoundaryPreviewVisible] = useState(false);
  const { Link } = Typography;

  const handleEnableBoundaryPreview = useCallback(() => {
    setIsBoundaryPreviewVisible(true);
  }, []);

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
        left: isBoundaryPreviewVisible ? (
          <BoundaryPreview previewQuality={boundarySettings.previewQuality} />
        ) : undefined,
        center: bodyCenter ? (
          <Flex style={{ width: '100%' }}>
            {bodyCenter}
          </Flex>
        ) : undefined,
        right: (
          <Tooltip title={runTooltip}>
            <Button
              type="primary"
              icon={<PlayCircle size={MAIN_ICON_SIZE} />}
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
              icon={<CircleX size={ACTION_ICON_SIZE} />}
              onClick={onCancel}
            />
          </Tooltip>
        ) : undefined,
      }}
      middleBottomRow={{
        left: !isBoundaryPreviewVisible ? (
          <Link
            className="workflow-boundary-limit"
            onClick={handleEnableBoundaryPreview}
            style={{
              height: 32,
            }}
            type="secondary"
          >
            <span>{translate('workflow.output.destination.title', { defaultMessage: '输出至：' })}</span>
            <span>{translate('workflow.output.destination.canvas', { defaultMessage: '全图' })}</span>
          </Link>
        ) : undefined,
        center: statusContent,
        right: undefined,
      }}
    />
  );
};

const ACTION_ICON_SIZE = 16;
const MAIN_ICON_SIZE = 32;
