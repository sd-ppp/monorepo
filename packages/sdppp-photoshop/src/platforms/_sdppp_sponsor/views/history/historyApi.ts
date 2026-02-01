import type { SDPPPSponsor, RemoteHistoryItem } from '../../client';
import type { TaskHistoryRecord, TaskHistoryRecordStatus } from './historyStore';

const mapRemoteStatusToLocal = (status: string): TaskHistoryRecordStatus => {
  switch ((status ?? '').toLowerCase()) {
    case 'running':
    case 'processing':
    case 'active':
      return 'running';
    case 'pending':
    case 'queued':
    case 'creating':
      return 'pending';
    case 'completed':
    case 'succeeded':
      return 'completed';
    case 'failed':
    case 'errored':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const extractTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

export const normalizeHistoryRecord = (remote: RemoteHistoryItem): TaskHistoryRecord => {
  const createdAt = extractTimestamp(remote.enqueuedAt) ?? Date.now();
  const updatedAt = extractTimestamp(remote.updatedAt) ?? createdAt;
  const status = mapRemoteStatusToLocal(remote.status);
  let finishedAt: number | undefined;
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    finishedAt =
      extractTimestamp(remote.completedAt) ??
      extractTimestamp(remote.cancelledAt) ??
      updatedAt;
  }
  return {
    id: remote.jobId,
    templateId: remote.templateId,
    templateName: remote.templateName ?? null,
    status,
    message: remote.message ?? null,
    createdAt,
    updatedAt,
    finishedAt,
    providerTaskId: remote.providerTaskId ?? undefined,
    payload: remote.payload ?? null,
    charge: typeof remote.charge === 'number' ? remote.charge : undefined,
  };
};

export const fetchHistory = async (client: SDPPPSponsor, limit: number) => {
  const data = await client.fetchHistory({ limit });
  const items = data.items ?? [];
  return items
    .filter((item) => item && typeof item.jobId === 'string' && typeof item.templateId === 'string')
    .map(normalizeHistoryRecord)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const fetchHistoryDetail = async (
  client: SDPPPSponsor,
  record: TaskHistoryRecord
): Promise<TaskHistoryRecord> => {
  const detail = await client.fetchTaskDetail(record.templateId, record.id);
  if (!detail) return record;
  return {
    ...record,
    result: detail.result ?? null,
    charge: detail.charge,
    payload: detail.payload ?? record.payload,
  };
};
