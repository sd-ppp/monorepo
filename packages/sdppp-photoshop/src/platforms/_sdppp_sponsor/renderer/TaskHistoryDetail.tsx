import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { Alert, Button, Descriptions, Empty, Image, Space, Spin, Typography, message } from 'antd';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { Send } from 'lucide-react';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { createFileResourceFromExternal } from '@sdppp/resourcing/src/@mainweb/file-resource-actions';
import { useTaskExecutionStore } from '../../base/taskExecutionStore';

import type { TaskHistoryRecord } from '../store';

const { Text } = Typography;

const formatTimestamp = (value?: number): string => {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatDurationSeconds = (record: TaskHistoryRecord): string => {
  if (record.finishedAt && record.finishedAt >= record.createdAt) {
    const seconds = Math.max(0, Math.round((record.finishedAt - record.createdAt) / 1000));
    return String(seconds);
  }
  return '--';
};

const formatCharge = (charge?: number): string => {
  const value = typeof charge === 'number' ? charge : 0;
  return `-${value}积分`;
};

/**
 * 从 payload 中提取所有 key 包含 'prompt' 的字段
 * 支持嵌套对象的递归查找
 */
const extractPromptFields = (payload: Record<string, any> | null | undefined): Array<{ key: string; value: any }> => {
  const result: Array<{ key: string; value: any }> = [];
  
  if (!payload || typeof payload !== 'object') {
    return result;
  }

  const traverse = (obj: any, parentKey = '') => {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      
      // 检查 key 是否包含 'prompt' (不区分大小写)
      if (key.toLowerCase().includes('prompt')) {
        result.push({ key: fullKey, value });
      }
      
      // 如果值是对象或数组，递归查找
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        traverse(value, fullKey);
      }
    }
  };

  traverse(payload);
  return result;
};

