import { Buffer } from 'buffer';

export interface UploadFile {
  type: 'buffer' | 'token' | 'resource';
  resource: any;
  fileName: string;
  mimeType?: string;
  resourceId?: string;
}

export interface UploadPass {
  getUploadFile: (signal?: AbortSignal) => Promise<UploadFile>;
  onUploaded: (finalUrl: string) => Promise<void>;
  onUploadError: (error: any) => void;
}

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

export const createTokenUploadPass = (
  token: string,
  fileName: string,
  onUploaded: (url: string) => void,
  onError: (error: any) => void
) => createResourceUploadPass(token, fileName, undefined, onUploaded, onError);

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
