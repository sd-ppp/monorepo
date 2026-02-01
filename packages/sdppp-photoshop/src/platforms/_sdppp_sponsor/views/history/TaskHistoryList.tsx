import type { FC } from 'react';
import { useMemo } from 'react';
import { Alert, Empty, List, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from '@sdppp/common';

import type { TaskHistoryRecord, TaskHistoryRecordStatus } from './historyStore';

const { Text } = Typography;

const statusColorMap: Record<TaskHistoryRecordStatus, string> = {
  pending: 'default',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'gold',
};

const statusLabelMap: Record<TaskHistoryRecordStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
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

const formatCharge = (
  charge: number | undefined,
  t: (key: string, options?: any) => string
): string => {
  const value = typeof charge === 'number' ? charge : 0;
  return t('taskrouter.history.charge_value', { defaultValue: '-{{value}} points', value });
};

const getStatusColor = (status: TaskHistoryRecordStatus) => statusColorMap[status] ?? 'default';

export interface TaskHistoryListProps {
  items: TaskHistoryRecord[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (item: TaskHistoryRecord) => void;
  resolveTemplateLabel: (item: { templateId: string; templateName?: string | null }) => string;
}

const TaskHistoryList: FC<TaskHistoryListProps> = ({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  resolveTemplateLabel,
}) => {
  const { t } = useTranslation();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  if (loading) {
    return (
      <Spin tip={t('taskrouter.history.loading', { defaultValue: 'Loading history tasks...' })}>
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
            description={t('taskrouter.history.empty', { defaultValue: 'No history tasks' })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
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
          const locatorLabel = resolveTemplateLabel(item);
          const startedAtLabel = t('taskrouter.history.started_at_label', { defaultValue: 'Started At' });
          const startedAtText = `${startedAtLabel}: ${formatTimestamp(item.createdAt)}`;
          const durationSeconds = formatDurationSeconds(item);
          const durationPrefix = t('taskrouter.history.duration_prefix', { defaultValue: 'Duration' });
          const durationText =
            durationSeconds === '--'
              ? `${durationPrefix}: --`
              : `${durationPrefix}: ${durationSeconds} ${t('taskrouter.history.duration_unit', { defaultValue: 'sec' })}`;
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
                <Text type="secondary">{formatCharge(item.charge, t)}</Text>
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

export default TaskHistoryList;
