import type { DeferredUploadSelectorSourceHints, DeferredUploadValue } from '../SdpppWidgetDeferredUploadSelector/types';

/**
 * 多图上传选择器变体类型
 * - nomask: 无遮罩版本（立即上传，返回 URL 数组）
 * - deferred: 延迟上传版本（返回 DeferredUploadValue 数组）
 */
export type MultiUploadSelectorVariant = 'nomask' | 'deferred';

/**
 * 单个 slot 的上传状态
 */
export interface SlotUploadState {
  status: 'idle' | 'uploading' | 'generating' | 'error';
  errorMessage: string | null;
  progress: { current: number; total: number };
}

/**
 * 聚合的上传状态
 */
export interface AggregatedUploadState {
  status: 'idle' | 'uploading' | 'generating' | 'error';
  errorMessage: string | null;
  progress: {
    current: number;
    total: number;
  };
}

/**
 * 多图上传选择器组件属性
 */
export interface SdpppWidgetMultiUploadSelectorProps {
  /** 组件唯一标识 */
  widgetableId?: string;

  /** 
   * 变体选择
   * - nomask: 立即上传模式（返回 URL 数组）
   * - deferred: 延迟上传模式（返回 DeferredUploadValue 数组）
   * @default 'deferred'
   */
  variant?: MultiUploadSelectorVariant;

  /** 
   * 当前值
   * - nomask 模式: string[]
   * - deferred 模式: (DeferredUploadValue | string)[]
   */
  value?: (string | DeferredUploadValue)[];

  /** 值变化回调 */
  onChange?: (value: (string | DeferredUploadValue)[]) => void;

  /** 值变化回调（备用） */
  onValueChange?: (value: (string | DeferredUploadValue)[]) => void;

  /** 最大图片数量 */
  maxCount: number;

  /** 工作边界 URI */
  workBoundary: string;

  /** 源提示配置（deferred 模式专用） */
  sourceHints?: DeferredUploadSelectorSourceHints;

  /** 显示标签（可选） */
  label?: string | null;

  /** 是否显示操作按钮 */
  showActionButtons?: boolean;

  /** 聚合上传状态变化回调 */
  onUploadStateChange?: (state: AggregatedUploadState) => void;

  /** 外部错误消除信号 */
  externalErrorDismissSignal?: number;
}

/**
 * 内部 slot 项配置
 */
export interface SlotConfig {
  /** slot 的唯一 key */
  key: string;
  /** slot 索引 */
  index: number;
  /** slot 的值 */
  value: string | DeferredUploadValue | null;
}
