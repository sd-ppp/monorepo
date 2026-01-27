import React, { useEffect, useState } from "react";
import { Tree, Alert, Typography, Button, Flex } from "antd";
import { File, Folder, RotateCcw } from "lucide-react";
import { useWorkflowListContext, TreeNodeData } from "../comfy_frontend";
import { useTranslation } from '@sdppp/common';
import { sdpppSDK } from '@sdppp/common';
import './workflow-item.less';

const { DirectoryTree } = Tree;

const log = sdpppSDK.logger.extend('workflow-list');

interface WorkflowListProps {
  setCurrentWorkflow: (workflow: string) => void;
  currentWorkflow: string;
  hidden: boolean;
}

const WorkflowList: React.FC<WorkflowListProps> = ({
  setCurrentWorkflow, currentWorkflow, hidden
}) => {
  const { t } = useTranslation()
  const {
    treeData,
    expandedKeys,
    onExpand,
    loading,
    error: workflowsError,
    refetch
  } = useWorkflowListContext();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    refetch();
  }, []);

  // Show error if workflows failed to load
  if (workflowsError) {
    return (
      <div className="workflow-list">
        <Alert
          message={t('common.error')}
          description={workflowsError}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const handleSelect = async (selectedKeys: string[], e: { selected: boolean; selectedNodes: any; node: any; event: any }) => {
    if (e.selected && e.node.isLeaf && e.node.workflow) {
      try {
        setCurrentWorkflow(e.node.key);
        await sdpppSDK.plugins.ComfyCaller.openWorkflow({
          workflow_path: e.node.key,
          reset: false
        });
      } catch (error: any) {
        log('[Error] Failed to open workflow:', error);
        // 可以选择显示错误提示
      }
    }
  };

  const ICON_SIZE = 16;

  const renderTreeIcon = (props: any) => {
    if (props.isLeaf) {
      return <File size={ICON_SIZE} />;
    }
    return <Folder size={ICON_SIZE} />;
  };

  return (
    <div className="workflow-list" style={{ display: hidden ? 'none' : 'block' }}>
      <Flex align="center" gap={8} style={{ margin: '8px 0' }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('comfy.your_workflows')}
        </Typography.Title>
        <Button
          type="text"
          icon={<RotateCcw size={ICON_SIZE} />}
          onClick={refetch}
          loading={loading}
          size="small"
          title={t('comfy.refresh_workflows')}
        />
      </Flex>

      <DirectoryTree
        className="workflow-list__main"
        treeData={treeData}
        expandedKeys={expandedKeys}
        selectedKeys={selectedKeys}
        onExpand={onExpand}
        onSelect={handleSelect}
        showIcon
        icon={renderTreeIcon}
        expandAction="click"
      />
    </div>
  );
};

export default WorkflowList;
