import React, { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  WidgetImageMaskProvider,
  type TranslateFn,
  type WidgetImageMaskLogger,
  type WidgetUploadPass,
  type WidgetUploadPassHandlers,
} from '../../../src/context/WidgetImageMaskContext';
import { MockExternalApiPlayground } from './MockExternalApiPlayground';
import { readBlobAsDataUrl } from './upload-helpers';
import { useProvideMockExternalApi } from './useProvideMockExternalApi';
import type { UploadPassRunSummary } from './types';

export interface MockExternalApiProviderProps {
  children: ReactNode;
  t: TranslateFn;
  logger: WidgetImageMaskLogger;
  imageUrls?: string[] | null;
  onImageUrlsChange?: (next: string[]) => void;
  panelWidth?: number | string;
}

export const MockExternalApiProvider: React.FC<MockExternalApiProviderProps> = ({
  children,
  t,
  logger,
  imageUrls,
  onImageUrlsChange,
  panelWidth,
}) => {
  const { actions, contextValue, resourceStore, getCurrentLayerId } = useProvideMockExternalApi(logger);
  const activeUploadsRef = useRef(new Map<WidgetUploadPass, AbortController | null>());
  const registeredPassesRef = useRef(new Set<WidgetUploadPass>());
  const runningUploadPassesRef = useRef(false);
  const [registeredUploadPassCount, setRegisteredUploadPassCount] = useState(0);
  const [lastUploadRunSummary, setLastUploadRunSummary] = useState<UploadPassRunSummary | null>(null);

  const createUploadId = useCallback(() => {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      'randomUUID' in globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
    return `mock-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const isAbortError = useCallback((error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const name = 'name' in error && typeof (error as { name?: unknown }).name === 'string'
      ? (error as { name: string }).name
      : undefined;
    return name === 'AbortError';
  }, []);

  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const nodeBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined;
    if (nodeBuffer?.from) {
      return nodeBuffer.from(buffer).toString('base64');
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return typeof btoa === 'function' ? btoa(binary) : '';
  }, []);

  const readUploadPayloadAsDataUrl = useCallback(
    async (payload: unknown): Promise<{ dataUrl: string; filename?: string }> => {
      if (payload == null) {
        throw new Error('empty-upload-payload');
      }
      if (typeof payload === 'string') {
        if (payload.startsWith('data:')) {
          return { dataUrl: payload, filename: undefined };
        }
        throw new Error('unsupported-upload-string');
      }
      if (typeof File !== 'undefined' && payload instanceof File) {
        const dataUrl = await readBlobAsDataUrl(payload);
        if (!dataUrl) throw new Error('empty-upload-data-url');
        return { dataUrl, filename: payload.name };
      }
      if (typeof Blob !== 'undefined' && payload instanceof Blob) {
        const dataUrl = await readBlobAsDataUrl(payload);
        if (!dataUrl) throw new Error('empty-upload-data-url');
        const filename = payload instanceof File && typeof payload.name === 'string' ? payload.name : undefined;
        return { dataUrl, filename };
      }
      if (typeof payload === 'object') {
        const typed = payload as any;
        if (typed.type === 'resource') {
          const resourceHandle: string | undefined =
            typeof typed.resource === 'string'
              ? typed.resource
              : typeof typed.resourceId === 'string'
                ? typed.resourceId
                : undefined;
          if (!resourceHandle) {
            throw new Error('resource-upload-missing-handle');
          }
          const snapshot = resourceStore.getSnapshot(resourceHandle);
          if (!snapshot) {
            throw new Error('resource-upload-not-found');
          }
          return {
            dataUrl: snapshot.dataUrl,
            filename: typeof typed.fileName === 'string' ? typed.fileName : undefined,
          };
        }
        if (typed.type === 'buffer') {
          const resourceData = typed.resource?.data;
          const mimeType =
            typed.resource?.mimeType ??
            typed.mimeType ??
            'application/octet-stream';
          const filename =
            typeof typed.fileName === 'string' ? typed.fileName : undefined;
          if (typeof resourceData === 'string') {
            if (resourceData.startsWith('data:')) {
              return { dataUrl: resourceData, filename };
            }
            return { dataUrl: `data:${mimeType};base64,${resourceData}`, filename };
          }
          if (resourceData instanceof ArrayBuffer) {
            const base64 = arrayBufferToBase64(resourceData);
            if (!base64) throw new Error('buffer-upload-empty');
            return { dataUrl: `data:${mimeType};base64,${base64}`, filename };
          }
        }
      }
      throw new Error('unsupported-upload-payload');
    },
    [arrayBufferToBase64, resourceStore]
  );

  const applyRandomUploadDelay = useCallback(async () => {
    const base = 600;
    const jitter = Math.random() * 700;
    const delay = Math.round(base + jitter);
    await new Promise<void>(resolve => {
      if (typeof setTimeout === 'function') {
        setTimeout(resolve, delay);
      } else {
        resolve();
      }
    });
  }, []);

  const performUpload = useCallback(
    async (pass: WidgetUploadPass, signal?: AbortSignal): Promise<string> => {
      try {
        const payload = await pass.getUploadFile(signal);
        const { dataUrl, filename } = await readUploadPayloadAsDataUrl(payload);
        await applyRandomUploadDelay();
        const response = await fetch('/api/mock-upload', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ filename, dataUrl }),
          signal,
        });
        if (!response.ok) {
          throw new Error(`upload-failed:${response.status}`);
        }
        const result: { url?: unknown } = await response.json();
        const rawUrl = typeof result?.url === 'string' ? result.url : '';
        if (!rawUrl) {
          throw new Error('invalid-upload-response');
        }
        const resolvedUrl =
          typeof window !== 'undefined' && rawUrl.startsWith('/')
            ? new URL(rawUrl, window.location.origin).toString()
            : rawUrl;
        if (typeof pass.onUploaded === 'function') {
          await pass.onUploaded(resolvedUrl);
        }
        return resolvedUrl;
      } catch (error) {
        const aborted = (signal?.aborted ?? false) || isAbortError(error);
        if (!aborted) {
          try {
            pass.onUploadError?.(error);
          } catch {
            // Ignore user handler errors
          }
        }
        throw error;
      }
    },
    [applyRandomUploadDelay, isAbortError, readUploadPayloadAsDataUrl]
  );

  const notifyAbort = useCallback((pass: WidgetUploadPass) => {
    const abortError =
      typeof DOMException !== 'undefined'
        ? new DOMException('Upload aborted', 'AbortError')
        : Object.assign(new Error('Upload aborted'), { name: 'AbortError' as const });
    try {
      pass.onUploadError?.(abortError);
    } catch {
      // Ignore user handler errors
    }
  }, []);

  const uploadPassHandlers = useMemo<WidgetUploadPassHandlers>(
    () => ({
      runUploadPassOnce: async pass => performUpload(pass),
      addUploadPass: pass => {
        const id = createUploadId();
        registeredPassesRef.current.add(pass);
        setRegisteredUploadPassCount(registeredPassesRef.current.size);
        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : (null as AbortController | null);
        activeUploadsRef.current.set(pass, controller);

        void performUpload(pass, controller?.signal)
          .catch(error => {
            if (controller?.signal?.aborted || isAbortError(error)) {
              return;
            }
            // Errors already surfaced via onUploadError; swallow to avoid console noise.
          })
          .finally(() => {
            activeUploadsRef.current.delete(pass);
          });

        return id;
      },
      removeUploadPass: pass => {
        registeredPassesRef.current.delete(pass);
        setRegisteredUploadPassCount(registeredPassesRef.current.size);
        const controller = activeUploadsRef.current.get(pass);
        activeUploadsRef.current.delete(pass);
        if (controller) {
          controller.abort();
          notifyAbort(pass);
        }
      },
    }),
    [createUploadId, isAbortError, notifyAbort, performUpload]
  );

  const runRegisteredUploadPasses = useCallback(async (): Promise<UploadPassRunSummary | void> => {
    if (runningUploadPassesRef.current) {
      return lastUploadRunSummary ?? undefined;
    }
    const passes = Array.from(registeredPassesRef.current);
    if (!passes.length) return;
    runningUploadPassesRef.current = true;
    let success = 0;
    try {
      for (const pass of passes) {
        try {
          await performUpload(pass);
          success += 1;
        } catch (error) {
          if (!isAbortError(error)) {
            try {
              logger('MockExternalApi runUploadPass error', error instanceof Error ? error.message : String(error));
            } catch {
              // ignore log errors
            }
          }
        }
      }
      const summary: UploadPassRunSummary = {
        total: passes.length,
        success,
        failure: passes.length - success,
        timestamp: Date.now(),
      };
      setLastUploadRunSummary(summary);
      return summary;
    } finally {
      runningUploadPassesRef.current = false;
    }
  }, [isAbortError, logger, performUpload, lastUploadRunSummary]);

  // NOTE: keep legacy file-picker logic for reference. The new mock returns a layer content URI.
  /*
  const pickSingleImageFile = useCallback(async (): Promise<File | null> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return null;
    }
    return new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed';
      input.style.left = '-10000px';
      input.style.top = '-10000px';

      let settled = false;
      const cleanup = () => {
        input.removeEventListener('change', handleChange);
        input.removeEventListener('cancel', handleCancel);
        window.removeEventListener('focus', handleFocus, true);
        input.remove();
      };
      const settle = (file: File | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(file);
      };
      const handleChange = () => {
        const file = input.files && input.files[0] ? input.files[0] : null;
        settle(file);
      };
      const handleCancel = () => settle(null);
      const handleFocus = () => {
        setTimeout(() => {
          if (settled) return;
          const file = input.files && input.files[0] ? input.files[0] : null;
          settle(file);
        }, 750);
      };

      input.addEventListener('change', handleChange);
      input.addEventListener('cancel', handleCancel);
      window.addEventListener('focus', handleFocus, true);
      document.body.appendChild(input);
      input.click();
    });
  }, []);

  const measureImage = useCallback(
    (dataUrl: string): Promise<{ width: number; height: number }> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = event => {
          try {
            logger('MockExternalApi measureImage error', String(event));
          } catch {
            // ignore logging errors
          }
          reject(new Error('Failed to load image'));
        };
        img.src = dataUrl;
      }),
    [logger],
  );

  const selectAdvancedContentSourceLegacy = useCallback(async () => {
    try {
      const file = await pickSingleImageFile();
      if (!file) return null;
      if (file.type && !file.type.startsWith('image/')) {
        logger('MockExternalApi selectAdvancedContentSource skipped non-image');
        return null;
      }
      const dataUrl = await readBlobAsDataUrl(file);
      if (!dataUrl) {
        logger('MockExternalApi selectAdvancedContentSource empty dataUrl');
        return null;
      }
      const { width, height } = await measureImage(dataUrl).catch(() => ({
        width: 512,
        height: 512,
      }));
      const record = resourceStore.createFromDataUrl(dataUrl, {
        width,
        height,
        mime: file.type && file.type.trim().length ? file.type : 'image/png',
      });
      return { fileUri: record.resource };
    } catch (error) {
      try {
        logger(
          'MockExternalApi selectAdvancedContentSource error',
          error instanceof Error ? error.message : String(error),
        );
      } catch {
        // ignore logging failures
      }
      return null;
    }
  }, [logger, measureImage, pickSingleImageFile, resourceStore]);
  */

  const selectAdvancedContentSource = useCallback(async () => {
    const rawLayerId = getCurrentLayerId();
    const normalizedLayerId = typeof rawLayerId === 'string' ? rawLayerId.trim() : '';
    if (!normalizedLayerId) {
      try {
        logger('MockExternalApi selectAdvancedContentSource missing layerId');
      } catch {
        // ignore logging failures
      }
      return null;
    }
    const encoded = encodeURIComponent(normalizedLayerId);
    return { contentUri: `uxp://content/0/layer?layerId=${encoded}` };
  }, [getCurrentLayerId, logger]);

  return (
    <WidgetImageMaskProvider
      actions={actions}
      t={t}
      logger={logger}
      debug
      resolveWorkBoundary={() => ''}
      subscribeToRealtimeChanges={contextValue.subscribeToRealtimeChanges}
      uploadPassHandlers={uploadPassHandlers}
      selectAdvancedContentSource={selectAdvancedContentSource}
    >
      <MockExternalApiPlayground
        stageRef={contextValue.stageRef}
        selectionRect={contextValue.selectionRect}
        updateSelectionRect={contextValue.updateSelectionRect}
        setCurrentLayerId={contextValue.setCurrentLayerId}
        notifyContentChange={contextValue.notifyContentChange}
        imageUrls={imageUrls}
        onImageUrlsChange={next => {
          logger('MockExternalApi imageUrls before update', Array.isArray(imageUrls) ? imageUrls : null);
          logger('MockExternalApi imageUrls next', next);
          if (onImageUrlsChange) {
            onImageUrlsChange(next);
          }
        }}
        onRunUploadPasses={runRegisteredUploadPasses}
        registeredUploadPassCount={registeredUploadPassCount}
        lastUploadRunSummary={lastUploadRunSummary}
        panelWidth={panelWidth}
      >
        {children}
      </MockExternalApiPlayground>
    </WidgetImageMaskProvider>
  );
};
