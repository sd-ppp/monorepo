import type { FC } from 'react';
import { useMemo } from 'react';
import { Alert, Button, Empty, List, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from '@sdppp/common';

import type { TaskHistoryRecord, TaskHistoryRecordStatus } from '../store';

const { Text } = Typography;

const statusColorMap: Record<TaskHistoryRecordStatus, string> = {
  pending: 'default',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'gold',
};

const statusLabelMap: Record<TaskHistoryRecordStatus, string> = {
  pending: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const formatTimestamp = (value?: number): string => {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatDurationSeconds = (item: TaskHistoryRecord): string => {
  if (item.finishedAt && item.finishedAt >= item.createdAt) {
    const seconds = Math.max(0, Math.round((item.finishedAt - item.createdAt) / 1000));
    return String(seconds);
  }
  return '--';
};

const formatCharge = (charge?: number): string => {
  const value = typeof charge === 'number' ? charge : 0;
  return `-${value}积分`;
};

const getStatusColor = (status: TaskHistoryRecordStatus) => statusColorMap[status] ?? 'default';

export interface TaskHistoryListProps {
  items: TaskHistoryRecord[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (item: TaskHistoryRecord) => void;
  onRefresh: () => void;
  resolveLocatorLabel: (item: { locator: string; templateName?: string | null }) => string;
  refreshDisabled?: boolean;
}

export const TaskHistoryList: FC<TaskHistoryListProps> = ({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  onRefresh,
  resolveLocatorLabel,
  refreshDisabled = false,
}) => {
  const { t } = useTranslation();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  if (loading) {
    return (
      <Spin tip={t('taskrouter.history.loading', { defaultValue: '加载历史任务…' })}>
        <div style={{ minHeight: 160 }} />
      </Spin>
    );
  }

  if (!sortedItems.length) {
    return (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {error ? (
          <Alert type="error" showIcon message={error} />
        ) : (
          <Empty
            description={t('taskrouter.history.empty', { defaultValue: '暂无历史任务' })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
        <Button type="link" size="small" onClick={onRefresh} disabled={refreshDisabled}>
          {t('taskrouter.history.refresh', { defaultValue: '刷新' })}
        </Button>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <List
        size="small"
        dataSource={sortedItems}
        renderItem={item => {
          const selected = item.id === selectedId;
          const statusColor = getStatusColor(item.status);
          const locatorLabel = resolveLocatorLabel(item);
          const startedAtLabel = t('taskrouter.history.started_at_label', { defaultValue: '开始时间' });
          const startedAtText = `${startedAtLabel}：${formatTimestamp(item.createdAt)}`;
          const durationSeconds = formatDurationSeconds(item);
          const durationPrefix = t('taskrouter.history.duration_prefix', { defaultValue: '耗时' });
          const durationText =
            durationSeconds === '--'
              ? `${durationPrefix}：--`
              : `${durationPrefix}：${durationSeconds} ${t('taskrouter.history.duration_unit', { defaultValue: '秒' })}`;
          return (
            <List.Item
              onClick={() => onSelect(item)}
              style={{
                cursor: 'pointer',
                borderLeft: selected ? '3px solid #6ddBce' : '3px solid transparent',
                transition: 'border-color 0.2s ease',
              }}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space size="small" align="center" wrap>
                  <Tag color={statusColor}>
                    {t(`taskrouter.history.status.${item.status}`, {
                      defaultValue: statusLabelMap[item.status] ?? item.status,
                    })}
                  </Tag>
                  <Text strong ellipsis={{ tooltip: false }} style={{ maxWidth: 200 }}>
                    {locatorLabel}
                  </Text>
                  <Tooltip title={item.id}>
                    <Text type="secondary" ellipsis style={{ maxWidth: 160 }}>
                      ID: {item.id}
                    </Text>
                  </Tooltip>
                </Space>
                <Text type="secondary">{startedAtText}</Text>
                <Text type="secondary">{formatCharge(item.charge)}</Text>
                <Text type="secondary">{durationText}</Text>
                {item.message ? (
                  <Text type="secondary" ellipsis={{ tooltip: item.message }}>
                    {item.message}
                  </Text>
                ) : null}
              </Space>
            </List.Item>
          );
        }}
      />
    </Space>
  );
};

TaskHistoryList.displayName = 'TaskHistoryList';
