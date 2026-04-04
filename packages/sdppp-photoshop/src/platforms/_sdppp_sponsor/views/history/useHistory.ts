import { sdpppSDK, t as translate } from '@sdppp/common';
import { createFileResourceFromExternal } from '@sdppp/resourcing/src/@mainweb/file-resource-actions';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { supabaseSessionStore } from '@sdppp/auth';
import { useTaskExecutionStore } from '../../../base/taskExecutionStore';
import { sponsorAuthStore } from '../auth/authStore';
import { sponsorUiStore } from '../uiStore';
import { fetchHistory, fetchHistoryDetail } from './historyApi';
import { sponsorHistoryStore, type TaskHistoryRecord } from './historyStore';

const DEFAULT_HISTORY_PAGE_SIZE = 10;

export const useHistory = (options: { active: boolean; pageSize?: number; t?: (key: string, options?: any) => string }) => {
  const [sendingUrl, setSendingUrl] = useState<string | null>(null);
  const pageSize = options.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  const initialized = sponsorUiStore(state => state.initialized);
  const hasSession = !!useStore(supabaseSessionStore, (state) => state.session);
  const authLoading = sponsorAuthStore(state => state.authLoading);
  const history = sponsorHistoryStore(state => state.history);
  const selectedId = sponsorHistoryStore(state => state.selectedId);
  const setHistory = sponsorHistoryStore(state => state.setHistory);
  const setHistoryLoading = sponsorHistoryStore(state => state.setHistoryLoading);
  const setHistoryError = sponsorHistoryStore(state => state.setHistoryError);
  const setSelectedId = sponsorHistoryStore(state => state.setSelectedId);
  const setDetailRecord = sponsorHistoryStore(state => state.setDetailRecord);
  const setDetailOutputs = sponsorHistoryStore(state => state.setDetailOutputs);
  const setDetailLoading = sponsorHistoryStore(state => state.setDetailLoading);
  const setDetailError = sponsorHistoryStore(state => state.setDetailError);
  const setDetailVisible = sponsorHistoryStore(state => state.setDetailVisible);

  const refreshHistoryList = useCallback(async (opts?: { silent?: boolean; limit?: number }) => {
    const { silent = false, limit = pageSize } = opts ?? {};
    const client = sponsorAuthStore.getState().client;
    if (!client) {
      if (!silent) {
        setHistoryLoading(false);
      }
      return;
    }
    if (!silent) {
      setHistoryLoading(true);
      setHistoryError(null);
    } else {
      setHistoryError(null);
    }
    try {
      const items = await fetchHistory(client, limit);
      setHistory(items);
    } catch (error: any) {
      setHistoryError(error?.message ?? String(error));
    } finally {
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, [pageSize, setHistory, setHistoryError, setHistoryLoading]);

  const handleSelect = useCallback(async (record: TaskHistoryRecord) => {
    if (!hasSession) return;
    setSelectedId(record.id);
    setDetailOutputs([]);
    setDetailError(null);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const client = sponsorAuthStore.getState().client;
      if (!client) {
        throw new Error(
          translate('taskrouter.history.client_missing', {
            defaultValue: 'TaskRouter client is not initialized',
          })
        );
      }
      const detailRecord = await fetchHistoryDetail(client, record);
      setDetailRecord(detailRecord);
      const outputs = extractImageUrlsFromResult(detailRecord.result ?? null);
      setDetailOutputs(outputs);
      setDetailError(null);
    } catch (error: any) {
      setDetailRecord(record);
      setDetailOutputs([]);
      setDetailError(error?.message ?? String(error));
    } finally {
      setDetailLoading(false);
    }
  }, [hasSession, setDetailError, setDetailLoading, setDetailOutputs, setDetailRecord, setDetailVisible, setSelectedId]);

  const handleDetailRefresh = useCallback(() => {
    const record = history.find(item => item.id === selectedId);
    if (!record) return;
    void handleSelect(record);
  }, [handleSelect, history, selectedId]);

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

      const setProgressMessage = useTaskExecutionStore.getState().setProgressMessage;
      const setRunError = useTaskExecutionStore.getState().setRunError;
      const t = options.t ?? translate;

      try {
        const { boundaryUri } = resolveCurrentDocContext();
        setProgressMessage(
          t('taskrouter.history.importing', {
            defaultValue: 'Importing history image...',
          })
        );

        const res = await createFileResourceFromExternal({
          url,
          fileName: `taskrouter_history_${Date.now()}.png`,
        });

        const primary = res && Array.isArray(res.batch) && res.batch.length ? res.batch[0] ?? res : res;
        const resource = (primary as any)?.resource as string | undefined;
        const handle = (primary as any)?.handle as any;
        const width = (primary as any)?.width as number | undefined;
        const height = (primary as any)?.height as number | undefined;

        if (!resource) {
          throw new Error(
            t('taskrouter.history.send_failed_resource', {
              defaultValue: 'Failed to create file resource',
            })
          );
        }

        let resourceIdentifier = resource;
        if (!resourceIdentifier && handle?.getResource) {
          await new Promise(resolve => setTimeout(resolve, 200));
          resourceIdentifier = handle.getResource();
        }

        if (!resourceIdentifier) {
          throw new Error(
            t('taskrouter.history.send_failed_identifier', {
              defaultValue: 'Invalid resource identifier',
            })
          );
        }

        await sdpppSDK.plugins.photoshop.importImage({
          type: 'smartobject',
          resource: resourceIdentifier,
          boundaryUri: boundaryUri ?? null,
          sourceWidth: width,
          sourceHeight: height,
        });

        if (handle?.dispose) {
          try {
            handle.dispose();
          } catch (disposeError) {
            console.warn('[TaskRouter] Failed to dispose resource handle:', disposeError);
          }
        }

        setProgressMessage('');
        setRunError('');

        message.success(
          t('taskrouter.history.send_success', {
            defaultValue: 'Image imported to canvas',
          })
        );
      } catch (error: any) {
        console.error('[TaskRouter] send history image failed', error);
        setRunError(error?.message ?? String(error));
        setProgressMessage('');
        message.error(error?.message ?? String(error));
      } finally {
        setSendingUrl(current => (current === url ? null : current));
      }
    },
    [options.t, resolveCurrentDocContext]
  );

  useEffect(() => {
    if (!initialized) return;
    if (!options.active) return;
    if (authLoading) return;
    if (!hasSession) return;
    void refreshHistoryList({ limit: pageSize });
  }, [authLoading, hasSession, initialized, options.active, pageSize, refreshHistoryList]);

  useEffect(() => {
    if (!initialized) return;
    if (!options.active) return;
    if (!hasSession) return;
    if (typeof window === 'undefined') return;
    const intervalId = window.setInterval(() => {
      void refreshHistoryList({ silent: true, limit: pageSize });
    }, 45000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasSession, initialized, options.active, pageSize, refreshHistoryList]);

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
  }, [history, selectedId, setDetailError, setDetailOutputs, setDetailRecord, setDetailVisible, setSelectedId]);

  useEffect(() => {
    if (!options.active) {
      setDetailVisible(false);
    }
  }, [options.active, setDetailVisible]);

  useEffect(() => {
    if (!hasSession) {
      setDetailVisible(false);
      setDetailOutputs([]);
      setDetailRecord(null);
      setSelectedId(null);
    }
  }, [hasSession, setDetailOutputs, setDetailRecord, setDetailVisible, setSelectedId]);

  return {
    refreshHistory: refreshHistoryList,
    handleSelect,
    handleDetailRefresh,
    handleSendImage,
    sendingUrl,
  };
};


const isRenderableUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image') || trimmed.startsWith('blob:');
};

const extractImageUrlsFromResult = (
  result: Array<{ url?: string; [key: string]: any }> | null | undefined
): string[] => {
  if (!Array.isArray(result)) return [];

  const urls = new Set<string>();

  for (const item of result) {
    if (!item || typeof item !== 'object') continue;
    if (isRenderableUrl(item.url)) {
      urls.add(item.url.trim());
    }
    const rawData = item.rawData;
    if (rawData && typeof rawData === 'object' && isRenderableUrl(rawData.url)) {
      urls.add(rawData.url.trim());
    }
  }

  return Array.from(urls);
};
