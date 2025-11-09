export type Reporter = {
  onStart?: (taskId: string, meta?: any) => void;
  onProgress?: (taskId: string, progress: number, message?: string) => void;
  onFinish?: (taskId: string, status: 'completed' | 'failed' | 'cancelled', error?: string) => void;
};

export type SignalLike = { aborted?: boolean } | undefined;

export type RunOptions = {
  signal?: SignalLike;
  config?: Record<string, any>;
  reporter?: Reporter;
};

export interface TaskLike<T = any> {
  taskId: string;
  promise: Promise<T>;
  cancelable?: boolean;
  cancel?: () => Promise<void> | void;
}

export type HandlerContext = {
  options?: RunOptions;
};

export type UrlTaskHandler = (
  url: URL,
  data: Record<string, any>,
  ctx: HandlerContext
) => Promise<TaskLike>;

export type DescribeResult = {
  widgetableNodes: any[];
  defaultInput: Record<string, any>;
  rawData: any;
};

export type UploadInput = {
  type: 'token' | 'buffer' | 'resource';
  image: ArrayBuffer | string;
  format: 'png' | 'jpg' | 'jpeg' | 'webp';
};
