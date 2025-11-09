import { useCallback, useMemo, useRef, useState } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type {
  WidgetImageMaskActions,
  WidgetImageMaskLogger,
} from '../../../src/context/WidgetImageMaskContext';
import { createMockActions, MIN_SELECTION_EDGE, roundRect } from './action-factory';
import { MockResourceStore } from './resource-store';
import type { MockRealtimeContent, SelectionRect } from './types';

export interface ProvideResult {
  actions: WidgetImageMaskActions;
  resourceStore: MockResourceStore;
  contextValue: {
    stageRef: React.MutableRefObject<KonvaStage | null>;
    selectionRect: SelectionRect | null;
    updateSelectionRect: (rect: SelectionRect | null) => void;
    subscribeToRealtimeChanges: (
      docId: number,
      contents: MockRealtimeContent[],
      callback: () => void
    ) => () => void;
    notifyContentChange: (content: MockRealtimeContent) => void;
  };
}

export const useProvideMockExternalApi = (logger: WidgetImageMaskLogger): ProvideResult => {
  const stageRef = useRef<KonvaStage | null>(null);
  const resourceStore = useMemo(() => new MockResourceStore(), []);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const selectionRef = useRef<SelectionRect | null>(null);
  const subscribersRef = useRef(
    new Map<number, { docId: number; contents: Set<MockRealtimeContent>; callback: () => void }>()
  );
  const nextSubscriberId = useRef(1);

  const scheduleCallback = useCallback((cb: () => void) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => cb());
    } else {
      cb();
    }
  }, []);

  const notifySubscribers = useCallback(
    (content: MockRealtimeContent) => {
      subscribersRef.current.forEach(({ docId, contents, callback }) => {
        if (docId !== 0) return;
        if (contents.has(content)) {
          scheduleCallback(callback);
        }
      });
    },
    [scheduleCallback]
  );

  const subscribeToRealtimeChanges = useCallback(
    (docId: number, contents: MockRealtimeContent[], callback: () => void) => {
      if (!contents.length) return () => undefined;
      const id = nextSubscriberId.current++;
      subscribersRef.current.set(id, {
        docId,
        contents: new Set(contents),
        callback,
      });
      scheduleCallback(callback);
      return () => subscribersRef.current.delete(id);
    },
    [scheduleCallback]
  );

  const updateSelectionRect = useCallback(
    (rect: SelectionRect | null) => {
      if (rect && (rect.width < MIN_SELECTION_EDGE || rect.height < MIN_SELECTION_EDGE)) {
        selectionRef.current = null;
        setSelectionRect(null);
        notifySubscribers('selection');
        notifySubscribers('curlayer');
        return;
      }
      const rounded = rect ? roundRect(rect) : null;
      selectionRef.current = rounded;
      setSelectionRect(rounded);
      notifySubscribers('selection');
      notifySubscribers('curlayer');
    },
    [notifySubscribers]
  );

  const actions = useMemo<WidgetImageMaskActions>(
    () =>
      createMockActions({
        stageRef,
        selectionRef,
        resourceStore,
        logger,
      }),
    [logger, resourceStore]
  );

  return {
    actions,
    resourceStore,
    contextValue: {
      stageRef,
      selectionRect,
      updateSelectionRect,
      subscribeToRealtimeChanges,
      notifyContentChange: notifySubscribers,
    },
  };
};

