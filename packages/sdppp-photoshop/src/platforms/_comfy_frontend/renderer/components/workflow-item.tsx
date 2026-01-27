import React from "react";
import { List, Button, Space, Typography } from "antd";
import { ChevronRight, Folder } from "lucide-react";
import { sdpppSDK } from '@sdppp/common';
import './workflow-item.less';
import { useStore } from "zustand";

const { Text } = Typography;

const ICON_SIZE = 16;
const CLASS_NAMES = {
  LIST_ITEM: "workflow-list-item",
  LIST_ITEM_LEFT: "workflow-list-item__left",
  LIST_ITEM_RIGHT: "workflow-list-item__right",
  TIPS_ICON: "tips-icon",
  CHECKED: "checked"
};

interface BaseListItemProps {
  isChecked?: boolean;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  onClick?: () => void;
}

const BaseListItem: React.FC<BaseListItemProps> = ({
  isChecked = false,
  children,
  rightContent,
  onClick
}) => {
  return (
    <List.Item
      className={`${CLASS_NAMES.LIST_ITEM}${isChecked ? ` ${CLASS_NAMES.CHECKED}` : ''}`}
      onClick={onClick}
      actions={rightContent ? [rightContent] : undefined}
    >
      <div className={CLASS_NAMES.LIST_ITEM_LEFT}>
        {children}
      </div>
    </List.Item>
  );
};

interface DirectoryItemProps {
  path: string;
  dirname: string;
  onDirectorySet: (path: string) => void;
}

const DirectoryItem: React.FC<DirectoryItemProps> = ({
  path,
  dirname,
  onDirectorySet
}) => {
  const handleClick = () => {
    if (path === '../') {
      const directoryWithoutSuffix = dirname || '';
      const lastSlashIndex = directoryWithoutSuffix.lastIndexOf('/');
      // no slash anymore. or meet the protocol name
      if (lastSlashIndex === -1 || directoryWithoutSuffix[lastSlashIndex - 1] === '/') {
        onDirectorySet?.('');
      } else {
        onDirectorySet?.(directoryWithoutSuffix.slice(0, lastSlashIndex));
      }
    } else {
      onDirectorySet?.(path);
    }
  };

  return (
    <BaseListItem onClick={handleClick}>
      <Space>
        <Folder size={ICON_SIZE} />
        <Text>{path.slice(0, -1).split('/').pop()}</Text>
      </Space>
    </BaseListItem>
  );
};

interface WorkflowItemProps {
  isChecked: boolean;
  workflow: {
    path: string;
    error?: string;
  };
  onRun: (path: string) => Promise<void>;
  setCurrentWorkflow: (workflow: string) => void;
  currentWorkflow: string;
  setOpenWorkflowError: (error: string) => void;
}

interface ActiveWorkflowItemProps {
  path: string | null;
  title: string;
  onRun: () => Promise<void>;
  setCurrentWorkflow: (workflow: string) => void;
  currentWorkflow: string;
  setOpenWorkflowError: (error: string) => void;
}

const WorkflowActions: React.FC<{
  isChecked?: boolean;
  onEdit: () => void;
  onRun: () => void;
}> = ({ isChecked, onEdit, onRun }) => {
  return (
    <Space size="small">
      <Button
        type="text"
        size="small"
        icon={<ChevronRight size={ICON_SIZE} />}
        onClick={onEdit}
        className={CLASS_NAMES.TIPS_ICON}
      />
      {/* <Button 
        type="primary" 
        size="small" 
        icon={<PlayCircleOutlined />} 
        onClick={onRun}
      /> */}
    </Space>
  );
};

const WorkflowItem: React.FC<WorkflowItemProps> = ({
  isChecked,
  workflow,
  onRun,
  currentWorkflow,
  setCurrentWorkflow,
  setOpenWorkflowError
}) => {

  const handleEditClick = async () => {
    try {
      setOpenWorkflowError('');
      await sdpppSDK.plugins.ComfyCaller.openWorkflow({
        workflow_path: workflow.path,
        reset: false
      });
    } catch (error: any) {
      setOpenWorkflowError(error.message || error.toString());
    }
    setCurrentWorkflow(workflow.path);
  };

  return (
    <BaseListItem
      isChecked={isChecked}
      rightContent={
        <WorkflowActions
          isChecked={isChecked}
          onEdit={handleEditClick}
          onRun={() => onRun(workflow.path)}
        />
      }
      onClick={handleEditClick}
    >
      <Text>
        {workflow.error ?
          workflow.error.replace('sdppp PS side error:', '') :
          (workflow.path.split('/').pop() + (currentWorkflow === workflow.path ? "..." : ""))
        }
      </Text>
    </BaseListItem>
  );
};

const SpecialWorkflowItem: React.FC<ActiveWorkflowItemProps> = ({
  onRun,
  path,
  title,
  currentWorkflow,
  setCurrentWorkflow,
  setOpenWorkflowError
}) => {

  const handleEditClick = async () => {
    setOpenWorkflowError('');
    try {
      path && await sdpppSDK.plugins.ComfyCaller.openWorkflow({
        workflow_path: path,
        reset: false
      })
    } catch (error) {
      setOpenWorkflowError(error as string);
    }
    setCurrentWorkflow(path || '');
  };

  return (
    <BaseListItem
      rightContent={
        <WorkflowActions
          onEdit={handleEditClick}
          onRun={onRun}
        />
      }
      onClick={handleEditClick}
    >
      <Text>{title + (currentWorkflow === path ? "..." : "")}</Text>
    </BaseListItem>
  );
};

export {
  DirectoryItem,
  WorkflowItem,
  SpecialWorkflowItem
};
