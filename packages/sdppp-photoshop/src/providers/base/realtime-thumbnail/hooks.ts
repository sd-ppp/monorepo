import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';

import { sdpppSDK } from '@sdppp/common';

import type {
  BoundaryRect,
  BoundarySetting,
  BoundaryUri,
  ContentType,
  ContentUri,
  MaskUri,
} from './types';
import {
  parseBoundaryUri,
  parseContentUri,
  parseMaskUri,
} from './uri-utils';

const log = sdpppSDK.logger.extend('realtime-thumbnail');

type HookStatus = 'idle' | 'loading' | 'success' | 'error';

interface ImageThumbnailResult {
  composite: string | null;
  image: string | null;
  mask: string | null;
}

interface MaskThumbnailResult {
  mask: string | null;
}

type UseRealtimeImageThumbnailParams =
  | {
      fileUri: string;
      realtime?: boolean;
      autoFetch?: boolean;
      compose?: boolean;
      contentUri?: never;
      boundaryUri?: never;
      maskUri?: never;
    }
  | {
      contentUri: ContentUri;
      boundaryUri: BoundaryUri;
      maskUri?: MaskUri | null;
      realtime?: boolean;
      autoFetch?: boolean;
      compose?: boolean;
      fileUri?: never;
    };

interface UseRealtimeMaskThumbnailParams {
  maskUri: MaskUri;
  boundaryUri: BoundaryUri;
  realtime?: boolean;
  autoFetch?: boolean;
}

type ImageHookVariant =
  | {
      kind: 'file';
      fileUri: string;
    }
  | {
      kind: 'resource';
      docId: number;
      boundaryUri: BoundaryUri;
      boundary: BoundarySetting;
      contentUri: ContentUri;
      content: ParsedContent;
      maskUri: MaskUri;
      mask: ParsedMask;
    };

interface ParsedMaskHookInput {
  docId: number;
  boundaryUri: BoundaryUri;
  boundary: BoundarySetting;
  maskUri: MaskUri;
  mask: ParsedMask;
}

type PhotoshopState = ReturnType<typeof sdpppSDK.stores.PhotoshopStore.getState>;

const UNIQUE_MAX_THUMBNAIL_SIZE = 192;

const shouldTriggerForContent = (
  content: ContentType,
  state: PhotoshopState,
  prev: PhotoshopState | undefined
): boolean => {
  if (!prev) return false;

  switch (content) {
    case 'canvas':
      return state.canvasStateID !== prev.canvasStateID;
    case 'selection':
      return state.selectionStateID !== prev.selectionStateID;
    case 'curlayer':
      return (
        state.canvasStateID !== prev.canvasStateID ||
        state.selectionStateID !== prev.selectionStateID
      );
    default:
      return false;
  }
};

const subscribeToRealtimeChanges = (
  docId: number,
  watched: ContentType[],
  callback: () => void
): (() => void) => {
  const store = sdpppSDK?.stores?.PhotoshopStore;
  if (!store?.subscribe) {
    console.warn('[RealtimeThumbnailHooks] PhotoshopStore subscribe unavailable');
    return () => undefined;
  }

  const unsubscribe = store.subscribe((state: PhotoshopState, prev?: PhotoshopState) => {
    if (state.activeDocumentID !== docId) {
      const becameActive = prev?.activeDocumentID !== docId && state.activeDocumentID === docId;
      if (becameActive) {
        callback();
      }
      return;
    }

    if (!prev) {
      return;
    }

    if (prev.activeDocumentID !== docId) {
      callback();
      return;
    }

    const shouldTrigger = watched.some(content => shouldTriggerForContent(content, state, prev));
    if (shouldTrigger) {
      callback();
    }
  });

  return unsubscribe;
};

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = error => reject(error);
    image.src = src;
  });

