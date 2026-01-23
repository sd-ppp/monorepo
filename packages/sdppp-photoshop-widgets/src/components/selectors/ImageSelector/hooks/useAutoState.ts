import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ImageSelectorProps } from '../types';
import type { useWidgetRenderMeta } from '@sdppp/widgetable-ui';

export interface AutoState {
  resolvedDefaultAuto: boolean;
  initialValueUri: string;
  auto: boolean;
  setAutoState: Dispatch<SetStateAction<boolean>>;
  applyAuto: (next: boolean, options?: { manual?: boolean }) => void;
  autoRef: MutableRefObject<boolean>;
  hasManualAutoChangeRef: MutableRefObject<boolean>;
  pendingManualFileRef: MutableRefObject<boolean>;
  lastKnownValueRef: MutableRefObject<string>;
}

export const useAutoState = ({
  value,
  defaultAuto,
  renderMeta,
}: {
  value: ImageSelectorProps['value'];
  defaultAuto: ImageSelectorProps['defaultAuto'];
  renderMeta: ReturnType<typeof useWidgetRenderMeta>;
}): AutoState => {
  const resolvedDefaultAuto = useMemo(() => {
    return false;
  }, [defaultAuto, renderMeta]);

  const initialValueUri = useMemo(() => (value?.[0] ?? '').trim(), [value]);

  const [auto, setAutoState] = useState<boolean>(resolvedDefaultAuto);
  const autoRef = useRef<boolean>(auto);
  const hasManualAutoChangeRef = useRef<boolean>(false);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const applyAuto = useCallback(
    (next: boolean, options?: { manual?: boolean }) => {
      if (options?.manual) {
        hasManualAutoChangeRef.current = true;
      }
      autoRef.current = next;
      setAutoState(next);
    },
    [setAutoState],
  );

  useEffect(() => {
    if (hasManualAutoChangeRef.current) {
      return;
    }
    const expected = resolvedDefaultAuto;
    if (autoRef.current !== expected) {
      autoRef.current = expected;
      setAutoState(expected);
    }
  }, [resolvedDefaultAuto, setAutoState]);

  const pendingManualFileRef = useRef(false);
  const lastKnownValueRef = useRef<string>(initialValueUri);

  useEffect(() => {
    const incoming = (value?.[0] ?? '').trim();
    if (!incoming) {
      return;
    }
    if (pendingManualFileRef.current) {
      if (incoming === lastKnownValueRef.current && incoming.length > 0) {
        pendingManualFileRef.current = false;
      } else {
        return;
      }
    }
    lastKnownValueRef.current = incoming;
  }, [value]);

  return {
    resolvedDefaultAuto,
    initialValueUri,
    auto,
    setAutoState,
    applyAuto,
    autoRef,
    hasManualAutoChangeRef,
    pendingManualFileRef,
    lastKnownValueRef,
  };
};
