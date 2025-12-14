import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { sdpppSDK } from '@sdppp/common';
import type { ResourceHandle } from '../../../../context/PhotoshopWidgetContext';
import { useManagedResourceHandle } from '../../../../hooks/useManagedResourceHandle';
import { resolveDocContext } from '../../../../utils/docContext';

export interface DocScopedUriSnapshot {
  contentUri: string;
  maskUri: string;
  boundaryUri: string;
  didUpdate: boolean;
}

export interface ImageResourceState {
  diskFileUri: string;
  setDiskFileResource: (resource: string, handle?: ResourceHandle | null) => void;
  contentUri: string;
  setContentUri: Dispatch<SetStateAction<string>>;
  setPreparedContentResource: (resource: string, handle?: ResourceHandle | null) => void;
  boundaryUri: string;
  setBoundaryUri: Dispatch<SetStateAction<string>>;
  maskUri: string;
  setMaskResource: (resource: string, handle?: ResourceHandle | null) => void;
  setResultSnapshotResource: (resource: string, handle?: ResourceHandle | null) => void;
  clearResultSnapshot: () => void;
  resultSnapshotUri: string;
  isInitialState: boolean;
  setIsInitialState: Dispatch<SetStateAction<boolean>>;
  curDocId: number;
  diskFileHandleRef: MutableRefObject<ResourceHandle | null>;
  contentHandleRef: MutableRefObject<ResourceHandle | null>;
  maskHandleRef: MutableRefObject<ResourceHandle | null>;
  maskHandleResourceRef: MutableRefObject<string | null>;
  syncDocScopedUrisIfNeeded: () => DocScopedUriSnapshot;
}

