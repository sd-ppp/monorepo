import type { TaskHistoryRecord } from './historyStore';

export const formatTimestamp = (value?: number): string => {
  if (!value) return '--';
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export const formatDurationSeconds = (record: TaskHistoryRecord): string => {
  if (record.finishedAt && record.finishedAt >= record.createdAt) {
    const seconds = Math.max(0, Math.round((record.finishedAt - record.createdAt) / 1000));
    return String(seconds);
  }
  return '--';
};

export const formatCharge = (
  charge: number | undefined,
  t: (key: string, options?: any) => string
): string => {
  const value = typeof charge === 'number' ? charge : 0;
  return t('taskrouter.history.charge_value', { defaultValue: '-{{value}} points', value });
};

export const extractPromptFields = (
  payload: Record<string, any> | null | undefined
): Array<{ key: string; value: any }> => {
  const result: Array<{ key: string; value: any }> = [];

  if (!payload || typeof payload !== 'object') {
    return result;
  }

  const traverse = (obj: any, parentKey = '') => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      if (key.toLowerCase().includes('prompt')) {
        result.push({ key: fullKey, value });
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        traverse(value, fullKey);
      }
    }
  };

  traverse(payload);
  return result;
};
