import React, { createContext, useContext, ReactNode } from 'react';
import { z } from 'zod';
import { createStore } from 'zustand';
import { sdpppSDK } from '@sdppp/common';

const uploadImageInputSchema = z.object({
  type: z.union([z.literal('buffer'), z.literal('token'), z.literal('resource')]),
  resource: z.any(),
  fileName: z.string(),
  mimeType: z.string().optional(),
  resourceId: z.string().optional(),
});
export type UploadPassInput = z.infer<typeof uploadImageInputSchema>;

export type UploadPass = {
  getUploadFile: (signal?: AbortSignal) => Promise<UploadPassInput>;
  onUploaded?: (fileURL: string) => Promise<void>;
  onUploadError?: (error: any) => void;
};

interface UploadPassContextType {
  runUploadPassOnce: (pass: UploadPass) => Promise<string>;
  addUploadPass: (pass: UploadPass) => string;
  removeUploadPass: (pass: UploadPass) => void;
  cancelAllUploads: () => void;
  waitAllUploadPasses: () => Promise<void>;
}

const UploadPassContext = createContext<UploadPassContextType | undefined>(undefined);

interface UploadPassProviderProps {
  children: ReactNode;
  uploader: (uploadInput: UploadPassInput, signal?: AbortSignal) => Promise<string>;
}

function base64ToArrayBuffer(base64: string) {
  if (typeof atob === 'function') {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
  // Node / fallback
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').buffer;
  }
  throw new Error('No base64 decoder available');
}

function inferExtension(mimeType?: string) {
  if (!mimeType) return undefined;
  const [, subtype] = mimeType.split('/');
  if (!subtype) return undefined;
  if (subtype === 'jpeg') return 'jpg';
  return subtype;
}

function ensureFileName(fileName: string, mimeType?: string) {
  if (!mimeType) {
    return fileName;
  }
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(fileName);
  if (hasExtension) {
    return fileName;
  }
  const ext = inferExtension(mimeType);
  return ext ? `${fileName}.${ext}` : fileName;
}

async function materializeUploadInput(uploadInput: UploadPassInput, signal?: AbortSignal): Promise<UploadPassInput> {
  if (uploadInput.type === 'buffer') {
    return uploadInput;
  }
  if (signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError');
  }
  const resourceHandle = typeof uploadInput.resource === 'string'
    ? uploadInput.resource
    : uploadInput.resourceId;

  if (!resourceHandle) {
    return uploadInput;
  }

  const { base64, mimeType, error } = await sdpppSDK.plugins.photoshop.getImageBase64({ token: resourceHandle });
  if (signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError');
  }
  if (error) {
    throw new Error(error);
  }
  if (!base64) {
    throw new Error('Failed to resolve resource data');
  }

  let dataPart = base64;
  let resolvedMime = mimeType;
  const match = /^data:([^;]+);base64,(.*)$/.exec(base64);
  if (match) {
    resolvedMime = resolvedMime || match[1];
    dataPart = match[2];
  }

  const buffer = base64ToArrayBuffer(dataPart);
  const fileName = ensureFileName(uploadInput.fileName, resolvedMime);

  return {
    type: 'buffer',
    resource: {
      data: buffer,
      mimeType: resolvedMime ?? uploadInput.mimeType,
    },
    fileName,
    mimeType: resolvedMime ?? uploadInput.mimeType,
    resourceId: resourceHandle,
  };
}

const uploadPassesStore = createStore<{
  uploadPasses: UploadPass[];
  runningUploadPasses: { [id: string]: Promise<string> };
  abortControllers: { [id: string]: AbortController };
}>(() => ({
  uploadPasses: [],
  runningUploadPasses: {},
  abortControllers: {},
}));

export function UploadPassProvider({ children, uploader }: UploadPassProviderProps) {
  const value: UploadPassContextType = {
    runUploadPassOnce: async (pass: UploadPass) => {
      if (!uploader) {
        throw new Error('Uploader not set');
      }
      const runID = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const abortController = new AbortController();

      const promise = new Promise<string>(async (resolve, reject) => {
        try {
          const rawUploadInput = await pass.getUploadFile(abortController.signal);
          const uploadInput = await materializeUploadInput(rawUploadInput, abortController.signal);
          const fileURL = await uploader(uploadInput, abortController.signal);
          if (pass.onUploaded && !abortController.signal.aborted) {
            await pass.onUploaded(fileURL);
          }
          resolve(fileURL);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            reject(error);
          } else {
            pass.onUploadError?.(error);
            reject(error);
          }
        } finally {
          uploadPassesStore.setState(state => {
            delete state.runningUploadPasses[runID];
            delete state.abortControllers[runID];
            return state;
          });
        }
      });

      uploadPassesStore.setState(state => {
        state.runningUploadPasses[runID] = promise;
        state.abortControllers[runID] = abortController;
        return state;
      });

      return await promise;
    },
    addUploadPass: (pass: UploadPass) => {
      const passId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      uploadPassesStore.setState(state => {
        state.uploadPasses.push(pass);
        return state;
      });
      return passId;
    },
    removeUploadPass: (pass: UploadPass) => {
      uploadPassesStore.setState(state => {
        state.uploadPasses = state.uploadPasses.filter(p => p !== pass);
        return state;
      });
    },
    cancelAllUploads: () => {
      const state = uploadPassesStore.getState();
      Object.values(state.abortControllers).forEach(controller => controller.abort());
      uploadPassesStore.setState(state => {
        state.uploadPasses = [];
        state.runningUploadPasses = {};
        state.abortControllers = {};
        return state;
      });
    },
    waitAllUploadPasses: async () => {
      if (!uploader) {
        throw new Error('Uploader not set');
      }
      const promisesFromUploadPasses = uploadPassesStore.getState().uploadPasses.map(async pass => {
        try {
          const rawUploadInput = await pass.getUploadFile();
          const uploadInput = await materializeUploadInput(rawUploadInput);
          const fileURL = await uploader(uploadInput);
          if (pass.onUploaded) {
            await pass.onUploaded(fileURL);
          }
          return fileURL;
        } catch (error) {
          pass.onUploadError?.(error);
          throw error;
        }
      });
      const promisesFromRunningUploadPasses = Object.values(uploadPassesStore.getState().runningUploadPasses);
      await Promise.all([...promisesFromUploadPasses, ...promisesFromRunningUploadPasses]);
    },
  };

  return <UploadPassContext.Provider value={value}>{children}</UploadPassContext.Provider>;
}

export function useUploadPasses() {
  const ctx = useContext(UploadPassContext);
  if (!ctx) throw new Error('useUploadPasses must be used within an UploadPassProvider');
  return ctx;
}
