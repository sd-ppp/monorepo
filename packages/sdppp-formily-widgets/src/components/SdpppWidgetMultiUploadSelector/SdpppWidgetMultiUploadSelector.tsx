import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SdpppWidgetUploadSelectorRouter } from '../SdpppWidgetUploadSelector/SdpppWidgetUploadSelectorRouter';
import type { DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';
import { MultiSlotActions } from './MultiSlotActions';
import { UploadIndicator } from '../shared/UploadIndicator';
import type {
  SdpppWidgetMultiUploadSelectorProps,
  SlotConfig,
  SlotUploadState,
  AggregatedUploadState,
} from './types';

/**
 * 确保输入为数组
 */
const ensureArray = (input: (string | DeferredUploadValue)[] | undefined): (string | DeferredUploadValue)[] => {
  if (!Array.isArray(input)) return [];
  return input;
};

/**
 * 从值中提取字符串（用于判断是否为空）
 */
const extractStringValue = (value: string | DeferredUploadValue | null): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  // DeferredUploadValue 类型
  return value.previewUrl || value.resourceId || value.contentUri || '';
};

/**
 * 多图上传选择器组件
 * 
 * @remarks
 * 此组件可以包装 nomask 或 deferred 变体的上传选择器，
 * 管理多个 slot（插槽），支持动态添加/删除，
 * 并聚合所有 slot 的上传状态。
 * 
 * @example
 * ```tsx
 * // Deferred 模式（默认）
 * <SdpppWidgetMultiUploadSelector
 *   variant="deferred"
 *   maxCount={3}
 *   workBoundary="uxp://boundary/0/canvas"
 *   sourceHints={{ content: 'canvas', boundary: 'selection' }}
 *   value={deferredValues}
 *   onChange={setDeferredValues}
 * />
 * 
 * // Nomask 模式（立即上传）
 * <SdpppWidgetMultiUploadSelector
 *   variant="nomask"
 *   maxCount={5}
 *   workBoundary="uxp://boundary/0/canvas"
 *   value={urlArray}
 *   onChange={setUrlArray}
 * />
 * ```
 */
