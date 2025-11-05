import { MutableRefObject, useCallback } from 'react';
import { createResourceUploadPass, isAbortError, updateUrlsAtIndex } from '../../services/upload/upload-helpers';
import { UploadPass } from '../../../upload-pass-context';

interface UploadHandlerDeps {
  urlsRef: MutableRefObject<string[]>;
  onValueChange: (urls: string[]) => void;
  runUploadPassOnce: (pass: UploadPass) => Promise<string>;
  setUploading: (value: boolean) => void;
  setUploadError: (value: string) => void;
}

export function useUploadResource({
  urlsRef,
  onValueChange,
  runUploadPassOnce,
  setUploading,
  setUploadError,
}: UploadHandlerDeps) {
  return useCallback(
    (resourceId: string, index: number) => {
      const uploadPass = createResourceUploadPass(
        resourceId,
        `${Date.now()}.png`,
        'image/png',
        (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);
          setUploading(false);
        },
        (error: any) => {
          if (!isAbortError(error)) {
            console.warn('Photoshop upload failed:', error);
            setUploadError(error?.message || String(error));
          }
          setUploading(false);
        }
      );
      runUploadPassOnce(uploadPass);
    },
    [onValueChange, runUploadPassOnce, setUploadError, setUploading, urlsRef]
  );
}
