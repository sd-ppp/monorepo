import { Button, Tooltip } from 'antd';
import { Minus, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useWidgetText } from '../../context/PhotoshopWidgetContext';
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
  const t = useWidgetText();
  const limit = Math.max(1, maxCount || 1);

  const normalizedValue = useMemo(() => {
    const safeValues = ensureArray(value).slice(0, limit);
    return safeValues.map(item => (typeof item === 'string' ? item : ''));
  }, [limit, value]);

  const initialValues = useMemo(() => {
    const count = Math.min(limit, Math.max(1, normalizedValue.length || 0));
    return Array.from({ length: count }, (_, index) => normalizedValue[index] ?? '');
  }, [limit, normalizedValue]);

  const [localValues, setLocalValues] = useState<string[]>(initialValues);

  useEffect(() => {
    setLocalValues(prev => {
      const desiredCount = Math.min(limit, Math.max(prev.length, normalizedValue.length, 1));
      const next = Array.from({ length: desiredCount }, (_, index) => {
        if (index < normalizedValue.length) {
          return normalizedValue[index] ?? '';
        }
        return prev[index] ?? '';
      });
      if (next.length === prev.length && next.every((item, index) => item === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [limit, normalizedValue]);

  const slots = useMemo(
    () => Array.from({ length: localValues.length }, (_, index) => index),
    [localValues.length],
  );

  const emitValue = useCallback(
    (next: string[], activeCount?: number) => {
      const count = Math.min(limit, Math.max(0, activeCount ?? next.length));
      const trimmed = next.slice(0, count);
      let lastIndex = trimmed.length - 1;
      while (lastIndex >= 0 && !trimmed[lastIndex]) {
        trimmed.pop();
        lastIndex -= 1;
      }
      if (onValueChange) {
        onValueChange(trimmed);
      }
    },
    [limit, onValueChange],
  );

  const handleSlotValueChange = useCallback(
    (index: number, slotValue: string[]) => {
      const normalized = (slotValue?.[0] ?? '').trim();
      setLocalValues(prev => {
        if (index < 0 || index >= prev.length) {
          return prev;
        }
        const next = prev.slice();
        if (next[index] === normalized) {
          return prev;
        }
        next[index] = normalized;
        emitValue(next, next.length);
        return next;
      });
    },
    [emitValue],
  );

  const [slotStates, setSlotStates] = useState<Record<number, SlotUploadState>>({});
  const [errorDismissSignals, setErrorDismissSignals] = useState<Record<number, number>>({});

  const handleAddSlot = useCallback(() => {
    setLocalValues(prev => {
      if (prev.length >= limit) {
        return prev;
      }
      const next = [...prev, ''];
      return next;
    });
  }, [limit]);

  const handleRemoveLastSlot = useCallback(() => {
    setLocalValues(prev => {
      if (prev.length <= 1) {
        const next = [''];
        emitValue(next, 1);
        return next;
      }
      const next = prev.slice(0, prev.length - 1);
      emitValue(next, next.length);
      return next;
    });
  }, [emitValue]);

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

  useEffect(() => {
    setSlotStates(prev => {
      if (!Object.keys(prev).length) {
        return prev;
      }
      const next: Record<number, SlotUploadState> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const idx = Number(key);
        if (idx < localValues.length) {
          next[idx] = value;
        }
      });
      if (Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [localValues.length]);

  useEffect(() => {
    setErrorDismissSignals(prev => {
      if (!Object.keys(prev).length) {
        return prev;
      }
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const idx = Number(key);
        if (idx < localValues.length) {
          next[idx] = value;
        }
      });
      if (Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [localValues.length]);

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

  const canAddSlot = localValues.length < limit;
  const canRemoveSlot = localValues.length > 1;
  const addSlotLabel = t('image.upload.add_slot', { defaultValue: 'Add Slot' });
  const removeSlotLabel = t('image.upload.remove_slot', { defaultValue: 'Remove Slot' });
  const removeLastTooltip = t('image.upload.remove_last_slot.tooltip', {
    defaultValue: 'Remove last slot',
  });

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
      {limit > 1 ? (
        <div
          style={{
            display: 'flex',
            width: '100%',
            gap: 8,
          }}
        >
          <Button
            type="dashed"
            icon={<Plus size={16} strokeWidth={2} />}
            disabled={!canAddSlot}
            onClick={handleAddSlot}
            aria-label={addSlotLabel}
            style={{ flex: 1, height: 40 }}
          />
          <Tooltip title={removeLastTooltip}>
            <div style={{ flex: 1, height: 40 }}>
              <Button
                type="default"
                icon={<Minus size={16} strokeWidth={2} />}
                disabled={!canRemoveSlot}
                onClick={handleRemoveLastSlot}
                aria-label={removeSlotLabel}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </Tooltip>
        </div>
      ) : null}
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
