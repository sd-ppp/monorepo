export type UploadStatus = 'idle' | 'uploading' | 'error';

/**
 * 上传选择器变体类型
 * - nomask: 无遮罩版本（画布+本地+拖拽，立即上传，默认）
 * - deferred: 延迟上传（只生成预览，不立即上传）
 */
export type SdpppWidgetUploadSelectorVariant = 
  | 'nomask'
  | 'deferred';

export interface SdpppWidgetUploadSelectorProps {
  widgetableId?: string;
  value?: string[];
  onChange?: (value: string[]) => void;
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
  externalErrorDismissSignal?: number;
  onUploadStateChange?: (state: {
    status: UploadStatus;
    errorMessage: string | null;
    progress: { current: number; total: number };
  }) => void;
}

/**
 * 路由组件的 Props（包含 variant 和 maxCount）
 * 
 * @remarks
 * 此组件根据两个维度进行路由：
 * 1. maxCount: 决定单图还是多图模式
 *    - maxCount === 1（默认）: 单图模式
 *    - maxCount > 1: 多图模式
 * 2. variant: 决定上传模式
 *    - nomask: 立即上传（默认）
 *    - deferred: 延迟上传
 */
export interface SdpppWidgetUploadSelectorRouterProps {
  widgetableId?: string;
  
  /**
   * 最大图片数量
   * - 1（默认）: 单图模式
   * - >1: 多图模式
   * @default 1
   */
  maxCount?: number;
  
  /**
   * 上传模式
   * - nomask: 立即上传（默认）
   * - deferred: 延迟上传
   * @default 'nomask'
   */
  variant?: SdpppWidgetUploadSelectorVariant;
  
  /**
   * 当前值
   * - 单图模式: string | DeferredUploadValue | string[]
   * - 多图模式: (string | DeferredUploadValue)[]
   */
  value?: any;
  
  /** 值变化回调 */
  onChange?: (value: any) => void;
  
  /** 值变化回调（备用） */
  onValueChange?: (value: any) => void;
  
  /** 工作边界 URI */
  workBoundary?: string;
  
  /** 源提示配置（deferred 模式专用） */
  sourceHints?: import('../SdpppWidgetDeferredUploadSelector/types').DeferredUploadSelectorSourceHints;
  
  /** 显示标签（可选） */
  label?: string | null;
  
  /** 是否显示操作按钮 */
  showActionButtons?: boolean;
  
  /** 外部错误消除信号 */
  externalErrorDismissSignal?: number;
  
  /** 上传状态变化回调 */
  onUploadStateChange?: (state: {
    status: 'idle' | 'uploading' | 'generating' | 'error';
    errorMessage: string | null;
    progress: { current: number; total: number };
  }) => void;
}