const compositeImageWithMask = async (
  image: string | null,
  mask: string | null
): Promise<string | null> => {
  if (!image) return null;
  if (!mask) return image;

  if (typeof document === 'undefined') {
    return image;
  }

  try {
    const [imageElement, maskElement] = await Promise.all([
      loadImageElement(image),
      loadImageElement(mask),
    ]);

    const width = imageElement.naturalWidth || imageElement.width;
    const height = imageElement.naturalHeight || imageElement.height;
    if (!width || !height) return image;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return image;

    ctx.drawImage(imageElement, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return image;

    maskCtx.drawImage(maskElement, 0, 0, width, height);
    const maskData = maskCtx.getImageData(0, 0, width, height).data;

    // Use mask's Red channel to drive output alpha (kept consistent with plugin)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i + 3] = maskData[i];
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  } catch (error) {
    console.warn('[RealtimeThumbnailHooks] composite failed', error);
    return image;
  }
};

const logThumbnailWarning = (scope: string, details: Record<string, unknown>): void => {
  try {
    log(scope, details);
  } catch {
    // fall through if logger unavailable
  }
};

const extractThumbnail = async (
  resource: unknown,
  plugin: any,
  resourceType: 'image' | 'mask'
): Promise<string | null> => {
  const typed = resource as { thumbnail?: string; resource?: string } | undefined;
  if (!typed) return null;

  let thumbnail = typeof typed.thumbnail === 'string' ? typed.thumbnail : null;

  if (!thumbnail && typed.resource) {
    try {
      const fallback = await plugin?.getThumbnail?.({
        resource: typed.resource,
        maxSize: UNIQUE_MAX_THUMBNAIL_SIZE,
      });
      thumbnail = typeof fallback?.thumbnail === 'string' ? fallback.thumbnail : thumbnail;
    } catch (error) {
      console.warn(`[RealtimeThumbnailHooks] getThumbnail ${resourceType} failed`, error);
    }
  }

  if (typed.resource) {
    try {
      await plugin?.deleteDownloadedImage?.({ resources: [typed.resource] });
    } catch (error) {
      console.warn(`[RealtimeThumbnailHooks] deleteDownloadedImage ${resourceType} failed`, error);
    }
  }

  if (thumbnail) {
    const looksLikeDataUrl = typeof thumbnail === 'string' && /^data:/.test(thumbnail);
    if (!looksLikeDataUrl && thumbnail.length <= 32) {
      logThumbnailWarning('unexpected-thumbnail-string', {
        resourceType,
        preview: thumbnail,
        length: thumbnail.length,
        hasResource: !!typed.resource,
      });
    }
  }

  return thumbnail ?? null;
};

const fetchImageThumbnail = async (
  boundaryUri: BoundaryUri,
  contentUri: ContentUri,
  maskUri: MaskUri | null | undefined,
  compose: boolean
): Promise<ImageThumbnailResult> => {
  const photoshopPlugin = sdpppSDK?.plugins?.photoshop as any;
  if (!photoshopPlugin?.getResourceImage || !photoshopPlugin?.getResourceMask) {
    throw new Error('Photoshop plugin does not expose image/mask resource APIs.');
  }

  const imageResource = await photoshopPlugin.getResourceImage({
    boundary: boundaryUri,
    content: contentUri,
  });

  if (imageResource && typeof imageResource === 'object' && 'error' in imageResource) {
    log('getResourceImage-error', {
      boundaryUri,
      contentUri,
      error: (imageResource as any).error,
    });
  } else {
    log('getResourceImage-response', {
      boundaryUri,
      contentUri,
      hasThumbnail: typeof (imageResource as any)?.thumbnail === 'string',
      hasResource: typeof (imageResource as any)?.resource === 'string',
    });
  }

  let maskResource: unknown = null;
  if (maskUri) {
    try {
      maskResource = await photoshopPlugin.getResourceMask({
        boundary: boundaryUri,
        content: maskUri,
      });
    } catch (error) {
      log('getResourceMask-exception', {
        boundaryUri,
        contentUri: maskUri,
        error: error instanceof Error ? error.message : String(error),
      });
      maskResource = null;
    }
  }

  if (maskResource && typeof maskResource === 'object' && 'error' in maskResource) {
    log('getResourceMask-error', {
      boundaryUri,
      contentUri: maskUri,
      error: (maskResource as any).error,
    });
  }

  const [imageThumbnail, maskThumbnail] = await Promise.all([
    extractThumbnail(imageResource, photoshopPlugin, 'image'),
    extractThumbnail(maskResource, photoshopPlugin, 'mask'),
  ]);

  log('thumbnail-result', {
    boundaryUri,
    contentUri,
    maskUri,
    hasImageThumbnail: !!imageThumbnail,
    hasMaskThumbnail: !!maskThumbnail,
  });

  if (!imageThumbnail) {
    logThumbnailWarning('missing-image-thumbnail', {
      boundaryUri,
      contentUri,
      hasImageResource: !!imageResource,
      imageKeys: imageResource ? Object.keys(imageResource) : null,
    });
  }

  const composite = compose
    ? await compositeImageWithMask(imageThumbnail, maskThumbnail)
    : imageThumbnail;

  return {
    composite,
    image: imageThumbnail,
    mask: maskThumbnail,
  };
};

const fetchMaskThumbnail = async (
  boundaryUri: BoundaryUri,
  maskUri: MaskUri
): Promise<MaskThumbnailResult> => {
  const photoshopPlugin = sdpppSDK?.plugins?.photoshop as any;
  if (!photoshopPlugin?.getResourceMask) {
    throw new Error('Photoshop plugin does not expose mask resource API.');
  }

  const maskResource = await photoshopPlugin.getResourceMask({
    boundary: boundaryUri,
    content: maskUri,
  });

  const maskThumbnail = await extractThumbnail(maskResource, photoshopPlugin, 'mask');
  return { mask: maskThumbnail };
};

const fetchFileThumbnail = async (fileUri: string, compose: boolean): Promise<ImageThumbnailResult> => {
  const photoshopPlugin = sdpppSDK?.plugins?.photoshop as any;
  if (!photoshopPlugin?.getThumbnail) {
    throw new Error('Photoshop plugin does not expose getThumbnail API.');
  }

  const res = await photoshopPlugin.getThumbnail({
    resource: fileUri,
    maxSize: UNIQUE_MAX_THUMBNAIL_SIZE,
  });

  const thumbnail = typeof res?.thumbnail === 'string' ? res.thumbnail : null;
  const composite = compose ? thumbnail : thumbnail;

  return {
    composite,
    image: thumbnail,
    mask: null,
  };
};

const useIsMountedRef = (): MutableRefObject<boolean> => {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
};

export const useRealtimeImageThumbnail = (
  params: UseRealtimeImageThumbnailParams
): {
  data: string | null;
  image: string | null;
  mask: string | null;
  status: HookStatus;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<ImageThumbnailResult>;
} => {
  const { realtime = true, autoFetch = true, compose = true } = params;

  const fileUri = 'fileUri' in params ? params.fileUri : undefined;
  const contentUri = 'contentUri' in params ? params.contentUri : undefined;
  const boundaryUri = 'boundaryUri' in params ? params.boundaryUri : undefined;
  const maskUri = 'maskUri' in params ? params.maskUri : undefined;

  const parsed = useMemo<{
    value: ImageHookVariant | null;
    error: Error | null;
  }>(() => {
    try {
      if (fileUri) {
        if (typeof fileUri !== 'string' || fileUri.trim().length === 0) {
          throw new Error('fileUri must be a non-empty string.');
        }
        return { value: { kind: 'file', fileUri } as ImageHookVariant, error: null };
      }

      if (!contentUri || !boundaryUri) {
        throw new Error('contentUri and boundaryUri are required when fileUri is not provided.');
      }

      const boundary = parseBoundaryUri(boundaryUri);
      const content = parseContentUri(contentUri);
      const mask = maskUri ? parseMaskUri(maskUri as MaskUri) : ({ docId: boundary.docId, content: { content: 'canvas', layerIdentify: null } } as any);

      if (boundary.docId !== content.docId || (maskUri && boundary.docId !== mask.docId)) {
        throw new Error('Content, boundary, and mask URIs must point to the same document.');
      }

      const result: ImageHookVariant = {
        kind: 'resource',
        docId: boundary.docId,
        boundaryUri,
        boundary: boundary.boundary,
        contentUri,
        content,
        maskUri: (maskUri as MaskUri) ?? null,
        mask,
      };

      return { value: result, error: null };
    } catch (error) {
      return { value: null, error: error as Error };
    }
  }, [fileUri, contentUri, boundaryUri, maskUri]);

  const effectiveRealtime = parsed.value?.kind === 'file' ? false : realtime;

  const [data, setData] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [status, setStatus] = useState<HookStatus>('idle');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(parsed.error);

  const requestIdRef = useRef(0);
  const mountedRef = useIsMountedRef();

  const refetch = useCallback(async (): Promise<ImageThumbnailResult> => {
    if (!parsed.value) {
      const parseError = parsed.error ?? new Error('Invalid hook parameters.');
      setError(parseError);
      setStatus('error');
      return Promise.reject(parseError);
    }

    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setIsFetching(true);
    setError(null);

    log('refetch-start', {
      requestId,
      boundaryUri: parsed.value.kind === 'file' ? null : parsed.value.boundaryUri,
      contentUri: parsed.value.kind === 'file' ? null : parsed.value.contentUri,
      maskUri: parsed.value.kind === 'file' ? null : parsed.value.maskUri,
      compose,
    });
    try {
      // Extra console for environments without logger namespace enabled
      // eslint-disable-next-line no-console
      console.debug('[RealtimeThumbnailHooks] refetch-start', {
        requestId,
        boundaryUri: parsed.value.kind === 'file' ? null : parsed.value.boundaryUri,
        contentUri: parsed.value.kind === 'file' ? null : parsed.value.contentUri,
        maskUri: parsed.value.kind === 'file' ? null : parsed.value.maskUri,
        compose,
      });
    } catch {}

    try {
      const result =
        parsed.value.kind === 'file'
          ? await fetchFileThumbnail(parsed.value.fileUri, compose)
          : await fetchImageThumbnail(
              parsed.value.boundaryUri,
              parsed.value.contentUri,
              parsed.value.maskUri,
              compose
            );

      if (mountedRef.current && requestIdRef.current === requestId) {
        log('refetch-apply', {
          requestId,
          compositeLen: result.composite?.length ?? null,
          imageLen: result.image?.length ?? null,
          maskLen: result.mask?.length ?? null,
        });
        try {
          // eslint-disable-next-line no-console
          console.debug('[RealtimeThumbnailHooks] refetch-apply', {
            requestId,
            compositeLen: result.composite?.length ?? null,
            imageLen: result.image?.length ?? null,
            maskLen: result.mask?.length ?? null,
          });
        } catch {}
        setData(result.composite);
        setImage(result.image);
        setMask(result.mask);
        setStatus('success');
        setIsFetching(false);
      }
      log('refetch-complete', {
        requestId,
        applied: mountedRef.current && requestIdRef.current === requestId,
        latestRequestId: requestIdRef.current,
      });
      try {
        // eslint-disable-next-line no-console
        console.debug('[RealtimeThumbnailHooks] refetch-complete', {
          requestId,
          applied: mountedRef.current && requestIdRef.current === requestId,
          latestRequestId: requestIdRef.current,
        });
      } catch {}

      return result;
    } catch (fetchError) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setError(fetchError as Error);
        setStatus('error');
        setIsFetching(false);
      }
      log('refetch-error', {
        requestId,
        message: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });
      throw fetchError;
    }
  }, [parsed, compose, mountedRef]);

  useEffect(() => {
    if (!parsed.error) {
      setError(null);
      return;
    }

    setError(parsed.error);
    setStatus('error');
  }, [parsed.error]);

  useEffect(() => {
    if (!autoFetch || parsed.error) return;

    void refetch();
  }, [autoFetch, parsed.error, refetch]);

  useEffect(() => {
    if (!effectiveRealtime || !parsed.value || parsed.error) return;

    if (parsed.value.kind === 'file') return;

    const watched = new Set<ContentType>([parsed.value.content.content, parsed.value.mask.content]);
    const unsubscribe = subscribeToRealtimeChanges(parsed.value.docId, [...watched], () => {
      void refetch();
    });

    return () => unsubscribe();
  }, [parsed, effectiveRealtime, refetch]);

  return {
    data,
    image,
    mask,
    status,
    isFetching,
    error,
    refetch,
  };
};

