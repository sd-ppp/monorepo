import { Flex } from 'antd';
import { memo } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { useStore } from 'zustand';
import { supabaseSessionStore } from '@sdppp/auth';
import type { SponsorAuthState } from '../auth/authStore';
import type { SponsorHistoryState, TaskHistoryRecord } from './historyStore';
import TaskHistoryDetail from './TaskHistoryDetail';
import TaskHistoryHeader from './TaskHistoryHeader';
import TaskHistoryList from './TaskHistoryList';
import TaskHistoryModal from './TaskHistoryModal';

export type SponsorHistoryProps = {
  t: (key: string, options?: any) => string;
  historyStore: UseBoundStore<StoreApi<SponsorHistoryState>>;
  authStore: UseBoundStore<StoreApi<SponsorAuthState>>;
  active: boolean;
  onSelect: (record: TaskHistoryRecord) => void;
  onRefresh: () => void;
  onDetailRefresh: () => void;
  onSendImage: (url: string) => Promise<void> | void;
  sendingUrl: string | null;
  resolveTemplateLabel: (item: { templateId: string; templateName?: string | null }) => string;
};

const SponsorHistory = memo(function SponsorHistory({
  t,
  historyStore,
  authStore,
  active,
  onSelect,
  onRefresh,
  onDetailRefresh,
  onSendImage,
  sendingUrl,
  resolveTemplateLabel,
}: SponsorHistoryProps) {
  const history = historyStore(state => state.history);
  const historyLoading = historyStore(state => state.historyLoading);
  const historyError = historyStore(state => state.historyError);
  const selectedId = historyStore(state => state.selectedId);
  const detailRecord = historyStore(state => state.detailRecord);
  const detailOutputs = historyStore(state => state.detailOutputs);
  const detailLoading = historyStore(state => state.detailLoading);
  const detailError = historyStore(state => state.detailError);
  const detailVisible = historyStore(state => state.detailVisible);
  const authLoading = authStore(state => state.authLoading);
  const hasSession = !!useStore(supabaseSessionStore, (state) => state.session);

  const selectedRecord = history.find(item => item.id === selectedId) ?? null;

  return (
    <>
      <Flex style={{ width: '100%' }}>
        <Flex vertical style={{ flex: 1, width: '100%' }} gap={8}>
          <TaskHistoryHeader
            t={t}
            loading={historyLoading}
            onRefresh={onRefresh}
            disabled={authLoading || !hasSession || !active}
          />
          <TaskHistoryList
            items={history}
            loading={historyLoading}
            error={historyError}
            selectedId={selectedId}
            onSelect={onSelect}
            resolveTemplateLabel={resolveTemplateLabel}
          />
        </Flex>
      </Flex>
      <TaskHistoryModal
        open={detailVisible && hasSession}
        title={t('taskrouter.history.detail_title', { defaultValue: 'Task Details' })}
        onClose={() => historyStore.getState().setDetailVisible(false)}
      >
        <TaskHistoryDetail
          record={detailRecord ?? selectedRecord}
          outputs={detailOutputs}
          loading={detailLoading}
          error={detailError}
          onRefresh={onDetailRefresh}
          onSendImage={onSendImage}
          sendingUrl={sendingUrl}
        />
      </TaskHistoryModal>
    </>
  );
});

export default SponsorHistory;
