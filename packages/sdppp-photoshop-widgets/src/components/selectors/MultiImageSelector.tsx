import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ImageSelector } from './ImageSelector';
import { UploadIndicator } from '../shared/UploadIndicator';

type SlotUploadState = {
  status: 'idle' | 'uploading' | 'error';
  errorMessage: string | null;
  progress: { current: number; total: number };
};

interface MultiImageSelectorProps {
  widgetableId: string;
  value: string[];
  maxCount: number;
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
  showActionButtons?: boolean;
}

const ensureArray = (input: string[] | undefined): string[] => {
  if (!Array.isArray(input)) return [];
  return input.filter(item => typeof item === 'string');
};

export const MultiImageSelector: React.FC<MultiImageSelectorProps> = ({
  widgetableId,
  value,
  maxCount,
  workBoundary,
  onValueChange,
  showActionButtons = true,
}) => {
  const limit = Math.max(1, maxCount || 1);

  const propValues = useMemo(() => {
    const safeValues = ensureArray(value);
    const next = safeValues.slice(0, limit);
    while (next.length < limit) {
      next.push('');
    }
    return next;
  }, [value, limit]);

  const [localValues, setLocalValues] = useState<string[]>(propValues);

  useEffect(() => {
    setLocalValues(prev => {
      if (prev.length === propValues.length && prev.every((item, index) => item === propValues[index])) {
        return prev;
      }
      return propValues;
    });
  }, [propValues]);

  const slots = useMemo(
    () => Array.from({ length: limit }, (_, index) => index),
    [limit],
  );

  const emitValue = useCallback(
    (next: string[]) => {
      if (!onValueChange) return;
      const trimmed = next.slice(0, limit);
      let lastIndex = trimmed.length - 1;
      while (lastIndex >= 0 && !trimmed[lastIndex]) {
        trimmed.pop();
        lastIndex -= 1;
      }
      onValueChange(trimmed);
    },
    [limit, onValueChange],
  );

  const handleSlotValueChange = useCallback(
    (index: number, slotValue: string[]) => {
      const normalized = (slotValue?.[0] ?? '').trim();
      setLocalValues(prev => {
        const next = prev.slice(0, limit);
        while (next.length < limit) {
          next.push('');
        }
        if (next[index] === normalized) {
          return prev;
        }
        next[index] = normalized;
        emitValue(next);
        return next;
      });
    },
    [emitValue, limit],
  );

  const [slotStates, setSlotStates] = useState<Record<number, SlotUploadState>>({});
  const [errorDismissSignals, setErrorDismissSignals] = useState<Record<number, number>>({});

  const handleSlotUploadStateChange = useCallback((index: number, state: SlotUploadState) => {
    setSlotStates(prev => {
      const prevState = prev[index];
      if (prevState) {
        const sameStatus = prevState.status === state.status;
        const sameError = prevState.errorMessage === state.errorMessage;
        const sameProgress =
          prevState.progress?.current === state.progress?.current &&
          prevState.progress?.total === state.progress?.total;
        if (sameStatus && sameError && sameProgress) {
          return prev;
        }
      } else if (
        state.status === 'idle' &&
        !state.errorMessage &&
        (state.progress?.current ?? 0) === 0 &&
        (state.progress?.total ?? 0) === 0
      ) {
        return prev;
      }
      const next = { ...prev };
      if (
        state.status === 'idle' &&
        !state.errorMessage &&
        (state.progress?.current ?? 0) === 0
      ) {
        delete next[index];
      } else {
        next[index] = state;
      }
      return next;
    });
  }, []);

  const aggregatedState = useMemo(() => {
    let status: 'idle' | 'uploading' | 'error' = 'idle';
    let errorMessage: string | null = null;
    let progressCurrent = 0;
    let progressTotal = 0;

    slots.forEach(index => {
      const state = slotStates[index];
      if (!state) return;
      if (state.status === 'error' && status !== 'error') {
        status = 'error';
        errorMessage = state.errorMessage ?? null;
      }
      if (state.status === 'uploading' && status !== 'error') {
        status = 'uploading';
        progressCurrent += state.progress?.current ?? 0;
        progressTotal += state.progress?.total ?? 0;
      }
    });

    if (status !== 'uploading') {
      progressCurrent = 0;
      progressTotal = 0;
    }

    return {
      status,
      errorMessage,
      progress: {
        current: progressCurrent,
        total: progressTotal,
      },
    };
  }, [slotStates, slots]);

  const handleAggregatedDismiss = useCallback(() => {
    setErrorDismissSignals(prev => {
      const next = { ...prev };
      slots.forEach(index => {
        if (slotStates[index]?.status === 'error') {
          next[index] = (next[index] ?? 0) + 1;
        }
      });
      return next;
    });
  }, [slotStates, slots]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {slots.map(index => {
        const slotValue = localValues[index] ?? '';
        return (
          <ImageSelector
            key={`${widgetableId}-${index}`}
            widgetableId={`${widgetableId}-${index}`}
            value={[slotValue]}
            workBoundary={workBoundary}
            onValueChange={next => {
              handleSlotValueChange(index, next);
            }}
            showActionButtons={showActionButtons}
            defaultAuto={false}
            showUploadIndicator={false}
            externalErrorDismissSignal={errorDismissSignals[index] ?? 0}
            onUploadStateChange={state => {
              handleSlotUploadStateChange(index, state);
            }}
          />
        );
      })}
      {aggregatedState.status !== 'idle' || aggregatedState.errorMessage ? (
        <UploadIndicator
          status={aggregatedState.status}
          errorMessage={aggregatedState.errorMessage ?? undefined}
          progressCurrent={aggregatedState.progress.current}
          progressTotal={aggregatedState.progress.total}
          onDismiss={aggregatedState.errorMessage ? handleAggregatedDismiss : undefined}
          containerStyle={{
            position: 'static',
            width: '100%',
            marginTop: 4,
          }}
        />
      ) : null}
    </div>
  );
};

export default MultiImageSelector;
