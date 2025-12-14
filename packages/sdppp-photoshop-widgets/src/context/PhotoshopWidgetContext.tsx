import React, { createContext, useContext, useMemo } from 'react';

export interface ResourceHandle {
  readonly resourceId: string;
  retain(): this;
  release(): void;
  dispose(): void;
}

export interface LayerResolveResult {
  uri?: string | null;
  error?: string | null;
  layerId?: string | null;
  layerName?: string | null;
  boundaryUri?: string | null;
}

export interface BoundaryNormalizeResult {
  boundary?: string | null;
  error?: string | null;
}

export interface ResourceThumbnailResult {
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  error?: string | null;
}

export interface FileResourceMaterializeRecord {
  resource?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  nativePath?: string | null;
  error?: string | null;
  handle?: ResourceHandle | null;
}

export interface FileResourceMaterializeResult extends FileResourceMaterializeRecord {
  batch?: FileResourceMaterializeRecord[];
}

export interface FileResourceCreateFromBufferPayload {
  buffer: ArrayBuffer | ArrayBufferView | Uint8Array | string;
  name?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  meta?: Record<string, unknown>;
}

export interface FileResourceCreateFromBufferParams {
  files: FileResourceCreateFromBufferPayload[];
}

export interface WidgetSelectionBoundaryRect {
  leftDistance: number;
  topDistance: number;
  rightDistance: number;
  bottomDistance: number;
  width: number;
  height: number;
}

export type WidgetSelectionBoundary = WidgetSelectionBoundaryRect | null;

export interface FileResourceCreateByContentParams {
  contentUri: string;
  options?: Record<string, unknown>;
}

export interface FileResourceCreateByMaskParams {
  maskUri: string;
  options?: Record<string, unknown>;
}

