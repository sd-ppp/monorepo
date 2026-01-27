import React, { useMemo } from 'react';
import { SdpppWidgetUploadSelectorRouter } from '../SdpppWidgetUploadSelector/SdpppWidgetUploadSelectorRouter';
import { SdpppWidgetMultiUploadSelector } from '../SdpppWidgetMultiUploadSelector/SdpppWidgetMultiUploadSelector';
import type { DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';
import type { SdpppWidgetImageUploadSelectorProps } from './types';

/**
 * 智能图片上传选择器
 * 
 * @remarks
 * 根据 maxCount 自动选择使用单图或多图组件：
 * - maxCount === 1（默认）: 使用单图组件
 * - maxCount > 1: 使用多图组件
 * 
 * 这样用户在 Formily Schema 中不需要区分单图和多图，
 * 只需要设置 maxCount 即可。
 * 
 * @example
 * ```tsx
 * // 单图模式（默认）
 * <SdpppWidgetImageUploadSelector
 *   workBoundary="uxp://boundary/0/canvas"
 *   value={singleValue}
 *   onChange={setSingleValue}
 * />
 * 
 * // 多图模式（maxCount > 1）
 * <SdpppWidgetImageUploadSelector
 *   maxCount={5}
 *   workBoundary="uxp://boundary/0/canvas"
 *   value={multiValue}
 *   onChange={setMultiValue}
 * />
 * ```
 * 
 * @example Formily Schema
 * ```typescript
 * // 单图字段
 * {
 *   avatar: {
 *     type: 'string',
 *     'x-component': 'SdpppWidgetImageUploadSelector',
 *     'x-component-props': {
 *       variant: 'nomask',
 *       workBoundary: 'uxp://boundary/0/canvas',
 *     },
 *   },
 * }
 * 
 * // 多图字段
 * {
 *   productImages: {
 *     type: 'string',  // 不需要写 array！
 *     'x-component': 'SdpppWidgetImageUploadSelector',
 *     'x-component-props': {
 *       variant: 'nomask',
 *       maxCount: 5,  // maxCount > 1 自动切换为多图
 *       workBoundary: 'uxp://boundary/0/canvas',
 *     },
 *   },
 * }
 * ```
 */
export const SdpppWidgetImageUploadSelector: React.FC<SdpppWidgetImageUploadSelectorProps> = (props) => {
  const {
    maxCount = 1,
    value,
    onChange,
    onValueChange,
    ...restProps
  } = props;

  // 判断是否使用多图模式
  const isMultiMode = maxCount > 1;

  // 单图模式：规范化值为单个 string | DeferredUploadValue
  const singleValue = useMemo(() => {
    if (!isMultiMode) {
      if (Array.isArray(value)) {
        return value[0] ?? undefined;
      }
      return value;
    }
    return undefined;
  }, [isMultiMode, value]);

  // 多图模式：规范化值为数组
  const multiValue = useMemo(() => {
    if (isMultiMode) {
      if (Array.isArray(value)) {
        return value;
      }
      // 如果传入单个值，转换为数组
      return value ? [value] : [];
    }
    return undefined;
  }, [isMultiMode, value]);

  // 单图模式的 onChange 处理
  const handleSingleChange = (newValue: string[] | DeferredUploadValue) => {
    if (Array.isArray(newValue)) {
      // nomask 模式返回 string[]
      const url = newValue[0] ?? '';
      onChange?.(url);
      onValueChange?.(url);
    } else {
      // deferred 模式返回 DeferredUploadValue
      onChange?.(newValue);
      onValueChange?.(newValue);
    }
  };

  // 多图模式的 onChange 处理
  const handleMultiChange = (newValue: (string | DeferredUploadValue)[]) => {
    onChange?.(newValue);
    onValueChange?.(newValue);
  };

  // 单图模式：使用 SdpppWidgetUploadSelectorRouter
  if (!isMultiMode) {
    return (
      <SdpppWidgetUploadSelectorRouter
        {...restProps}
        value={singleValue as any}
        onChange={handleSingleChange as any}
        onValueChange={handleSingleChange as any}
      />
    );
  }

  // 多图模式：使用 SdpppWidgetMultiUploadSelector
  return (
    <SdpppWidgetMultiUploadSelector
      {...restProps}
      maxCount={maxCount}
      value={multiValue}
      onChange={handleMultiChange}
      onValueChange={handleMultiChange}
    />
  );
};

SdpppWidgetImageUploadSelector.displayName = 'SdpppWidgetImageUploadSelector';
