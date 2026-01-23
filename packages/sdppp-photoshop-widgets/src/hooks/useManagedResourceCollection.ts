import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { ResourceHandle } from '../context/PhotoshopWidgetContext';
import { useResourceHandleManager } from '../context/PhotoshopWidgetContext';

export interface ManagedResourceCollection {
  retain: (resource?: string | null, handle?: ResourceHandle | null) => ResourceHandle | null;
  release: (resource?: string | null) => void;
  clear: () => void;
  handlesRef: MutableRefObject<Map<string, ResourceHandle>>;
}

const normalize = (resource?: string | null): string | null => {
  if (typeof resource !== 'string') return null;
  const trimmed = resource.trim();
  return trimmed.length ? trimmed : null;
};

export const useManagedResourceCollection = (): ManagedResourceCollection => {
  const resourceHandles = useResourceHandleManager();
  const handlesRef = useRef<Map<string, ResourceHandle>>(new Map());

  const clear = useCallback(() => {
    const map = handlesRef.current;
    for (const handle of map.values()) {
      try {
        handle.dispose();
      } catch {
        // ignore dispose failure
      }
    }
    map.clear();
  }, []);

  const release = useCallback((resource?: string | null) => {
    const normalized = normalize(resource);
    if (!normalized) return;
    const map = handlesRef.current;
    const existing = map.get(normalized);
    if (existing) {
      try {
        existing.dispose();
      } catch {
        // ignore dispose failure
      }
      map.delete(normalized);
    }
  }, []);

  const retain = useCallback(
    (resource?: string | null, incomingHandle?: ResourceHandle | null): ResourceHandle | null => {
      const normalized = normalize(resource);
      if (!normalized) {
        return null;
      }

      const map = handlesRef.current;
      const existing = map.get(normalized);
      if (existing && (!incomingHandle || existing === incomingHandle)) {
        return existing;
      }

      if (existing && existing !== incomingHandle) {
        try {
          existing.dispose();
        } catch {
          // ignore dispose failure
        }
      }

      let nextHandle = incomingHandle ?? null;
      if (!nextHandle) {
        nextHandle = resourceHandles.acquire(normalized);
      }

      if (nextHandle) {
        map.set(normalized, nextHandle);
      } else {
        map.delete(normalized);
      }

      return nextHandle ?? null;
    },
    [resourceHandles],
  );

  useEffect(
    () => () => {
      clear();
    },
    [clear],
  );

  return {
    retain,
    release,
    clear,
    handlesRef,
  };
};

export default useManagedResourceCollection;
