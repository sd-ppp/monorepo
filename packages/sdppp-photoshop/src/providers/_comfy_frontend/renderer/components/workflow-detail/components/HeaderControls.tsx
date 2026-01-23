import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { Button, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from '@sdppp/common';
import { sdpppSDK } from '@sdppp/common';

interface HeaderButtonProps {
  className?: string;
}

interface WorkflowTitleProps {
  currentWorkflow: string;
}

interface BackButtonProps extends HeaderButtonProps {
  onBack: () => void;
}

interface SaveRefreshProps extends HeaderButtonProps {
  currentWorkflow: string;
}

const { Text } = Typography;

export const WorkflowTitle: React.FC<WorkflowTitleProps> = ({ currentWorkflow }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  const title = currentWorkflow || translate('comfy.no_workflow_selected', { defaultMessage: 'No workflow selected' });

  return (
    <Text
      className="workflow-detail-title"
      ellipsis={{ tooltip: !!currentWorkflow }}
      strong
    >
      {title}
    </Text>
  );
};

export const BackButton: React.FC<BackButtonProps> = ({ onBack, className }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  return (
    <Tooltip title={translate('comfy.back')}>
      <Button
        className={className}
        icon={<ArrowLeft size={16} />}
        onClick={onBack}
      />
    </Tooltip>
  );
};

export const SaveButton: React.FC<SaveRefreshProps> = ({ currentWorkflow, className }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  return (
    <Tooltip title={translate('comfy.save')}>
      <Button
        className={className}
        icon={<Save size={16} />}
        onClick={() => {
          sdpppSDK.plugins.ComfyCaller.saveWorkflow({
            workflow_path: currentWorkflow,
          });
        }}
      />
    </Tooltip>
  );
};

export const RefreshButton: React.FC<SaveRefreshProps> = ({ currentWorkflow, className }) => {
  const { t } = useTranslation();
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  return (
    <Tooltip title={translate('comfy.refresh')}>
      <Button
        className={className}
        icon={<RotateCcw size={16} />}
        onClick={() =>
          sdpppSDK.plugins.ComfyCaller.openWorkflow({
            workflow_path: currentWorkflow,
            reset: true,
          })
        }
      />
    </Tooltip>
  );
};
