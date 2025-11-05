import { Buffer } from 'buffer';
import type { UploadPass } from '../../../upload-pass-context';

/**
 * Convert file to ArrayBuffer for upload
 */
export const fileToArrayBuffer = async (file: File): Promise<ArrayBuffer> => {
  return await file.arrayBuffer();
};

/**
 * Create upload pass for file upload
 */
export const createFileUploadPass = (
  file: File,
  onUploaded: (url: string) => void,
  onError: (error: any) => void
): UploadPass => ({
  getUploadFile: async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    const buffer = await fileToArrayBuffer(file);
    const base64 = Buffer.from(buffer).toString('base64');
    return {
      type: 'buffer',
      resource: {
        data: base64,
        mimeType: file.type || undefined,
      },
      fileName: file.name,
      mimeType: file.type || undefined,
    };
  },
  onUploaded: async (finalUrl: string) => {
    onUploaded(finalUrl);
  },
  onUploadError: (error: any) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      onError(error);
    }
  },
});

/**
 * Create upload pass for Photoshop token
 */
export const createResourceUploadPass = (
  resource: string,
  fileName: string,
  mimeType: string | undefined,
  onUploaded: (url: string) => void,
  onError: (error: any) => void
): UploadPass => ({
  getUploadFile: async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    return {
      type: 'resource',
      resource,
      resourceId: resource,
      fileName,
      mimeType,
    };
  },
  onUploaded: async (finalUrl: string) => {
    onUploaded(finalUrl);
  },
  onUploadError: (error: any) => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      onError(error);
    }
  },
});

/**
 * Update URLs array at specific index
 */
export const updateUrlsAtIndex = (
  urls: string[],
  index: number,
  newUrl: string
): string[] => {
  const base = Array.isArray(urls) ? urls : [];
  const next = base.slice();
  while (next.length <= index) {
    next.push('');
  }
  next[index] = newUrl;
  return next;
};

/**
 * Remove URL at specific index and shift others
 */
export const removeUrlAtIndex = (urls: string[], index: number): string[] => {
  return urls.filter((_, i) => i !== index);
};

/**
 * Check if error is abort error
 */
export const isAbortError = (error: any): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};

type UrlsRef = { current: string[] };

interface SlotUploadPassOptions {
  componentId: string;
  index: number;
  urlsRef: UrlsRef;
  onValueChange: (urls: string[]) => void;
  captureResource: (signal?: AbortSignal) => Promise<string>;
  logPrefix: string;
  setUploadingState?: (value: boolean) => void;
  setUploadError?: (value: string) => void;
  onStart?: () => void;
  onComplete?: () => void;
  fileNameFactory?: () => string;
  mimeType?: string;
}

const safeInvoke = (fn?: (() => void) | ((value: boolean) => void), value?: boolean) => {
  if (!fn) return;
  try {
    if (typeof value === 'boolean') {
      (fn as (value: boolean) => void)(value);
    } else {
      (fn as () => void)();
    }
  } catch {}
};

const defaultFileNameFactory = () => `${Date.now()}.png`;

export const createSlotUploadPass = ({
  componentId,
  index,
  urlsRef,
  onValueChange,
  captureResource,
  logPrefix,
  setUploadingState,
  setUploadError,
  onStart,
  onComplete,
  fileNameFactory = defaultFileNameFactory,
  mimeType = 'image/png',
}: SlotUploadPassOptions): UploadPass => ({
  getUploadFile: async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }

    safeInvoke(setUploadingState, true);
    safeInvoke(onStart);

    const resource = await captureResource(signal);
    if (!resource) {
      throw new Error('Missing resource from capture');
    }

    return {
      type: 'resource',
      resource,
      resourceId: resource,
      fileName: fileNameFactory(),
      mimeType,
    };
  },
  onUploaded: async (finalUrl: string) => {
    const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
    onValueChange(next);
    safeInvoke(setUploadingState, false);
    safeInvoke(onComplete);
  },
  onUploadError: (error: any) => {
    if (!isAbortError(error)) {
      console.warn(`${logPrefix} failed:`, error);
      if (setUploadError) {
        setUploadError(error?.message || String(error));
      }
    }
    safeInvoke(setUploadingState, false);
    safeInvoke(onComplete);
  },
});