export const useImageResourceState = ({
  workBoundary,
}: {
  workBoundary: string | undefined;
}): ImageResourceState => {
  const docSyncLogger =
    typeof sdpppSDK?.logger?.extend === 'function'
      ? sdpppSDK.logger.extend('widgets:image-resource-sync')
      : null;
  const {
    docId: curDocId,
    canvasContentUri: canvasContentFallback,
    canvasBoundaryUri,
  } = useMemo(() => resolveDocContext(workBoundary), [workBoundary]);

  const defaultContentUri = canvasContentFallback;

  const [diskFileUri, setDiskFileUriState] = useState<string>('');
  const [boundaryUri, setBoundaryUriState] = useState<string>((workBoundary ?? '').trim());
  const [maskUri, setMaskUriState] = useState<string>('');
  const [contentUriState, setContentUriState] = useState<string>(defaultContentUri);
  const [resultSnapshotUri, setResultSnapshotUri] = useState<string>('');
  const [isInitialState, setIsInitialState] = useState<boolean>(true);

  const {
    handleRef: diskFileHandleRef,
    setResource: assignDiskFileHandle,
    clear: clearDiskFileHandle,
  } = useManagedResourceHandle();
  const {
    handleRef: contentHandleRef,
    setResource: assignContentHandle,
    clear: clearContentHandle,
  } = useManagedResourceHandle();
  const {
    handleRef: maskHandleRef,
    resourceRef: maskHandleResourceRef,
    setResource: assignMaskHandle,
    clear: clearMaskHandle,
  } = useManagedResourceHandle();
  const { setResource: assignResultHandle, clear: clearResultHandle } = useManagedResourceHandle();

  const setDiskFileResource = useCallback(
    (resource: string, handle?: ResourceHandle | null) => {
      const sanitized = (resource ?? '').trim();
      setDiskFileUriState(sanitized);
      assignDiskFileHandle(sanitized, handle ?? null);
    },
    [assignDiskFileHandle],
  );

  const setPreparedContentResource = useCallback(
    (resource: string, handle?: ResourceHandle | null) => {
      const sanitized = (resource ?? '').trim();
      if (sanitized.startsWith('uxp://file/')) {
        assignContentHandle(sanitized, handle ?? null);
      } else {
        assignContentHandle('', null);
      }
    },
    [assignContentHandle],
  );

  const setResultSnapshotResource = useCallback(
    (resource: string, handle?: ResourceHandle | null) => {
      const sanitized = (resource ?? '').trim();
      setResultSnapshotUri(sanitized);
      assignResultHandle(sanitized, handle ?? null);
    },
    [assignResultHandle],
  );

  const clearResultSnapshot = useCallback(() => {
    setResultSnapshotUri('');
    clearResultHandle();
  }, [clearResultHandle]);

  const setMaskResource = useCallback(
    (resource: string, handle?: ResourceHandle | null) => {
      const sanitized = (resource ?? '').trim();
      setMaskUriState(sanitized);
      if (sanitized.startsWith('uxp://file/')) {
        assignMaskHandle(sanitized, handle ?? null);
      } else {
        assignMaskHandle('', null);
      }
    },
    [assignMaskHandle],
  );

  const setBoundaryUri = useCallback(
    (next: SetStateAction<string>) => {
      setBoundaryUriState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        return (resolved ?? '').trim();
      });
    },
    [],
  );

  const normalizeContentUri = useCallback(
    (value?: string) => {
      const trimmed = (value ?? '').trim();
      return trimmed || defaultContentUri;
    },
    [defaultContentUri],
  );

  const setContentUri = useCallback(
    (next: SetStateAction<string>) => {
      setContentUriState((prev) => {
        const rawNext = typeof next === 'function' ? (next as (prev: string) => string)(prev) : next;
        return normalizeContentUri(rawNext);
      });
    },
    [normalizeContentUri],
  );

  const contentUri = useMemo(
    () => normalizeContentUri(contentUriState),
    [contentUriState, normalizeContentUri],
  );

  const rewriteDocScopedUri = useCallback(
    (uri: string, scheme: 'content' | 'mask'): string => {
      const normalized = (uri ?? '').trim();
      if (!normalized) {
        return scheme === 'content' ? defaultContentUri : '';
      }
      const pattern = new RegExp(`^uxp://${scheme}/\\d+/(.+)$`);
      const match = pattern.exec(normalized);
      if (match?.[1]) {
        return `uxp://${scheme}/${curDocId}/${match[1]}`;
      }
      return normalized;
    },
    [curDocId, defaultContentUri],
  );

  const parseDocIdFromScopedUri = useCallback((uri: string | undefined, scope: 'content' | 'mask' | 'boundary'): number | null => {
    const normalized = (uri ?? '').trim();
    if (!normalized) {
      return null;
    }
    let pattern: RegExp;
    if (scope === 'boundary') {
      pattern = /^uxp:\/\/boundary\/(\d+)(?:\/|$)/;
    } else {
      pattern = new RegExp(`^uxp://${scope}/(\\d+)/(?:.+)$`);
    }
    const match = pattern.exec(normalized);
    if (!match?.[1]) {
      return null;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }, []);

  const syncDocScopedUrisIfNeeded = useCallback((): DocScopedUriSnapshot => {
    const targetDocId = Number.isFinite(curDocId) && curDocId > 0 ? Math.trunc(curDocId) : 0;
    const normalizedContent = normalizeContentUri(contentUriState);
    const normalizedMask = (maskUri ?? '').trim();
    const normalizedBoundary = (boundaryUri ?? '').trim();
    const fallbackBoundary =
      (workBoundary ?? '').trim() || (canvasBoundaryUri ?? '').trim();

    let nextContentState = contentUriState;
    let nextMaskState = maskUri;
    let nextBoundaryState = boundaryUri;
    let didUpdate = false;

    const contentDocId = parseDocIdFromScopedUri(normalizedContent, 'content');
    if (contentDocId !== null && contentDocId !== targetDocId) {
      const rewritten = rewriteDocScopedUri(contentUriState, 'content');
      if (rewritten !== contentUriState) {
        nextContentState = rewritten;
        docSyncLogger?.('clearing content handle before doc-sync rewrite', {
          resetHandle: contentHandleRef
        });
        setContentUriState(rewritten);
        clearContentHandle();
        docSyncLogger?.('cleared content handle after doc-sync rewrite', {
          resetHandle: contentHandleRef
        });
        didUpdate = true;
      }
      nextMaskState = '';
      setMaskUriState('');
      clearMaskHandle();
      docSyncLogger?.('cleared mask handle after doc-sync rewrite', {
        maskHandleRef: maskHandleRef
      });
      didUpdate = true;
    }

    const boundaryDocId = parseDocIdFromScopedUri(normalizedBoundary, 'boundary');
    if (boundaryDocId !== null && boundaryDocId !== targetDocId) {
      const replacement = fallbackBoundary || normalizedBoundary;
      if (replacement !== boundaryUri) {
        nextBoundaryState = replacement;
        setBoundaryUri(replacement);
      }
      didUpdate = true;
    }

    return {
      didUpdate,
      contentUri: normalizeContentUri(nextContentState),
      maskUri: (nextMaskState ?? '').trim(),
      boundaryUri: (nextBoundaryState ?? '').trim(),
    };
  }, [
    boundaryUri,
    canvasBoundaryUri,
    contentUriState,
    curDocId,
    maskUri,
    normalizeContentUri,
    parseDocIdFromScopedUri,
    rewriteDocScopedUri,
    setBoundaryUri,
    setContentUriState,
    setMaskUriState,
    clearContentHandle,
    clearMaskHandle,
  ]);


  useEffect(() => {
    const normalizedWorkBoundary = (workBoundary ?? '').trim();
    setBoundaryUri((prev) => (prev || normalizedWorkBoundary ? prev : normalizedWorkBoundary));
  }, [setBoundaryUri, workBoundary]);

  useEffect(
    () => () => {
      clearDiskFileHandle();
      clearContentHandle();
      clearResultHandle();
    },
    [clearContentHandle, clearDiskFileHandle, clearResultHandle],
  );

  useEffect(() => {
    setContentUriState((prev) => normalizeContentUri(prev));
  }, [normalizeContentUri]);

  return {
    diskFileUri,
    setDiskFileResource,
    contentUri,
    setContentUri,
    boundaryUri,
    setBoundaryUri,
    maskUri,
    setMaskResource,
    setPreparedContentResource,
    resultSnapshotUri,
    setResultSnapshotResource,
    clearResultSnapshot,
    isInitialState,
    setIsInitialState,
    curDocId,
    diskFileHandleRef,
    contentHandleRef,
    maskHandleRef,
    maskHandleResourceRef,
    syncDocScopedUrisIfNeeded,
  };
};
