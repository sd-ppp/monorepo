import type { FC } from 'react';
import { Alert, Button, Descriptions, Empty, Image, Space, Spin, Typography } from 'antd';
import { useTranslation } from '@sdppp/common';
import { Send } from 'lucide-react';

import type { TaskHistoryRecord } from './historyStore';
import {
  extractPromptFields,
  formatCharge,
  formatDurationSeconds,
  formatTimestamp,
} from './taskHistoryUtils';

const { Text } = Typography;

export interface TaskHistoryDetailProps {
  record: TaskHistoryRecord | null;
  outputs: string[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSendImage?: (url: string) => Promise<void> | void;
  sendingUrl?: string | null;
}

const TaskHistoryDetail: FC<TaskHistoryDetailProps> = ({
  record,
  outputs,
  loading,
  error,
  onRefresh,
  onSendImage,
  sendingUrl = null,
}) => {
  const { t } = useTranslation();

  if (!record) {
    return <Empty description={t('taskrouter.history.select_prompt', { defaultValue: 'Select a history task' })} />;
  }

  const durationSeconds = formatDurationSeconds(record);
  const durationLabel = t('taskrouter.history.duration_prefix', { defaultValue: 'Duration' });
  const durationValue =
    durationSeconds === '--'
      ? '--'
      : `${durationSeconds} ${t('taskrouter.history.duration_unit', { defaultValue: 'sec' })}`;
  const createdLabel = t('taskrouter.history.createdAt', { defaultValue: 'Created At' });
  const chargeLabel = t('taskrouter.history.charge', { defaultValue: 'Points Spent' });

  const promptFields = extractPromptFields(record.payload);
  const hasPromptFields = promptFields.length > 0;

  const hasImages = outputs.length > 0;
  const imagesLabel = t('taskrouter.history.images', { defaultValue: 'Outputs' });
  const sendDisabled = !onSendImage;

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button size="small" onClick={onRefresh}>
                {t('taskrouter.history.retry', { defaultValue: 'Retry' })}
              </Button>
            }
          />
        ) : null}
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label={t('taskrouter.history.id', { defaultValue: 'Task ID' })}>
            {record.id}
          </Descriptions.Item>
          <Descriptions.Item label={createdLabel}>{formatTimestamp(record.createdAt)}</Descriptions.Item>
          <Descriptions.Item label={chargeLabel}>{formatCharge(record.charge, t)}</Descriptions.Item>
          <Descriptions.Item label={durationLabel}>{durationValue}</Descriptions.Item>
          {hasPromptFields
            ? promptFields.map(({ key, value }) => (
                <Descriptions.Item key={key} label={t(`taskrouter.history.prompt.${key}`, { defaultValue: key })}>
                  <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </Text>
                </Descriptions.Item>
              ))
            : null}
          {record.message ? (
            <Descriptions.Item label={t('taskrouter.history.message', { defaultValue: 'Message' })}>
              <Text>{record.message}</Text>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
        {hasImages ? (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text strong>{imagesLabel}</Text>
            <Image.PreviewGroup>
              <Space size="middle" wrap style={{ width: '100%' }}>
                {outputs.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    style={{
                      flex: '1 1 220px',
                      minWidth: 220,
                      maxWidth: '100%',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        paddingBottom: '100%',
                      }}
                    />
                    <Image
                      src={url}
                      wrapperStyle={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                    <Button
                      type="primary"
                      shape="circle"
                      size="large"
                      icon={<Send size={20} strokeWidth={1.5} />}
                      loading={sendingUrl === url}
                      disabled={sendDisabled || (sendingUrl !== null && sendingUrl !== url)}
                      onClick={event => {
                        event.stopPropagation();
                        if (onSendImage) {
                          void onSendImage(url);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        right: 12,
                        bottom: 12,
                        width: 48,
                        height: 48,
                        padding: 8,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      }}
                    />
                  </div>
                ))}
              </Space>
            </Image.PreviewGroup>
          </Space>
        ) : !error ? (
          <Empty description={t('taskrouter.history.no_images', { defaultValue: 'No images to preview' })} />
        ) : null}
      </Space>
    </Spin>
  );
};

TaskHistoryDetail.displayName = 'TaskHistoryDetail';

export default TaskHistoryDetail;
