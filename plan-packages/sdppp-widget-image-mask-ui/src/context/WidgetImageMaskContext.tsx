import React, { createContext, useContext, useMemo } from 'react';

export interface LayerResolveResult {
  uri?: string | null;
  error?: string | null;
}

export interface BoundaryNormalizeResult {
  boundary?: string | null;
  error?: string | null;
}

export interface ResourceThumbnailResult {
  thumbnail?: string | null;
}

export interface FileResourceMaterializeRecord {
  resource?: string | null;
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  error?: string | null;
}

export interface FileResourceMaterializeResult extends FileResourceMaterializeRecord {
  batch?: FileResourceMaterializeRecord[];
}

export interface FileResourceCreateFromCBMParams {
  contentUri?: string;
  boundaryUri?: string;
  maskUri?: string;
  options?: Record<string, unknown>;
}

export interface WidgetImageMaskActions {
  'resource.layer.resolve': (params: { uri: string }) => Promise<LayerResolveResult | void>;
  'resource.boundary.normalize': (params: { boundary: string }) => Promise<BoundaryNormalizeResult | void>;
  'resource.thumbnail': (params: FileResourceCreateFromCBMParams) => Promise<ResourceThumbnailResult | void>;
  'resource.file.createFromCBM': (params: FileResourceCreateFromCBMParams) => Promise<FileResourceMaterializeResult | void>;
  'resource.file.createFromLocal': (params?: Record<string, unknown>) => Promise<FileResourceMaterializeResult | void>;
}

export type TranslateFn = (key: string, options?: Record<string, any>) => string;

export type WidgetImageMaskLogger = (...args: string[]) => void;

export type WorkBoundaryResolver = (args: {
}) => string;

export type WidgetRealtimeSubscriber = (
  docId: number,
  contents: Array<'canvas' | 'curlayer' | 'selection'>,
  callback: () => void,
) => () => void;

export interface WidgetUploadPass {
  getUploadFile: (signal?: AbortSignal) => Promise<any>;
  onUploaded?: (fileURL: string) => Promise<void>;
  onUploadError?: (error: any) => void;
}

export interface WidgetUploadPassHandlers {
  runUploadPassOnce: (pass: WidgetUploadPass) => Promise<string>;
  addUploadPass: (pass: WidgetUploadPass) => string;
  removeUploadPass: (pass: WidgetUploadPass) => void;
}

interface WidgetImageMaskContextValue {
  actions: WidgetImageMaskActions;
  t: TranslateFn;
  logger: WidgetImageMaskLogger;
  debug: boolean;
  resolveWorkBoundary: WorkBoundaryResolver;
  subscribeToRealtimeChanges: WidgetRealtimeSubscriber;
  uploadPassHandlers: WidgetUploadPassHandlers;
}

export interface WidgetImageMaskProviderProps {
  actions: WidgetImageMaskActions;
  t: TranslateFn;
  logger?: WidgetImageMaskLogger;
  debug?: boolean;
  resolveWorkBoundary: WorkBoundaryResolver;
  subscribeToRealtimeChanges: WidgetRealtimeSubscriber;
  uploadPassHandlers?: WidgetUploadPassHandlers;
  children: React.ReactNode;
}

const WidgetImageMaskContext = createContext<WidgetImageMaskContextValue | null>(null);

const defaultLogger: WidgetImageMaskLogger = () => {};

const defaultRealtimeSubscriber: WidgetRealtimeSubscriber = () => () => undefined;
const defaultUploadPassHandlers: WidgetUploadPassHandlers = {
  runUploadPassOnce: async () => '',
  addUploadPass: () => '',
  removeUploadPass: () => undefined,
};

export const WidgetImageMaskProvider: React.FC<WidgetImageMaskProviderProps> = ({
  actions,
  t,
  logger,
  debug = false,
  resolveWorkBoundary,
  subscribeToRealtimeChanges,
  uploadPassHandlers,
  children,
}) => {
  const resolvedLogger = useMemo<WidgetImageMaskLogger>(() => logger ?? defaultLogger, [logger]);
  const resolvedWorkBoundary = useMemo<WorkBoundaryResolver>(
    () => resolveWorkBoundary,
    [resolveWorkBoundary],
  );
  const resolvedSubscriber = useMemo<WidgetRealtimeSubscriber>(
    () => subscribeToRealtimeChanges ?? defaultRealtimeSubscriber,
    [subscribeToRealtimeChanges],
  );
  const resolvedUploadHandlers = useMemo<WidgetUploadPassHandlers>(
    () => uploadPassHandlers ?? defaultUploadPassHandlers,
    [uploadPassHandlers],
  );

  const value = useMemo<WidgetImageMaskContextValue>(
    () => ({
      actions,
      t,
      logger: resolvedLogger,
      debug,
      resolveWorkBoundary: resolvedWorkBoundary,
      subscribeToRealtimeChanges: resolvedSubscriber,
      uploadPassHandlers: resolvedUploadHandlers,
    }),
    [actions, t, resolvedLogger, debug, resolvedWorkBoundary, resolvedSubscriber, resolvedUploadHandlers],
  );

  return <WidgetImageMaskContext.Provider value={value}>{children}</WidgetImageMaskContext.Provider>;
};

export const useWidgetImageMask = (): WidgetImageMaskContextValue => {
  const ctx = useContext(WidgetImageMaskContext);
  if (!ctx) throw new Error('useWidgetImageMask must be used within a WidgetImageMaskProvider');
  return ctx;
};

export const useWidgetImageMaskActions = (): WidgetImageMaskActions => useWidgetImageMask().actions;
export const useWidgetText = (): TranslateFn => useWidgetImageMask().t;
export const useWidgetLogger = (): WidgetImageMaskLogger => useWidgetImageMask().logger;
export const useWidgetDebug = (): boolean => useWidgetImageMask().debug;
export const useWorkBoundaryResolver = (): WorkBoundaryResolver => useWidgetImageMask().resolveWorkBoundary;
export const useWidgetRealtimeSubscriber = (): WidgetRealtimeSubscriber =>
  useWidgetImageMask().subscribeToRealtimeChanges;
export const useWidgetUploadPassHandlers = (): WidgetUploadPassHandlers =>
  useWidgetImageMask().uploadPassHandlers;
