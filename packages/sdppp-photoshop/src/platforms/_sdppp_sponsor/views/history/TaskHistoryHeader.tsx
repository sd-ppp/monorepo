import { memo } from 'react';
import { Button, Flex } from 'antd';
import { RotateCcw } from 'lucide-react';

export type TaskHistoryHeaderProps = {
  t: (key: string, options?: any) => string;
  loading: boolean;
  onRefresh: () => void;
  disabled: boolean;
};

const TaskHistoryHeader = memo(function TaskHistoryHeader({
  t,
  loading,
  onRefresh,
  disabled,
}: TaskHistoryHeaderProps) {
  return (
    <Flex justify="space-between" align="center">
      <span style={{ color: 'var(--ant-color-text-tertiary)' }}>
        {t('taskrouter.history.limit_notice', { defaultValue: 'Only the latest 10 items are available in this version' })}
      </span>
      <Button
        type="text"
        size="small"
        icon={<RotateCcw size={16} />}
        loading={loading}
        onClick={onRefresh}
        disabled={disabled}
        style={{ color: 'inherit' }}
      >
        {t('taskrouter.history.refresh', { defaultValue: 'Refresh' })}
      </Button>
    </Flex>
  );
});

export default TaskHistoryHeader;
