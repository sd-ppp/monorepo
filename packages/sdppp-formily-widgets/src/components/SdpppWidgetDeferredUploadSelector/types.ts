/**
 * 延迟上传选择器的源提示配置
 * 用于指定从 Photoshop 获取内容的来源
 */
export interface DeferredUploadSelectorSourceHints {
  /** 内容来源: 画布或当前图层 */
  content?: 'canvas' | 'curlayer' | null;
  /** 遮罩来源: 画布、当前图层、选区、智能选区或空遮罩（不使用遮罩） */
  mask?: 'canvas' | 'curlayer' | 'selection' | 'smart_selection' | 'empty' | null;
  /** 边界限定: 画布、当前图层或选区 */
  boundary?: 'canvas' | 'curlayer' | 'selection' | null;
}

/**
 * 延迟上传的值格式
 * 在表单提交前，此值不会被上传，只保存 URI 描述
 */
export interface DeferredUploadValue {
  /** 标识这是一个延迟上传值 */
  type: 'deferred';
  /** 内容 URI */
  contentUri: string;
  /** 边界 URI */
  boundaryUri: string;
  /** 遮罩 URI（可选） */
  maskUri?: string;
  /** 临时资源 ID（用于预览） */
  resourceId?: string;
  /** 预览 URL */
  previewUrl?: string;
  /** 生成时间戳 */
  timestamp?: number;
}

/**
 * 上传状态
 */
export type DeferredUploadStatus = 'idle' | 'generating' | 'error';

/**
 * 延迟上传选择器组件属性
 */
export interface SdpppWidgetDeferredUploadSelectorProps {
  /** 组件唯一标识 */
  widgetableId?: string;
  /** 表单值（DeferredUploadValue 或最终 URL 数组） */
  value?: DeferredUploadValue | string[] | null;
  /** 值变化回调 */
  onChange?: (value: DeferredUploadValue | string[]) => void;
  /** 值变化回调（备用） */
  onValueChange?: (value: DeferredUploadValue | string[]) => void;
  /** 工作边界 URI，用于解析文档 ID */
  workBoundary: string;
  /** 源提示配置 */
  sourceHints?: DeferredUploadSelectorSourceHints;
  /** 显示标签（可选，不提供则自动生成） */
  label?: string | null;
  /** 上传状态变化回调 */
  onUploadStateChange?: (state: {
    status: DeferredUploadStatus;
    errorMessage: string | null;
  }) => void;
}
