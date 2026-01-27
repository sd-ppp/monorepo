import type { DeferredUploadSelectorSourceHints, DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';
import type { AggregatedUploadState } from '../SdpppWidgetMultiUploadSelector/types';

/**
 * 智能图片上传选择器变体类型
 */
export type ImageUploadSelectorVariant = 'nomask' | 'deferred';

/**
 * 智能图片上传选择器组件属性
 * 
 * @remarks
 * 根据 maxCount 自动选择单图或多图模式：
 * - maxCount === 1: 使用单图组件（SdpppWidgetUploadSelectorRouter）
 * - maxCount > 1: 使用多图组件（SdpppWidgetMultiUploadSelector）
 * 
 * 值类型根据 maxCount 自动推断：
 * - maxCount === 1: string | DeferredUploadValue
 * - maxCount > 1: (string | DeferredUploadValue)[]
 */
export interface SdpppWidgetImageUploadSelectorProps {
  /** 组件唯一标识 */
  widgetableId?: string;

  /** 
   * 变体选择
   * - nomask: 立即上传模式（返回 URL）
   * - deferred: 延迟上传模式（返回 DeferredUploadValue）
   * @default 'deferred'
   */
  variant?: ImageUploadSelectorVariant;

  /** 
   * 当前值
   * - maxCount === 1: string | DeferredUploadValue
   * - maxCount > 1: (string | DeferredUploadValue)[]
   */
  value?: string | DeferredUploadValue | (string | DeferredUploadValue)[];

  /** 值变化回调 */
  onChange?: (value: string | DeferredUploadValue | (string | DeferredUploadValue)[]) => void;

  /** 值变化回调（备用） */
  onValueChange?: (value: string | DeferredUploadValue | (string | DeferredUploadValue)[]) => void;

  /** 
   * 最大图片数量
   * - 1: 单图模式
   * - >1: 多图模式
   * @default 1
   */
  maxCount?: number;

  /** 工作边界 URI */
  workBoundary: string;

  /** 源提示配置（deferred 模式专用） */
  sourceHints?: DeferredUploadSelectorSourceHints;

  /** 显示标签（可选） */
  label?: string | null;

  /** 是否显示操作按钮 */
  showActionButtons?: boolean;

  /** 上传状态变化回调 */
  onUploadStateChange?: (state: {
    status: 'idle' | 'uploading' | 'generating' | 'error';
    errorMessage: string | null;
    progress: { current: number; total: number };
  }) => void;

  /** 外部错误消除信号 */
  externalErrorDismissSignal?: number;
}
