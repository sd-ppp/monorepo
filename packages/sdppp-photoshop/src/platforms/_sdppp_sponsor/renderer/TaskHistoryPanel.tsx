import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Flex, Modal } from 'antd';
import { useTranslation } from '@sdppp/common';
import { RotateCcw } from 'lucide-react';

import {
  sdpppSponsorStore,
  type TaskHistoryRecord,
  DEFAULT_HISTORY_PAGE_SIZE,
} from '../store';
import { TaskHistoryList } from './TaskHistoryList';
import { TaskHistoryDetail } from './TaskHistoryDetail';

const isRenderableUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image') || trimmed.startsWith('blob:');
};

/**
 * 从 result 数组中提取图片 URL
 * result 结构: [{ url: "https://...", content: "", rawData: { url: "...", content: "" } }, ...]
 */
const extractImageUrlsFromResult = (result: Array<{ url?: string; [key: string]: any }> | null | undefined): string[] => {
  if (!Array.isArray(result)) return [];
  
  const urls = new Set<string>();
  
  for (const item of result) {
    if (!item || typeof item !== 'object') continue;
    
    // 检查顶层 url 字段
    if (isRenderableUrl(item.url)) {
      urls.add(item.url.trim());
    }
    
    // 检查 rawData 中的 url
    const rawData = item.rawData;
    if (rawData && typeof rawData === 'object' && isRenderableUrl(rawData.url)) {
      urls.add(rawData.url.trim());
    }
  }
  
  return Array.from(urls);
};

interface TaskHistoryPanelProps {
  initialized: boolean;
  authLoading: boolean;
  hasSession: boolean;
  active: boolean;
  pageSize?: number;
}