export interface FileResourceCombineByCBMParams {
  contentUri: string;
  boundaryUri: string;
  maskUri?: string | null;
  thumbnail?: boolean;
  options?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface ResourceThumbnailParams {
  resource: string;
  maxSize?: number;
}

export interface MaterializedResourceRef {
  resource: string;
  handle?: ResourceHandle | null;
}

export interface ResourceHandleManager {
  acquire: (resourceId?: string | null) => ResourceHandle | null;
}

export type AdvancedContentSourceSelection =
  | { contentUri: string; fileUri?: undefined }
  | { contentUri?: undefined; fileUri: string };

export type SelectAdvancedContentSource = () => Promise<
  AdvancedContentSourceSelection | null | undefined
>;

export interface PhotoshopWidgetActions {
  'resource.layer.resolve': (params: { uri: string; type?: string }) => Promise<LayerResolveResult | void>;
  'resource.boundary.normalize': (params: { boundary: string }) => Promise<BoundaryNormalizeResult | void>;
  'resource.thumbnail': (params: ResourceThumbnailParams) => Promise<ResourceThumbnailResult | void>;
  'resource.file.createByContent': (
    params: FileResourceCreateByContentParams
  ) => Promise<FileResourceMaterializeResult | void>;
  'resource.file.createByMask': (
    params: FileResourceCreateByMaskParams
  ) => Promise<FileResourceMaterializeResult | void>;
  'resource.file.combineByCBM': (
    params: FileResourceCombineByCBMParams
  ) => Promise<FileResourceMaterializeResult | void>;
  'resource.file.createFromBuffer': (
    params: FileResourceCreateFromBufferParams
  ) => Promise<FileResourceMaterializeResult | void>;
  'resource.file.createFromLocal': (params?: Record<string, unknown>) => Promise<FileResourceMaterializeResult | void>;
}

export type TranslateFn = (key: string, options?: Record<string, any>) => string;

export type PhotoshopWidgetLogger = (...args: string[]) => void;

export type WorkBoundaryResolver = (args: {
}) => string;

export type WidgetRealtimeSubscriber = (
  docId: number,
  contents: Array<'canvas' | 'curlayer' | 'selection'>,
  callback: () => void,
) => () => void;

export interface WidgetUploadPass {
  getUploadFile: (signal?: AbortSignal) => Promise<{
    fileName: string;
  }>;
  onUploaded?: (fileURL: string) => Promise<void>;
  onUploadError?: (error: any) => void;
}

export interface WidgetUploadPassHandlers {
  runUploadPassOnce: (pass: WidgetUploadPass) => Promise<string>;
  addUploadPass: (pass: WidgetUploadPass) => string;
  removeUploadPass: (pass: WidgetUploadPass) => void;
}

export type BoundaryHoverChangeHandler = (rect: WidgetSelectionBoundaryRect | null) => void;

interface PhotoshopWidgetContextValue {
  actions: PhotoshopWidgetActions;
  t: TranslateFn;
  logger: PhotoshopWidgetLogger;
  debug: boolean;
  workBoundaryUri: string;
  selectionBoundary: WidgetSelectionBoundary;
  subscribeToRealtimeChanges: WidgetRealtimeSubscriber;
  uploadPassHandlers: WidgetUploadPassHandlers;
  selectAdvancedContentSource: SelectAdvancedContentSource;
  resourceHandles: ResourceHandleManager;
  boundaryHoverHandler: BoundaryHoverChangeHandler;
}

export interface PhotoshopWidgetProviderProps {
  actions: PhotoshopWidgetActions;
  t: TranslateFn;
  logger?: PhotoshopWidgetLogger;
  debug?: boolean;
  workBoundaryUri: string;
  selectionBoundary?: WidgetSelectionBoundary;
  subscribeToRealtimeChanges: WidgetRealtimeSubscriber;
  uploadPassHandlers?: WidgetUploadPassHandlers;
  selectAdvancedContentSource?: SelectAdvancedContentSource;
  resourceHandles: ResourceHandleManager;
  onBoundaryHoverChange?: BoundaryHoverChangeHandler;
  children: React.ReactNode;
}

const PhotoshopWidgetContext = createContext<PhotoshopWidgetContextValue | null>(null);

const defaultLogger: PhotoshopWidgetLogger = () => {};

const defaultRealtimeSubscriber: WidgetRealtimeSubscriber = () => () => undefined;
const defaultUploadPassHandlers: WidgetUploadPassHandlers = {
  runUploadPassOnce: async () => '',
  addUploadPass: () => '',
  removeUploadPass: () => undefined,
};
const defaultSelectAdvancedContentSource: SelectAdvancedContentSource = async () => null;
const defaultBoundaryHoverHandler: BoundaryHoverChangeHandler = () => undefined;

export const PhotoshopWidgetProvider: React.FC<PhotoshopWidgetProviderProps> = ({
  actions,
  t,
  logger,
  debug = false,
  workBoundaryUri,
  selectionBoundary = null,
  subscribeToRealtimeChanges,
  uploadPassHandlers,
  selectAdvancedContentSource,
  resourceHandles,
  onBoundaryHoverChange,
  children,
}) => {
  if (!resourceHandles) {
    throw new Error('PhotoshopWidgetProvider requires resourceHandles to be provided');
  }
  const resolvedLogger = useMemo<PhotoshopWidgetLogger>(() => logger ?? defaultLogger, [logger]);
  const resolvedSubscriber = useMemo<WidgetRealtimeSubscriber>(
    () => subscribeToRealtimeChanges ?? defaultRealtimeSubscriber,
    [subscribeToRealtimeChanges],
  );
  const resolvedUploadHandlers = useMemo<WidgetUploadPassHandlers>(
    () => uploadPassHandlers ?? defaultUploadPassHandlers,
    [uploadPassHandlers],
  );
  const resolvedSelectAdvancedContentSource = useMemo<SelectAdvancedContentSource>(
    () => selectAdvancedContentSource ?? defaultSelectAdvancedContentSource,
    [selectAdvancedContentSource],
  );
  const resolvedBoundaryHoverHandler = useMemo<BoundaryHoverChangeHandler>(
    () => onBoundaryHoverChange ?? defaultBoundaryHoverHandler,
    [onBoundaryHoverChange],
  );

  const value = useMemo<PhotoshopWidgetContextValue>(
    () => ({
      actions,
      t,
      logger: resolvedLogger,
      debug,
      workBoundaryUri,
      selectionBoundary,
      subscribeToRealtimeChanges: resolvedSubscriber,
      uploadPassHandlers: resolvedUploadHandlers,
      selectAdvancedContentSource: resolvedSelectAdvancedContentSource,
      resourceHandles,
      boundaryHoverHandler: resolvedBoundaryHoverHandler,
    }),
    [
      actions,
      t,
      resolvedLogger,
      debug,
      workBoundaryUri,
      selectionBoundary,
      resolvedSubscriber,
      resolvedUploadHandlers,
      resolvedSelectAdvancedContentSource,
      resourceHandles,
      resolvedBoundaryHoverHandler,
    ],
  );

  return <PhotoshopWidgetContext.Provider value={value}>{children}</PhotoshopWidgetContext.Provider>;
};

export const usePhotoshopWidget = (): PhotoshopWidgetContextValue => {
  const ctx = useContext(PhotoshopWidgetContext);
  if (!ctx) throw new Error('usePhotoshopWidget must be used within a PhotoshopWidgetProvider');
  return ctx;
};

export const usePhotoshopWidgetActions = (): PhotoshopWidgetActions => usePhotoshopWidget().actions;
export const useWidgetText = (): TranslateFn => usePhotoshopWidget().t;
export const useWidgetLogger = (): PhotoshopWidgetLogger => usePhotoshopWidget().logger;
export const useWidgetDebug = (): boolean => usePhotoshopWidget().debug;
export const useWorkBoundary = (): string => usePhotoshopWidget().workBoundaryUri;
export const useSelectionBoundary = (): WidgetSelectionBoundary =>
  usePhotoshopWidget().selectionBoundary;
export const useWidgetRealtimeSubscriber = (): WidgetRealtimeSubscriber =>
  usePhotoshopWidget().subscribeToRealtimeChanges;
export const useWidgetUploadPassHandlers = (): WidgetUploadPassHandlers =>
  usePhotoshopWidget().uploadPassHandlers;
export const useSelectAdvancedContentSource = (): SelectAdvancedContentSource =>
  usePhotoshopWidget().selectAdvancedContentSource;
export const useResourceHandleManager = (): ResourceHandleManager =>
  usePhotoshopWidget().resourceHandles;
export const useBoundaryHoverHandler = (): BoundaryHoverChangeHandler =>
  usePhotoshopWidget().boundaryHoverHandler;