export const useRealtimeMaskThumbnail = (
  params: UseRealtimeMaskThumbnailParams
): {
  data: string | null;
  status: HookStatus;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<MaskThumbnailResult>;
} => {
  const { maskUri, boundaryUri, realtime = true, autoFetch = true } = params;

  const parsed = useMemo(() => {
    try {
      const boundary = parseBoundaryUri(boundaryUri);
      const mask = parseMaskUri(maskUri);

      if (boundary.docId !== mask.docId) {
        throw new Error('Mask and boundary URIs must point to the same document.');
      }

      const result: ParsedMaskHookInput = {
        docId: boundary.docId,
        boundaryUri,
        boundary: boundary.boundary,
        maskUri,
        mask,
      };

      return { value: result, error: null };
    } catch (error) {
      return { value: null, error: error as Error };
    }
  }, [boundaryUri, maskUri]);

  const [data, setData] = useState<string | null>(null);
  const [status, setStatus] = useState<HookStatus>('idle');
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(parsed.error);

  const requestIdRef = useRef(0);
  const mountedRef = useIsMountedRef();

  const refetch = useCallback(async (): Promise<MaskThumbnailResult> => {
    if (!parsed.value) {
      const parseError = parsed.error ?? new Error('Invalid hook parameters.');
      setError(parseError);
      setStatus('error');
      return Promise.reject(parseError);
    }

    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setIsFetching(true);
    setError(null);

    try {
      const result = await fetchMaskThumbnail(parsed.value.boundaryUri, parsed.value.maskUri);

      if (mountedRef.current && requestIdRef.current === requestId) {
        setData(result.mask);
        setStatus('success');
        setIsFetching(false);
      }

      return result;
    } catch (fetchError) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setError(fetchError as Error);
        setStatus('error');
        setIsFetching(false);
      }
      throw fetchError;
    }
  }, [parsed, mountedRef]);

  useEffect(() => {
    if (!parsed.error) {
      setError(null);
      return;
    }

    setError(parsed.error);
    setStatus('error');
  }, [parsed.error]);

  useEffect(() => {
    if (!autoFetch || parsed.error) return;

    void refetch();
  }, [autoFetch, parsed.error, refetch]);

  useEffect(() => {
    if (!realtime || !parsed.value || parsed.error) return;

    const unsubscribe = subscribeToRealtimeChanges(parsed.value.docId, [parsed.value.mask.content], () => {
      void refetch();
    });

    return () => unsubscribe();
  }, [parsed, realtime, refetch]);

  return {
    data,
    status,
    isFetching,
    error,
    refetch,
  };
};