export const SdpppWidgetMultiUploadSelector: React.FC<SdpppWidgetMultiUploadSelectorProps> = ({
  widgetableId = 'sdppp-multi-upload',
  variant = 'deferred',
  value,
  maxCount,
  workBoundary,
  sourceHints,
  label,
  showActionButtons = true,
  onChange,
  onValueChange,
  onUploadStateChange,
  externalErrorDismissSignal,
}) => {
  const limit = Math.max(1, maxCount || 1);

  // 规范化输入值
  const normalizedValue = useMemo(() => {
    const safeValues = ensureArray(value).slice(0, limit);
    return safeValues;
  }, [limit, value]);

  // 初始化 slots（从 0 开始，如果有值则显示对应数量的 slot）
  const initialSlots = useMemo((): SlotConfig[] => {
    const count = Math.min(limit, normalizedValue.length || 0);
    // 如果没有值，返回空数组（0 个 slot）
    if (count === 0) return [];
    return Array.from({ length: count }, (_, index) => ({
      key: uuidv4(),
      index,
      value: normalizedValue[index] ?? null,
    }));
  }, [limit, normalizedValue]);

  const [slots, setSlots] = useState<SlotConfig[]>(initialSlots);

  // 跟踪每个 slot 的上传状态
  const [slotStates, setSlotStates] = useState<Record<string, SlotUploadState>>({});

  // 错误消除信号（传递给子组件）
  const [errorDismissSignals, setErrorDismissSignals] = useState<Record<string, number>>({});

  // 同步外部 value 变化到 slots
  useEffect(() => {
    setSlots(prev => {
      // 🎯 允许 0 个 slot（移除了强制至少1个的限制）
      const desiredCount = Math.min(limit, Math.max(prev.length, normalizedValue.length));
      const next = Array.from({ length: desiredCount }, (_, index) => {
        // 保留现有 slot 的 key，只更新 value
        if (index < prev.length) {
          return {
            ...prev[index],
            index,
            value: index < normalizedValue.length ? normalizedValue[index] : null,
          };
        }
        // 新增 slot
        return {
          key: uuidv4(),
          index,
          value: index < normalizedValue.length ? normalizedValue[index] : null,
        };
      });

      // 检查是否有实际变化
      if (next.length === prev.length && next.every((item, idx) => item.key === prev[idx].key)) {
        return prev;
      }

      return next;
    });
  }, [limit, normalizedValue]);

  // 发送值变化事件
  const emitValue = useCallback(
    (nextSlots: SlotConfig[]) => {
      // 过滤掉空值，只保留有内容的 slot
      const values = nextSlots
        .map(slot => slot.value)
        .filter(v => {
          const str = extractStringValue(v);
          return str.length > 0;
        });

      // 如果所有值都为空，返回空数组
      const result = values.length > 0 ? values : [];

      onValueChange?.(result as any);
      onChange?.(result as any);
    },
    [onChange, onValueChange],
  );

  // 处理单个 slot 的值变化
  const handleSlotValueChange = useCallback(
    (slotKey: string, slotValue: string[] | DeferredUploadValue | null) => {
      setSlots(prev => {
        const slotIndex = prev.findIndex(s => s.key === slotKey);
        if (slotIndex === -1) return prev;

        const next = prev.slice();
        let normalizedValue: string | DeferredUploadValue | null = null;

        if (Array.isArray(slotValue)) {
          // nomask 模式返回 string[]
          normalizedValue = slotValue[0] ?? null;
        } else {
          // deferred 模式返回 DeferredUploadValue
          normalizedValue = slotValue;
        }

        next[slotIndex] = {
          ...next[slotIndex],
          value: normalizedValue,
        };

        emitValue(next);
        return next;
      });
    },
    [emitValue],
  );

  // 处理单个 slot 的状态变化
  const handleSlotUploadStateChange = useCallback((slotKey: string, state: SlotUploadState) => {
    setSlotStates(prev => {
      const prevState = prev[slotKey];

      // 优化：如果状态没有变化，不更新
      if (prevState) {
        const sameStatus = prevState.status === state.status;
        const sameError = prevState.errorMessage === state.errorMessage;
        const sameProgress =
          prevState.progress?.current === state.progress?.current &&
          prevState.progress?.total === state.progress?.total;
        if (sameStatus && sameError && sameProgress) {
          return prev;
        }
      }

      const next = { ...prev };

      // 如果状态恢复到 idle 且无错误，移除记录
      if (state.status === 'idle' && !state.errorMessage && state.progress.current === 0) {
        delete next[slotKey];
      } else {
        next[slotKey] = state;
      }

      return next;
    });
  }, []);

  // 添加新 slot
  const handleAddSlot = useCallback(() => {
    setSlots(prev => {
      if (prev.length >= limit) return prev;

      const next = [
        ...prev,
        {
          key: uuidv4(),
          index: prev.length,
          value: null,
        },
      ];

      return next;
    });
  }, [limit]);

  // 删除最后一个 slot
  const handleRemoveLastSlot = useCallback(() => {
    setSlots(prev => {
      if (prev.length === 0) {
        return prev;
      }
      
      // 删除最后一个，即使只剩一个也删除（变成空数组）
      const next = prev.slice(0, prev.length - 1);
      emitValue(next);
      return next;
    });
  }, [emitValue]);

  // 清理已删除 slot 的状态
  useEffect(() => {
    setSlotStates(prev => {
      const validKeys = new Set(slots.map(s => s.key));
      const next: Record<string, SlotUploadState> = {};

      Object.entries(prev).forEach(([key, state]) => {
        if (validKeys.has(key)) {
          next[key] = state;
        }
      });

      if (Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }

      return next;
    });
  }, [slots]);

  // 清理已删除 slot 的错误消除信号
  useEffect(() => {
    setErrorDismissSignals(prev => {
      const validKeys = new Set(slots.map(s => s.key));
      const next: Record<string, number> = {};

      Object.entries(prev).forEach(([key, signal]) => {
        if (validKeys.has(key)) {
          next[key] = signal;
        }
      });

      if (Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }

      return next;
    });
  }, [slots]);

  // 聚合所有 slot 的状态
  const aggregatedState = useMemo((): AggregatedUploadState => {
    let status: 'idle' | 'uploading' | 'generating' | 'error' = 'idle';
    let errorMessage: string | null = null;
    let progressCurrent = 0;
    let progressTotal = 0;

    slots.forEach(slot => {
      const state = slotStates[slot.key];
      if (!state) return;

      // 错误优先级最高
      if (state.status === 'error') {
        status = 'error';
        errorMessage = state.errorMessage ?? null;
      }

      // 如果没有错误，检查是否在上传/生成中
      if (status !== 'error') {
        if (state.status === 'uploading' || state.status === 'generating') {
          status = state.status;
          progressCurrent += state.progress?.current ?? 0;
          progressTotal += state.progress?.total ?? 0;
        }
      }
    });

    // 如果不在上传/生成中，清零进度
    if (status === 'idle' || status === 'error') {
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

  // 通知外部聚合状态变化
  useEffect(() => {
    onUploadStateChange?.(aggregatedState);
  }, [aggregatedState, onUploadStateChange]);

  // 处理聚合错误的消除
  const handleAggregatedDismiss = useCallback(() => {
    setErrorDismissSignals(prev => {
      const next = { ...prev };
      slots.forEach(slot => {
        if (slotStates[slot.key]?.status === 'error') {
          next[slot.key] = (next[slot.key] ?? 0) + 1;
        }
      });
      return next;
    });
  }, [slotStates, slots]);

  const canAddSlot = slots.length < limit;
  const canRemoveSlot = slots.length > 0;  // 有 slot 就可以删除

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
      }}
    >
      {slots.map(slot => {
        // 根据 variant 准备不同的 value
        const slotValue = variant === 'nomask'
          ? (slot.value ? [slot.value as string] : [])
          : (slot.value as DeferredUploadValue | null) ?? undefined;

        const routerProps: any = {
          key: slot.key,
          widgetableId: `${widgetableId}-${slot.key}`,
          variant,
          workBoundary,
          sourceHints,
          label,
          showActionButtons,
          value: slotValue,
          onChange: (newValue: string[] | DeferredUploadValue) => {
            handleSlotValueChange(slot.key, newValue);
          },
          onValueChange: (newValue: string[] | DeferredUploadValue) => {
            handleSlotValueChange(slot.key, newValue);
          },
          onUploadStateChange: (state: any) => {
            handleSlotUploadStateChange(slot.key, state);
          },
          externalErrorDismissSignal: errorDismissSignals[slot.key] ?? 0,
        };

        return <SdpppWidgetUploadSelectorRouter {...routerProps} />;
      })}

      {/* +/- 按钮（仅在 maxCount > 1 时显示） */}
      {limit > 1 && (
        <MultiSlotActions
          canAdd={canAddSlot}
          canRemove={canRemoveSlot}
          onAdd={handleAddSlot}
          onRemove={handleRemoveLastSlot}
        />
      )}

      {/* 聚合状态指示器 */}
      {(aggregatedState.status !== 'idle' || aggregatedState.errorMessage) && (
        <UploadIndicator
          status={aggregatedState.status}
          errorMessage={aggregatedState.errorMessage ?? undefined}
          progressCurrent={aggregatedState.progress.current}
          progressTotal={aggregatedState.progress.total}
          onDismiss={aggregatedState.errorMessage ? handleAggregatedDismiss : undefined}
        />
      )}
    </div>
  );
};

SdpppWidgetMultiUploadSelector.displayName = 'SdpppWidgetMultiUploadSelector';
