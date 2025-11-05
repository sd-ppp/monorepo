import { useCallback, useEffect, useRef, useState } from 'react';
import { useUploadPasses } from '../../../upload-pass-context';
import { useUploadResource } from './upload-handlers';
import { useAdvancedSelection } from './useAdvancedSelection';
import { useSyncHandlers } from './useSyncHandlers';
import type { SyncEvent, SyncType } from './image-sync-types';

export type { SyncEvent, SyncType } from './image-sync-types';

export interface UseImageSyncOptions {
  componentId: string;
  urls: string[];
  isMask: boolean;
  onValueChange: (urls: string[]) => void;
}

export function useImageSync({
  componentId,
  urls,
  isMask: _isMask,
  onValueChange,
}: UseImageSyncOptions) {
  const { runUploadPassOnce } = useUploadPasses();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const urlsRef = useRef<string[]>(urls || []);

  useEffect(() => {
    urlsRef.current = urls || [];
  }, [urls]);

  const uploadResource = useUploadResource({
    urlsRef,
    onValueChange,
    runUploadPassOnce,
    setUploading,
    setUploadError,
  });

  const syncHandler = useSyncHandlers({
    componentId,
    urlsRef,
    onValueChange,
    runUploadPassOnce,
    uploadResource,
    setUploading,
    setUploadError,
  });

  const { onAdvancedSelect: advancedSelect, onAdvancedCancel } = useAdvancedSelection({ componentId });

  const onSync = useCallback(
    async (index: number, syncType: SyncType, event: SyncEvent) => {
      try {
        setUploadError('');
        await syncHandler(index, syncType, event);
      } catch (error) {
        setUploading(false);
        console.warn('onSync error:', error);
        setUploadError((error as any)?.message || String(error));
      }
    },
    [setUploadError, setUploading, syncHandler]
  );

  const onAdvancedSelect = useCallback(
    async (index: number) => {
      try {
        setUploadError('');
        await advancedSelect(index);
      } catch (error) {
        setUploading(false);
        console.warn('onAdvancedSelect error:', error);
        setUploadError((error as any)?.message || String(error));
      }
    },
    [advancedSelect, setUploadError, setUploading]
  );

  return { onSync, onAdvancedSelect, onAdvancedCancel, uploading, uploadError };
}