export const TaskHistoryPanel: FC<TaskHistoryPanelProps> = ({
  initialized,
  authLoading,
  hasSession,
  active,
  pageSize = DEFAULT_HISTORY_PAGE_SIZE,
}) => {
  const { t } = useTranslation();
  const history = sdpppSponsorStore(state => state.history);
  const historyLoading = sdpppSponsorStore(state => state.historyLoading);
  const historyError = sdpppSponsorStore(state => state.historyError);
  const refreshHistory = sdpppSponsorStore(state => state.refreshHistory);
  const templates = sdpppSponsorStore(state => state.templates);
  const ensureAuthSession = sdpppSponsorStore(state => state.ensureAuthSession);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRecord, setDetailRecord] = useState<TaskHistoryRecord | null>(null);  // ✅ 存储详情记录（包含 result 和 charge）
  const [detailOutputs, setDetailOutputs] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const templateLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach(item => {
      if (!item) return;
      const label = item.label ?? item.value ?? item.templateId;
      
      // 使用 value (template id) 作为 key
      if (item.value) {
        map.set(item.value, label);
      }
      
      // 使用 templateId 作为 key
      if (item.templateId) {
        map.set(item.templateId, label);
      }
    });
    return map;
  }, [templates]);

  const resolveTemplateLabel = useCallback(
    (item: { templateId: string; templateName?: string | null }) => {
      // 1. 优先使用从数据库 JOIN 获取的 templateName
      if (item.templateName) {
        return item.templateName;
      }
      
      // 2. 降级：从 templateLabelMap 中查找
      const value = item.templateId;
      if (templateLabelMap.has(value)) {
        return templateLabelMap.get(value)!;
      }
      
      // 3. 最终降级：返回原始 templateId
      return value;
    },
    [templateLabelMap]
  );

  const selectedRecord = useMemo(
    () => history.find(item => item.id === selectedId) ?? null,
    [history, selectedId]
  );

  useEffect(() => {
    if (!initialized) return;
    if (!active) return;
    if (authLoading) return;
    if (!hasSession) return;
    void refreshHistory({ limit: pageSize });
  }, [initialized, authLoading, hasSession, active, refreshHistory, pageSize]);

  useEffect(() => {
    if (!initialized) return;
    if (!active) return;
    if (!hasSession) return;
    if (typeof window === 'undefined') return;
    const intervalId = window.setInterval(() => {
      void refreshHistory({ silent: true, limit: pageSize });
    }, 45000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialized, hasSession, active, refreshHistory, pageSize]);

  useEffect(() => {
    if (!history.length && selectedId !== null) {
      setSelectedId(null);
      setDetailRecord(null);
      setDetailOutputs([]);
      setDetailError(null);
      setDetailVisible(false);
    } else if (selectedId && !history.some(item => item.id === selectedId)) {
      setSelectedId(null);
      setDetailRecord(null);
      setDetailOutputs([]);
      setDetailError(null);
      setDetailVisible(false);
    }
  }, [history, selectedId]);

  const fetchHistoryDetail = useCallback(
    async (record: TaskHistoryRecord) => {
      setDetailLoading(true);
      setDetailError(null);
      setDetailRecord(null);
      try {
        let client = sdpppSponsorStore.getState().client;
        if (!client) {
          await ensureAuthSession();
          client = sdpppSponsorStore.getState().client;
        }
        if (!client) {
          throw new Error(t('taskrouter.history.client_missing', { defaultValue: 'TaskRouter 客户端未初始化' }));
        }
        // ✅ 使用新的 fetchTaskDetail 方法获取完整详情
        const detail = await client.fetchTaskDetail(record.templateId, record.id);
        if (detail) {
          // 合并基础记录和详情（详情包含 result 和 charge）
          const mergedRecord: TaskHistoryRecord = {
            ...record,
            result: detail.result ?? null,
            charge: detail.charge,
            payload: detail.payload ?? record.payload,
          };
          setDetailRecord(mergedRecord);
          const urls = extractImageUrlsFromResult(detail.result);
          setDetailOutputs(urls);
        } else {
          setDetailRecord(record);
          setDetailOutputs([]);
        }
        setDetailError(null);
      } catch (error: any) {
        console.error('[TaskRouter] fetchHistoryDetail failed', error);
        setDetailRecord(record);
        setDetailOutputs([]);
        setDetailError(error?.message ?? String(error));
      } finally {
        setDetailLoading(false);
      }
    },
    [ensureAuthSession, t]
  );

  useEffect(() => {
    if (!active) {
      setDetailVisible(false);
    }
  }, [active]);

  useEffect(() => {
    if (!hasSession) {
      setDetailVisible(false);
      setDetailOutputs([]);
      setDetailRecord(null);
      setSelectedId(null);
    }
  }, [hasSession]);

  const handleSelect = useCallback((item: TaskHistoryRecord) => {
    if (!hasSession) return;
    setSelectedId(item.id);
    setDetailOutputs([]);
    setDetailError(null);
    setDetailVisible(true);
    void fetchHistoryDetail(item);
  }, [fetchHistoryDetail, hasSession]);

  const handleRefresh = useCallback(() => {
    void refreshHistory({ limit: pageSize });
  }, [refreshHistory, pageSize]);

  const handleDetailRefresh = useCallback(() => {
    if (!selectedRecord) return;
    void fetchHistoryDetail(selectedRecord);
  }, [selectedRecord, fetchHistoryDetail]);

  return (
    <>
      <Flex style={{ width: '100%' }}>
        <Flex vertical style={{ flex: 1, width: '100%' }} gap={8}>
          <Flex justify="space-between" align="center">
            <span style={{ color: 'var(--ant-color-text-tertiary)' }}>
              {t('taskrouter.history.limit_notice', { defaultValue: '当前版本限制获取最近10条' })}
            </span>
            <Button
              type="text"
              size="small"
              icon={<RotateCcw size={16} />}
              loading={historyLoading}
              onClick={handleRefresh}
              disabled={authLoading || !hasSession || !active}
              style={{ color: 'inherit' }}
            >
              {t('taskrouter.history.refresh', { defaultValue: '刷新' })}
            </Button>
          </Flex>
          <TaskHistoryList
            items={history}
            loading={historyLoading}
            error={historyError}
            selectedId={selectedId}
            onSelect={handleSelect}
            onRefresh={handleRefresh}
            resolveLocatorLabel={resolveTemplateLabel}
            refreshDisabled={authLoading || !hasSession || !active}
          />
        </Flex>
      </Flex>
      <Modal
        open={detailVisible && hasSession}
        title={t('taskrouter.history.detail_title', { defaultValue: '任务详情' })}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        destroyOnClose
        width={720}
      >
        <TaskHistoryDetail
          record={detailRecord ?? selectedRecord}
          outputs={detailOutputs}
          loading={detailLoading}
          error={detailError}
          onRefresh={handleDetailRefresh}
          resolveLocatorLabel={resolveTemplateLabel}
          onClose={() => setDetailVisible(false)}
        />
      </Modal>
    </>
  );
};

TaskHistoryPanel.displayName = 'TaskHistoryPanel';
