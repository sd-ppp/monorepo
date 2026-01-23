import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePhotoshopWidgetActions, useWidgetRealtimeSubscriber } from '../../context/PhotoshopWidgetContext';
import type { BoundaryUri, ContentType, ContentUri, FileUri, MaskUri } from './types';
import {
  parseBoundaryUri,
  parseContentUri,
  parseMaskUri,
} from './uri-utils';

const DEFAULT_IMAGE_SIZE_LIMIT = 192;
const DEFAULT_IMAGE_QUALITY = 1;
const EMPTY_MASK_PLACEHOLDER_PATTERN = /^uxp:\/\/mask\/[^/]+\/empty(?:[/?#]|$)/i;

const summarizeParamsForLog = (params: {
  fileUri?: string | null;
  contentUri?: string | null;
  boundaryUri?: string | null;
  maskUri?: string | null;
}): string => {
  const parts: string[] = [];
  const fileUri = typeof params.fileUri === 'string' ? params.fileUri.trim() : '';
  const contentUri = typeof params.contentUri === 'string' ? params.contentUri.trim() : '';
  const boundaryUri = typeof params.boundaryUri === 'string' ? params.boundaryUri.trim() : '';
  const maskUri = typeof params.maskUri === 'string' ? params.maskUri.trim() : '';

  if (fileUri) parts.push(`文件URI=${fileUri}`);
  if (contentUri) parts.push(`内容URI=${contentUri}`);
  if (boundaryUri) parts.push(`边界URI=${boundaryUri}`);
  if (maskUri) parts.push(`遮罩URI=${maskUri}`);

  return parts.length > 0 ? parts.join('，') : '没有可用的输入参数';
};

const isEmptyMaskPlaceholder = (uri: string): boolean => {
  if (!uri.trim()) {
    return false;
  }
  return EMPTY_MASK_PLACEHOLDER_PATTERN.test(uri.trim());
};

const enforceBoundaryImageParams = (uri: string): string => {
  const trimmed = uri.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const normalized = new URL(trimmed);
    normalized.searchParams.set('imageSize', String(DEFAULT_IMAGE_SIZE_LIMIT));
    if (!normalized.searchParams.has('imageQuality')) {
      normalized.searchParams.set('imageQuality', String(DEFAULT_IMAGE_QUALITY));
    }
    return normalized.toString();
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?';
    const withSize = trimmed.includes('imageSize=')
      ? trimmed.replace(/imageSize=\d+/i, `imageSize=${DEFAULT_IMAGE_SIZE_LIMIT}`)
      : `${trimmed}${separator}imageSize=${DEFAULT_IMAGE_SIZE_LIMIT}`;
    if (withSize.includes('imageQuality=')) {
      return withSize;
    }
    const qualitySeparator = withSize.includes('?') ? '&' : '?';
    return `${withSize}${qualitySeparator}imageQuality=${DEFAULT_IMAGE_QUALITY}`;
  }
};

const logThumbnail = (_message: string, _details?: unknown) => {
  return;
};

type ThumbnailVariant =
  | {
      kind: 'file';
      fileUri: string;
    }
  | {
      kind: 'resource';
      docId: number;
      contentUri: ContentUri;
      boundaryUri: BoundaryUri;
      maskUri: string | null;
      watchedContents: ContentType[];
    };

export type UseThumbnailParams =
  | {
      contentUri: ContentUri;
      boundaryUri: BoundaryUri;
      maskUri?: MaskUri | string;
      fileUri?: FileUri;
    }
  | {
      fileUri: FileUri;
      contentUri?: ContentUri;
      boundaryUri?: BoundaryUri;
      maskUri?: MaskUri | string;
    };

export interface UseThumbnailSnapshot {
  data: string | null;
}

export interface UseThumbnailResult extends UseThumbnailSnapshot {
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<UseThumbnailSnapshot>;
}

export interface UseThumbnailOptions {
  disableRealtime?: boolean;
}

export const useThumbnail = (
  params: UseThumbnailParams,
  options?: UseThumbnailOptions,
): UseThumbnailResult => {
  const actions = usePhotoshopWidgetActions();
  const realtimeSubscriber = useWidgetRealtimeSubscriber();
  const disableRealtime = Boolean(options?.disableRealtime);

  const {
    fileUri,
    contentUri,
    boundaryUri,
    maskUri,
  } = params;

  const inputSummary = useMemo(
    () =>
      summarizeParamsForLog({
        fileUri: fileUri ?? null,
        contentUri: contentUri ?? null,
        boundaryUri: boundaryUri ?? null,
        maskUri: maskUri ?? null,
      }),
    [fileUri, contentUri, boundaryUri, maskUri],
  );

  const parsed = useMemo<{
    value: ThumbnailVariant | null;
    error: Error | null;
  }>(() => {
    try {
      if (fileUri !== undefined) {
        const trimmed = fileUri.trim();
        if (!trimmed) {
          throw new Error('fileUri must be a non-empty string.');
        }
        return { value: { kind: 'file', fileUri: trimmed }, error: null };
      }

      if (!contentUri || !boundaryUri) {
        throw new Error('contentUri and boundaryUri are required when fileUri is not provided.');
      }

      const normalizedBoundaryUri = enforceBoundaryImageParams(boundaryUri) as BoundaryUri;
      const trimmedContentUri = contentUri.trim();

      if (!normalizedBoundaryUri || !trimmedContentUri) {
        throw new Error('contentUri and boundaryUri must be non-empty strings.');
      }

      const isContentUri = trimmedContentUri.startsWith('uxp://content/');
      const normalizedContentUri = trimmedContentUri as ContentUri;
      if (!isContentUri) {
        // non-content URIs are forwarded without validation
      }

      const maskString = typeof maskUri === 'string' ? maskUri.trim() : '';
      const sanitizedMaskUri =
        maskString.length > 0 && !isEmptyMaskPlaceholder(maskString) ? maskString : null;

      const boundary = parseBoundaryUri(normalizedBoundaryUri);
      const content = isContentUri ? parseContentUri(normalizedContentUri) : null;
      const isMaskUri = sanitizedMaskUri?.startsWith('uxp://mask/');
      if (sanitizedMaskUri && !isMaskUri) {
        // non-mask URIs are forwarded without validation
      }

      const mask = isMaskUri ? parseMaskUri(sanitizedMaskUri as MaskUri) : null;

      if (content && boundary.docId !== content.docId) {
        throw new Error('Content, boundary, and mask URIs must point to the same document.');
      }
      if (mask && boundary.docId !== mask.docId) {
        throw new Error('Content, boundary, and mask URIs must point to the same document.');
      }

      const watchedSeeds = [
        ...(content ? [content.content] : []),
        ...(mask ? [mask.content] : []),
      ];
      const watchedContents = Array.from(new Set(watchedSeeds)) as ContentType[];

      return {
        value: {
          kind: 'resource',
          docId: boundary.docId,
          contentUri: normalizedContentUri,
          boundaryUri: normalizedBoundaryUri,
          maskUri: sanitizedMaskUri,
          watchedContents,
        },
        error: null,
      };
    } catch (error) {
      const failure = error as Error;
      return { value: null, error: failure };
    }
  }, [fileUri, contentUri, boundaryUri, maskUri]);

  const [data, setData] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(parsed.error);
  const [autoSuppressed, setAutoSuppressed] = useState(false);

  const requestIdRef = useRef(0);
  const isActiveRef = useRef(true);
  const isFetchingRef = useRef(false);
  const ignoreAutoUntilRef = useRef(0);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const executeRefetch = useCallback(
    async (source: 'manual' | 'auto'): Promise<UseThumbnailSnapshot> => {
      if (source === 'auto' && autoSuppressed) {
        logThumbnail('useThumbnail.executeRefetch skip.autoSuppressed', {
          source,
          autoSuppressed,
          isFetching: isFetchingRef.current,
          summary: inputSummary,
        });
        return { data };
      }

      if (!parsed.value) {
        const parseError = parsed.error ?? new Error('Invalid hook parameters.');
        setError(parseError);
        console.log(`[useThumbnail] 参数错误，输入：${inputSummary}`);
        logThumbnail('useThumbnail.executeRefetch invalidParams', {
          source,
          summary: inputSummary,
        });
        return Promise.reject(parseError);
      }

      logThumbnail('useThumbnail.executeRefetch begin', {
        source,
        autoSuppressed,
        isFetching: isFetchingRef.current,
        summary: inputSummary,
      });
      console.log(`[useThumbnail] 开始获取缩略图，输入：${inputSummary}`);

      const requestId = ++requestIdRef.current;
      isFetchingRef.current = true;
      ignoreAutoUntilRef.current = Date.now() + 300;
      setIsFetching(true);
      setError(null);

      let executionSummary = '未确定的逻辑路径';
      try {
        let thumbnail: string | null = null;

        if (parsed.value.kind === 'file') {
          executionSummary = '文件模式：直接调用 resource.thumbnail 获取缩略图';
          const result = await actions['resource.thumbnail']({
            resource: parsed.value.fileUri,
          });
          if (result?.error) {
            throw new Error(`resource.thumbnail: ${result.error}`);
          }
          thumbnail =
            typeof result?.thumbnail === 'string' && result.thumbnail.length > 0
              ? result.thumbnail
              : null;
        } else {
          const hasMask = Boolean(parsed.value.maskUri);
          executionSummary = hasMask
            ? '资源模式：调用 resource.file.combineByCBM（携带遮罩参数）'
            : '资源模式：调用 resource.file.combineByCBM（未提供遮罩）';
          const result = await actions['resource.file.combineByCBM']({
            contentUri: parsed.value.contentUri,
            boundaryUri: parsed.value.boundaryUri,
            maskUri: parsed.value.maskUri || undefined,
            thumbnail: true,
          });
          const handle = result?.handle ?? null;
          const resourceId =
            typeof result?.resource === 'string' && result.resource.trim().length > 0
              ? result.resource.trim()
              : '';
          try {
            if (result?.error) {
              throw new Error(`resource.file.combineByCBM: ${result.error}`);
            }
            if (resourceId) {
              executionSummary = hasMask
                ? '资源模式：resource.file.combineByCBM -> resource.thumbnail（遮罩已传递）'
                : '资源模式：resource.file.combineByCBM -> resource.thumbnail（无遮罩参数）';
              const thumbResult = await actions['resource.thumbnail']({
                resource: resourceId,
              });
              if (thumbResult?.error) {
                throw new Error(`resource.thumbnail: ${thumbResult.error}`);
              }
              thumbnail =
                typeof thumbResult?.thumbnail === 'string' && thumbResult.thumbnail.length > 0
                  ? thumbResult.thumbnail
                  : null;
            } else {
              executionSummary = '资源模式：resource.file.combineByCBM 未返回资源ID';
              thumbnail = null;
            }
          } finally {
            handle?.dispose();
          }
        }

        console.log(`[useThumbnail] 完成获取，逻辑路径：${executionSummary}`);

        if (isActiveRef.current && requestIdRef.current === requestId) {
          setAutoSuppressed(false);
          setData(thumbnail);
          setIsFetching(false);
        }

        logThumbnail('useThumbnail.executeRefetch success', {
          source,
          summary: inputSummary,
          hasData: Boolean(thumbnail),
        });

        return { data: thumbnail };
      } catch (thrown) {
        const failure =
          thrown instanceof Error ? thrown : new Error(String(thrown ?? 'Unknown error'));
        console.log(
          `[useThumbnail] 获取失败，逻辑路径：${executionSummary}，原因：${failure.message}`,
        );
        logThumbnail('useThumbnail.executeRefetch failed', {
          source,
          summary: inputSummary,
          message: failure.message,
        });
        if (isActiveRef.current && requestIdRef.current === requestId) {
          setError(failure);
          setIsFetching(false);
          setAutoSuppressed(true);
        }
        throw failure;
      } finally {
        isFetchingRef.current = false;
        const cooldownUntil = Date.now() + 200;
        if (cooldownUntil > ignoreAutoUntilRef.current) {
          ignoreAutoUntilRef.current = cooldownUntil;
        }
      }
    },
    [actions, autoSuppressed, data, inputSummary, parsed],
  );

  const refetch = useCallback(
    () => executeRefetch('manual'),
    [executeRefetch],
  );

  useEffect(() => {
    if (parsed.error) {
      setError(parsed.error);
      setData(null);
      setIsFetching(false);
    } else {
      setError(null);
    }
  }, [parsed.error]);

  useEffect(() => {
    if (parsed.error) return;

    let cancelled = false;
    const run = () => {
      if (cancelled || autoSuppressed) return;
      void executeRefetch('auto').catch(() => {
        /* auto fetch failure handled internally */
      });
    };

    const raf = (globalThis as Record<string, unknown>)['requestAnimationFrame'];
    if (typeof raf === 'function') {
      const boundRaf = raf as (cb: (time: number) => void) => number;
      const frameId = boundRaf(() => run());
      return () => {
        cancelled = true;
        const caf = (globalThis as Record<string, unknown>)['cancelAnimationFrame'];
        if (typeof caf === 'function') {
          (caf as (handle: number) => void)(frameId);
        }
      };
    }

    const timeoutId = setTimeout(run, 16);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [autoSuppressed, executeRefetch, parsed.error, parsed.value]);

  useEffect(() => {
    if (disableRealtime) {
      logThumbnail('useThumbnail.realtime disabled', {
        summary: inputSummary,
      });
      return;
    }
    if (!parsed.value || parsed.value.kind !== 'resource' || parsed.error) return;
    if (!realtimeSubscriber) return;
    if (parsed.value.watchedContents.length === 0) return;

    return realtimeSubscriber(parsed.value.docId, parsed.value.watchedContents, () => {
      if (Date.now() < ignoreAutoUntilRef.current) {
        logThumbnail('useThumbnail.realtime skip.cooldown', {
          summary: inputSummary,
          ignoreUntil: ignoreAutoUntilRef.current,
        });
        return;
      }
      if (isFetchingRef.current || autoSuppressed) {
        logThumbnail('useThumbnail.realtime skip.inProgress', {
          summary: inputSummary,
          isFetching: isFetchingRef.current,
          autoSuppressed,
        });
        return;
      }
      logThumbnail('useThumbnail.realtime refetch', {
        summary: inputSummary,
      });
      void executeRefetch('auto').catch(() => {
        /* auto fetch failure handled internally */
      });
    });
  }, [
    autoSuppressed,
    disableRealtime,
    executeRefetch,
    parsed.error,
    parsed.value,
    realtimeSubscriber,
  ]);

  useEffect(() => {
    setAutoSuppressed(false);
    ignoreAutoUntilRef.current = 0;
  }, [fileUri, contentUri, boundaryUri, maskUri]);

  return {
    data,
    isFetching,
    error,
    refetch,
  };
};