export interface TaskHistoryDetailProps {
  record: TaskHistoryRecord | null;
  outputs: string[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  resolveLocatorLabel: (item: { locator: string; templateName?: string | null }) => string;
  onClose?: () => void;
}

export const TaskHistoryDetail: FC<TaskHistoryDetailProps> = ({
  record,
  outputs,
  loading,
  error,
  onRefresh,
  resolveLocatorLabel,
  onClose,
}) => {
  const { t } = useTranslation();
  const [sendingUrl, setSendingUrl] = useState<string | null>(null);

  const resolveCurrentDocContext = useCallback(() => {
    try {
      const photoshopState = sdpppSDK?.stores?.PhotoshopStore?.getState?.();
      const webviewState = sdpppSDK?.stores?.WebviewStore?.getState?.();
      const activeDocId = photoshopState?.activeDocumentID;
      if (typeof activeDocId !== 'number' || !Number.isFinite(activeDocId) || activeDocId <= 0) {
        return { docId: undefined, boundaryUri: null };
      }
      const boundary = webviewState?.workBoundaries?.[activeDocId] ?? null;
      const imageSizeLimit = webviewState?.workBoundaryMaxSizes?.[activeDocId];
      const imageQuality = webviewState?.workBoundaryImageQualities?.[activeDocId];
      const boundaryUri = buildBoundaryUri(activeDocId, boundary ?? null, {
        imageSize:
          typeof imageSizeLimit === 'number' && Number.isFinite(imageSizeLimit) && imageSizeLimit > 0
            ? Math.round(imageSizeLimit)
            : undefined,
        imageQuality:
          typeof imageQuality === 'number' && Number.isFinite(imageQuality)
            ? Math.round(imageQuality)
            : undefined,
      });
      return { docId: activeDocId, boundaryUri };
    } catch (error) {
      console.warn('[TaskRouter] resolveCurrentDocContext failed', error);
      return { docId: undefined, boundaryUri: null };
    }
  }, []);

  const handleSendImage = useCallback(
    async (url: string) => {
      setSendingUrl(url);
      
      // 🎯 获取 store 的 action 方法
      const setProgressMessage = useTaskExecutionStore.getState().setProgressMessage;
      const setRunError = useTaskExecutionStore.getState().setRunError;
      
      try {
        const { boundaryUri } = resolveCurrentDocContext();
        
        // 🎯 显示导入进度
        setProgressMessage(t('taskrouter.history.importing', { defaultValue: '正在导入历史图片...' }));
        
        // 1. 下载图片并创建资源
        const res = await createFileResourceFromExternal({
          url,
          fileName: `taskrouter_history_${Date.now()}.png`,
        });
        
        const primary = res && Array.isArray(res.batch) && res.batch.length 
          ? res.batch[0] ?? res 
          : res;
        const resource = (primary as any)?.resource as string | undefined;
        const handle = (primary as any)?.handle as any;
        const width = (primary as any)?.width as number | undefined;
        const height = (primary as any)?.height as number | undefined;
        
        if (!resource) {
          throw new Error(t('taskrouter.history.send_failed_resource', { defaultValue: '创建文件资源失败' }));
        }
        
        // 2. 等待资源准备就绪（如果需要）
        let resourceIdentifier = resource;
        if (!resourceIdentifier && handle?.getResource) {
          await new Promise(resolve => setTimeout(resolve, 200));
          resourceIdentifier = handle.getResource();
        }
        
        if (!resourceIdentifier) {
          throw new Error(t('taskrouter.history.send_failed_identifier', { defaultValue: '资源标识符无效' }));
        }
        
        // 3. 直接导入到画布
        await sdpppSDK.plugins.photoshop.importImage({
          type: 'smartobject',
          resource: resourceIdentifier,
          boundaryUri: boundaryUri ?? null,
          sourceWidth: width,
          sourceHeight: height,
        });
        
        // 4. 清理资源句柄
        if (handle?.dispose) {
          try {
            handle.dispose();
          } catch (disposeError) {
            console.warn('[TaskRouter] Failed to dispose resource handle:', disposeError);
          }
        }
        
        // 🎯 清除进度消息
        setProgressMessage('');
        setRunError('');
        
        message.success(t('taskrouter.history.send_success', { defaultValue: '图片已导入到画布' }));
        onClose?.();
      } catch (error: any) {
        console.error('[TaskRouter] send history image failed', error);
        
        // 🎯 显示错误信息
        setRunError(error?.message ?? String(error));
        setProgressMessage('');
        
        message.error(error?.message ?? String(error));
      } finally {
        setSendingUrl(current => (current === url ? null : current));
      }
    },
    [onClose, resolveCurrentDocContext, t]
  );

  if (!record) {
    return <Empty description={t('taskrouter.history.select_prompt', { defaultValue: '请选择一个历史任务' })} />;
  }

  const durationSeconds = formatDurationSeconds(record);
  const durationLabel = t('taskrouter.history.duration_prefix', { defaultValue: '耗时' });
  const durationValue =
    durationSeconds === '--'
      ? '--'
      : `${durationSeconds} ${t('taskrouter.history.duration_unit', { defaultValue: '秒' })}`;
  const createdLabel = t('taskrouter.history.createdAt', { defaultValue: '创建时间' });
  const chargeLabel = t('taskrouter.history.charge', { defaultValue: '扣除积分' });

  const promptFields = extractPromptFields(record.payload);
  const hasPromptFields = promptFields.length > 0;

  const hasImages = outputs.length > 0;
  const imagesLabel = t('taskrouter.history.images', { defaultValue: '输出预览' });

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
                {t('taskrouter.history.retry', { defaultValue: '重新加载' })}
              </Button>
            }
          />
        ) : null}
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label={t('taskrouter.history.id', { defaultValue: '任务 ID' })}>
            {record.id}
          </Descriptions.Item>
          <Descriptions.Item label={createdLabel}>
            {formatTimestamp(record.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label={chargeLabel}>{formatCharge(record.charge)}</Descriptions.Item>
          <Descriptions.Item label={durationLabel}>{durationValue}</Descriptions.Item>
          {hasPromptFields ? (
            promptFields.map(({ key, value }) => (
              <Descriptions.Item 
                key={key} 
                label={t(`taskrouter.history.prompt.${key}`, { defaultValue: key })}
              >
                <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </Text>
              </Descriptions.Item>
            ))
          ) : null}
          {record.message ? (
            <Descriptions.Item label={t('taskrouter.history.message', { defaultValue: '提示信息' })}>
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
                      disabled={sendingUrl !== null && sendingUrl !== url}
                      onClick={event => {
                        event.stopPropagation();
                        void handleSendImage(url);
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
          <Empty description={t('taskrouter.history.no_images', { defaultValue: '暂无可预览图像' })} />
        ) : null}
      </Space>
    </Spin>
  );
};

TaskHistoryDetail.displayName = 'TaskHistoryDetail';
