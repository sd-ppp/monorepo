// 主组件
export { 
  SdpppWidgetUploadSelector,
  SdpppWidgetUploadSelectorRouter,
} from './components/SdpppWidgetUploadSelector';

export {
  SdpppWidgetDeferredUploadSelector,
} from './components/SdpppWidgetDeferredUploadSelector';

export {
  SdpppWidgetMultiUploadSelector,
} from './components/SdpppWidgetMultiUploadSelector';

export {
  SdpppWidgetImageUploadSelector,
} from './components/SdpppWidgetImageUploadSelector';

// Context 和 Hooks
export {
  SdpppWidgetProvider,
  useSdpppWidget,
  useSdpppWidgetActions,
  useSdpppWidgetUpload,
  useWidgetText,
  useWidgetLogger,
  useSelectionBoundary,
  useWidgetDebug,
  useResourceHandleManager,
  useWidgetRealtimeSubscriber,
  type SdpppWidgetActions,
  type SdpppWidgetLogger,
  type SdpppWidgetUploadFn,
  type ResourceHandle,
  type WidgetSelectionBoundaryRect,
} from './context/SdpppWidgetContext';

// 类型
export type {
  SdpppWidgetUploadSelectorProps,
  SdpppWidgetUploadSelectorRouterProps,
  SdpppWidgetUploadSelectorVariant,
  UploadStatus,
} from './components/SdpppWidgetUploadSelector/types';

export type {
  SdpppWidgetDeferredUploadSelectorProps,
  DeferredUploadSelectorSourceHints,
  DeferredUploadValue,
  DeferredUploadStatus,
} from './components/SdpppWidgetDeferredUploadSelector/types';

export type {
  SdpppWidgetMultiUploadSelectorProps,
  MultiUploadSelectorVariant,
  SlotUploadState,
  AggregatedUploadState,
} from './components/SdpppWidgetMultiUploadSelector/types';

export type {
  SdpppWidgetImageUploadSelectorProps,
  ImageUploadSelectorVariant,
} from './components/SdpppWidgetImageUploadSelector/types';

// 工具函数（按需导出）
export { withAlpha } from './utils/color';
export { isImageFile, buildBufferPayloadFromFile } from './utils/fileUtils';
