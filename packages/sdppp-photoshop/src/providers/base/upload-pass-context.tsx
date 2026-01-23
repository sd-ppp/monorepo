import { createContext, ReactNode, useContext } from 'react';
import { t } from '@sdppp/common';
import { z } from 'zod';
import { createStore } from 'zustand';

const uploadImageInputSchema = z.object({
  type: z.literal('buffer').or(z.literal('token')),
  tokenOrBuffer: z.any(),
  fileName: z.string(),
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
        throw new Error(t('upload_pass.error.uploader_missing', { defaultValue: 'Uploader not set' }));
      }
      const runID = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const abortController = new AbortController();

      const promise = new Promise<string>(async (resolve, reject) => {
        try {
          const uploadInput = await pass.getUploadFile(abortController.signal);
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
        throw new Error(t('upload_pass.error.uploader_missing', { defaultValue: 'Uploader not set' }));
      }
      const promisesFromUploadPasses = uploadPassesStore.getState().uploadPasses.map(async pass => {
        try {
          const uploadInput = await pass.getUploadFile();
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
