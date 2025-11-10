import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useWidgetDebug,
  useWidgetImageMaskActions,
  useWidgetLogger,
  useWidgetRealtimeSubscriber,
} from '../../context/WidgetImageMaskContext';
import type { BoundaryUri, ContentType, ContentUri, FileUri, MaskUri } from './types';
import {
  parseBoundaryUri,
  parseContentUri,
  parseMaskUri,
} from './uri-utils';

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

export const useThumbnail = (params: UseThumbnailParams): UseThumbnailResult => {
  const actions = useWidgetImageMaskActions();
  const logger = useWidgetLogger();
  const realtimeSubscriber = useWidgetRealtimeSubscriber();
  const debug = useWidgetDebug();

  const {
    fileUri,
    contentUri,
    boundaryUri,
    maskUri,
  } = params;

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

      const normalizedBoundaryUri = boundaryUri.trim() as BoundaryUri;
      const normalizedContentUri = contentUri.trim() as ContentUri;

      if (!normalizedBoundaryUri || !normalizedContentUri) {
        throw new Error('contentUri and boundaryUri must be non-empty strings.');
      }

      const maskString = typeof maskUri === 'string' ? maskUri.trim() : '';
      const sanitizedMaskUri = maskString.length > 0 ? maskString : null;

      const boundary = parseBoundaryUri(normalizedBoundaryUri);
      const content = parseContentUri(normalizedContentUri);
      const isMaskUri = sanitizedMaskUri?.startsWith('uxp://mask/');
      if (sanitizedMaskUri && !isMaskUri && debug) {
        logger(
          'useThumbnail mask passthrough',
          JSON.stringify({ maskUri: sanitizedMaskUri, note: 'non-mask URI forwarded to CBM' }),
        );
      }

      const mask = isMaskUri ? parseMaskUri(sanitizedMaskUri as MaskUri) : null;

      if (boundary.docId !== content.docId || (mask && boundary.docId !== mask.docId)) {
        throw new Error('Content, boundary, and mask URIs must point to the same document.');
      }

      const watchedSeeds = mask ? [content.content, mask.content] : [content.content];
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
      logger(
        'useThumbnail params invalid',
        JSON.stringify({
          fileUri,
          contentUri,
          boundaryUri,
          maskUri,
          message: failure.message,
        }),
      );
      return { value: null, error: failure };
    }
  }, [fileUri, contentUri, boundaryUri, maskUri, logger, debug]);

  const [data, setData] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(parsed.error);

  const requestIdRef = useRef(0);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const refetch = useCallback(async (): Promise<UseThumbnailSnapshot> => {
    if (!parsed.value) {
      const parseError = parsed.error ?? new Error('Invalid hook parameters.');
      setError(parseError);
      return Promise.reject(parseError);
    }

    const requestId = ++requestIdRef.current;
    setIsFetching(true);
    setError(null);

    try {
      let thumbnail: string | null = null;

      if (parsed.value.kind === 'file') {
        if (debug) {
          logger(
            'useThumbnail fetch',
            JSON.stringify({
              variant: 'file',
              fileUri: parsed.value.fileUri,
            }),
          );
        }
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
        if (debug) {
          logger(
            'useThumbnail fetch',
            JSON.stringify({
              variant: 'resource',
              contentUri: parsed.value.contentUri,
              boundaryUri: parsed.value.boundaryUri,
              maskUri: parsed.value.maskUri,
              watchedContents: parsed.value.watchedContents,
            }),
          );
        }
        const result = await actions['resource.file.createFromCBM']({
          contentUri: parsed.value.contentUri,
          boundaryUri: parsed.value.boundaryUri,
          maskUri: parsed.value.maskUri ?? undefined,
        });
        if (result?.error) {
          throw new Error(`resource.file.createFromCBM: ${result.error}`);
        }
        thumbnail =
          typeof result?.thumbnail === 'string' && result.thumbnail.length > 0
            ? result.thumbnail
            : null;
      }

      if (isActiveRef.current && requestIdRef.current === requestId) {
        setData(thumbnail);
        setIsFetching(false);
      }

      return { data: thumbnail };
    } catch (thrown) {
      const failure =
        thrown instanceof Error ? thrown : new Error(String(thrown ?? 'Unknown error'));
      logger(
        'useThumbnail failed',
        JSON.stringify({
          message: failure.message,
          stack: failure.stack,
        }),
      );
      if (isActiveRef.current && requestIdRef.current === requestId) {
        setError(failure);
        setIsFetching(false);
      }
      throw failure;
    }
  }, [actions, parsed, logger, debug]);

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
    void refetch();
  }, [parsed.value, parsed.error, refetch]);

  useEffect(() => {
    if (!parsed.value || parsed.value.kind !== 'resource' || parsed.error) return;
    if (!realtimeSubscriber) return;

    return realtimeSubscriber(parsed.value.docId, parsed.value.watchedContents, () => {
      void refetch();
    });
  }, [realtimeSubscriber, parsed.value, parsed.error, refetch]);

  return {
    data,
    isFetching,
    error,
    refetch,
  };
};
