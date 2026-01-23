import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import { sdpppSDK } from '@sdppp/common';

import type { ResourceHandle } from '../context/PhotoshopWidgetContext';
import { useResourceHandleManager } from '../context/PhotoshopWidgetContext';

export interface ManagedResourceHandle {
  handleRef: MutableRefObject<ResourceHandle | null>;
  resourceRef: MutableRefObject<string | null>;
  setResource: (resource?: string | null, handle?: ResourceHandle | null) => void;
  clear: () => void;
}

const normalizeResourceId = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const useManagedResourceHandle = (): ManagedResourceHandle => {
  const resourceHandles = useResourceHandleManager();
  const handleRef = useRef<ResourceHandle | null>(null);
  const resourceRef = useRef<string | null>(null);
  const managedHandleLogger =
    typeof sdpppSDK?.logger?.extend === 'function'
      ? sdpppSDK.logger.extend('widgets:resource-handle')
      : null;

  const ensureHandleResourceId = (
    handle: ResourceHandle | null,
    resourceId: string | null
  ): ResourceHandle | null => {
    if (!handle || !resourceId) {
      return handle;
    }

    const existingId = typeof handle.resourceId === 'string' ? handle.resourceId.trim() : '';
    if (existingId) {
      return handle;
    }

    try {
      (handle as unknown as { resourceId: string }).resourceId = resourceId;
      const patchedId =
        typeof handle.resourceId === 'string' ? handle.resourceId.trim() : '';
      if (patchedId) {
        return handle;
      }
    } catch {
      // fall through to proxy creation
    }

    const underlying = handle;
    return {
      get resourceId() {
        return resourceId;
      },
      retain() {
        underlying.retain();
        return this;
      },
      release() {
        underlying.release();
      },
      dispose() {
        underlying.dispose();
      },
    };
  };

  const clear = useCallback(() => {
    if (handleRef.current) {
      try {
        handleRef.current.dispose();
      } catch {
        // ignore disposal failure
      }
      handleRef.current = null;
    }
    resourceRef.current = null;
  }, []);

  const setResource = useCallback(
    (resource?: string | null, incomingHandle?: ResourceHandle | null) => {
      const normalized = normalizeResourceId(resource);
      if (!normalized) {
        clear();
        return;
      }

      let nextHandle: ResourceHandle | null = incomingHandle ?? null;
      if (!nextHandle) {
        nextHandle = resourceHandles.acquire(normalized);
        if (!nextHandle) {
          managedHandleLogger?.('failed to acquire handle for resource', { resource: normalized });
        }
      }

      const normalizedHandle = ensureHandleResourceId(nextHandle, normalized);

      if (
        resourceRef.current === normalized &&
        handleRef.current === normalizedHandle
      ) {
        return;
      }

      if (handleRef.current && handleRef.current !== normalizedHandle) {
        try {
          handleRef.current.dispose();
        } catch {
          // ignore disposal failure
        }
      }

      if (normalizedHandle && !(normalizedHandle.resourceId ?? '').trim()) {
        managedHandleLogger?.('handle lacks resourceId after normalization', {
          resource: normalized,
        });
      }

      handleRef.current = normalizedHandle ?? null;
      resourceRef.current = normalized;
    },
    [clear, resourceHandles],
  );

  useEffect(
    () => () => {
      clear();
    },
    [clear],
  );

  return {
    handleRef,
    resourceRef,
    setResource,
    clear,
  };
};

export default useManagedResourceHandle;
