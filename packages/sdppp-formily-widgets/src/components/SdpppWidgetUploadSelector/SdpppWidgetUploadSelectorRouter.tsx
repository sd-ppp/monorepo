import React, { useMemo } from 'react';
import { SdpppWidgetDeferredUploadSelector } from '../SdpppWidgetDeferredUploadSelector/SdpppWidgetDeferredUploadSelector';
import type { SdpppWidgetDeferredUploadSelectorProps, DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';
import { SdpppWidgetUploadSelector } from './SdpppWidgetUploadSelector';
import { SdpppWidgetMultiUploadSelector } from '../SdpppWidgetMultiUploadSelector/SdpppWidgetMultiUploadSelector';
import type {
  SdpppWidgetUploadSelectorProps,
  SdpppWidgetUploadSelectorRouterProps
} from './types';
import { useWorkBoundary } from '../../context/SdpppWidgetContext';

/**
 * 智能路由组件：根据 maxCount 和 variant 自动选择上传组件
 * 
 * @remarks
 * 此组件根据两个维度进行路由：
 * 
 * **维度 1: maxCount（单图 vs 多图）**
 * - maxCount === 1（默认）: 单图模式
 * - maxCount > 1: 多图模式
 * 
 * **维度 2: variant（上传模式）**
 * - nomask: 立即上传（默认）
 * - deferred: 延迟上传
 * 
 * **路由逻辑：**
 * ```
 * maxCount === 1 + variant === 'nomask' → SdpppWidgetUploadSelector
 * maxCount === 1 + variant === 'deferred' → SdpppWidgetDeferredUploadSelector
 * maxCount > 1 + variant === 'nomask' → SdpppWidgetMultiUploadSelector (nomask)
 * maxCount > 1 + variant === 'deferred' → SdpppWidgetMultiUploadSelector (deferred)
 * ```
 * 
 * @param maxCount - 最大图片数量，默认为 1
 * @param variant - 组件变体类型，默认为 'nomask'
 * 
 * @example
 * ```tsx
 * // 单图，立即上传（nomask）
 * <SdpppWidgetUploadSelectorRouter 
 *   variant="nomask"
 *   workBoundary="uxp://boundary/0/canvas"
 *   value={[]}
 *   onChange={handleChange}
 * />
 * 
 * // 多图，立即上传（nomask）
 * <SdpppWidgetUploadSelectorRouter 
 *   variant="nomask"
 *   maxCount={5}
 *   workBoundary="uxp://boundary/0/canvas"
 *   value={[]}
 *   onChange={handleChange}
 * />
 * 
 * // 单图，延迟上传（deferred）
 * <SdpppWidgetUploadSelectorRouter 
 *   workBoundary="uxp://boundary/0/canvas"
 *   sourceHints={{ content: 'canvas', boundary: 'selection' }}
 *   onChange={handleChange}
 * />
 * 
 * // 多图，延迟上传（deferred）
 * <SdpppWidgetUploadSelectorRouter 
 *   maxCount={5}
 *   workBoundary="uxp://boundary/0/canvas"
 *   sourceHints={{ content: 'canvas', boundary: 'selection' }}
 *   onChange={handleChange}
 * />
 * ```
 * 
 * @example Formily Schema
 * ```typescript
 * // 注册组件
 * const SchemaField = createSchemaField({
 *   components: {
 *     Upload: SdpppWidgetUploadSelectorRouter,
 *   },
 * });
 * 
 * // 单图 Schema
 * {
 *   avatar: {
 *     type: 'string',
 *     'x-component': 'Upload',
 *     'x-component-props': {
 *       variant: 'nomask',
 *       workBoundary: 'uxp://boundary/0/canvas',
 *     },
 *   },
 * }
 * 
 * // 多图 Schema
 * {
 *   images: {
 *     type: 'array',
 *     'x-component': 'Upload',
 *     'x-component-props': {
 *       variant: 'nomask',
 *       maxCount: 5,
 *       workBoundary: 'uxp://boundary/0/canvas',
 *     },
 *   },
 * }
 * ```
 */
export const SdpppWidgetUploadSelectorRouter: React.FC<SdpppWidgetUploadSelectorRouterProps> = ({
  variant = 'nomask',
  maxCount = 1,
  sourceHints,
  workBoundary: workBoundaryProp,
  value,
  onChange,
  onValueChange,
  ...restProps
}) => {
  // 优先使用 Context 中的 workBoundaryUri，fallback 到 prop
  const workBoundaryFromContext = useWorkBoundary();
  const workBoundary = workBoundaryFromContext || workBoundaryProp;

  const isMultiMode = maxCount > 1;

  if (isMultiMode) {
    // 多图模式：规范化为数组
    const multiValue = useMemo<(string | DeferredUploadValue)[]>(() => {
      if (Array.isArray(value)) return value as (string | DeferredUploadValue)[];
      return value ? [value as string | DeferredUploadValue] : [];
    }, [value]);

    return (
      <SdpppWidgetMultiUploadSelector
        {...restProps}
        variant={variant as any}
        maxCount={maxCount}
        workBoundary={workBoundary as string}
        sourceHints={sourceHints}
        value={multiValue}
        onChange={onChange as any}
        onValueChange={onValueChange as any}
      />
    );
  }

  switch (variant) {
    case 'nomask': {
      // 单图 nomask：规范化为 string[]
      const nomaskValue: string[] = Array.isArray(value)
        ? (value as string[])
        : (value ? [value as string] : []);

      const nomaskProps: SdpppWidgetUploadSelectorProps = {
        ...(restProps as any),
        workBoundary: workBoundary as string,
        value: nomaskValue,
        onChange: onChange as any,
        onValueChange: onValueChange as any,
      };
      return <SdpppWidgetUploadSelector {...nomaskProps} />;
    }

    case 'deferred':
    default: {
      // 单图 deferred：规范化为 DeferredUploadValue
      const deferredValue: DeferredUploadValue | undefined = Array.isArray(value)
        ? (value[0] as DeferredUploadValue | undefined)
        : (value as DeferredUploadValue | undefined);

      const deferredProps: SdpppWidgetDeferredUploadSelectorProps = {
        ...(restProps as any),
        workBoundary: workBoundary as string,
        sourceHints,
        value: deferredValue,
        onChange: (v: DeferredUploadValue) => {
          onChange?.(v);
          onValueChange?.(v);
        },
        onValueChange: (v: DeferredUploadValue) => {
          onChange?.(v);
          onValueChange?.(v);
        },
      };
      return <SdpppWidgetDeferredUploadSelector {...deferredProps} />;
    }
  }
};

SdpppWidgetUploadSelectorRouter.displayName = 'SdpppWidgetUploadSelectorRouter';
