import React, { useCallback, useRef } from 'react';
import { sdpppSDK } from '@sdppp/common';
import { useUploadPasses } from '../../upload-pass-context';
import { GlobalImageStore, type AutoSyncConfig } from '../stores/global-image-store';
import { getPhotoshopImage } from '../utils/image-operations';
import { createTokenUploadPass, updateUrlsAtIndex, isAbortError } from '../utils/upload-helpers';

export interface AutoSyncEvent {
  altKey: boolean;
  shiftKey: boolean;
}

export interface UseImageAutoSyncOptions {
  componentId: string;
  urls: string[];
  isMask: boolean;
  onValueChange: (urls: string[]) => void;
}

export function useImageAutoSync({ componentId, urls, isMask, onValueChange }: UseImageAutoSyncOptions) {
  const { addUploadPass, removeUploadPass } = useUploadPasses();
  const passesRef = useRef<Map<number, any>>(new Map());
  const urlsRef = useRef<string[]>(urls || []);

  React.useEffect(() => {
    urlsRef.current = urls || [];
  }, [urls]);

  const resolveCurrentLayerIdentify = useCallback(async (): Promise<string | null> => {
    try {
      const api: any = sdpppSDK?.plugins?.photoshop;
      if (!api) return null;

      if (typeof api.getCurrentLayerIdentify === 'function') {
        const res = await api.getCurrentLayerIdentify();
        return res?.layer_identify ?? res?.identify ?? null;
      }
    } catch (error) {
      console.warn('[useImageAutoSync] resolveCurrentLayerIdentify error', error);
    }
    return null;
  }, []);

  const onAutoSyncChange = useCallback(
    async (index: number, activeId: string | null, event: AutoSyncEvent) => {
      const type = isMask ? 'mask' : 'image';
      const altUsed = !!event?.altKey;
      let resolvedLayerIdentify: string | null = null;

      if (activeId === 'curlayer') {
        resolvedLayerIdentify = await resolveCurrentLayerIdentify();
      }

      // Update auto-sync state in global store (drives realtime thumbnails)
      if (!activeId) {
        GlobalImageStore.getState().setSlotAuto(componentId, index, null);
      } else if (activeId === 'canvas' || activeId === 'curlayer' || activeId === 'selection') {
        const autoConfig: AutoSyncConfig = {
          type,
          content: activeId as any,
          alt: altUsed,
          layerIdentify: resolvedLayerIdentify,
        };
        GlobalImageStore.getState().setSlotAuto(componentId, index, autoConfig);
      }

      // Remove existing pass for this slot
      const existing = passesRef.current.get(index);
      if (existing) {
        try {
          removeUploadPass(existing);
        } catch {}
        passesRef.current.delete(index);
      }

      // If disabled, nothing more to do
      if (!activeId) return;

      // Create a persistent upload pass that fetches latest PS content at execution time
      const layerIdentify = activeId === 'curlayer' ? resolvedLayerIdentify : null;

      const uploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          if (signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          // Mark slot uploading for UI indication
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, true);
          } catch {}

          // Propagate Alt semantics (reverse/crop) like once-sync Alt behavior
          const { file_token, result } = await getPhotoshopImage(
            isMask,
            activeId as any,
            altUsed,
            layerIdentify || undefined
          );

          if (result?.error) {
            throw new Error(result.error);
          }

          if (!file_token) {
            throw new Error('Missing file token from Photoshop');
          }

          return {
            type: 'token' as const,
            tokenOrBuffer: file_token,
            fileName: `${Date.now()}.png`,
          };
        },
        onUploaded: async (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);

          // Clear uploading state
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
        onUploadError: (error: any) => {
          if (!isAbortError(error)) {
            console.warn('Auto sync upload failed:', error);
          }
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
      };

      passesRef.current.set(index, uploadPass);
      addUploadPass(uploadPass);
    },
    [componentId, isMask, urls, onValueChange, addUploadPass, removeUploadPass, resolveCurrentLayerIdentify]
  );

  return { onAutoSyncChange };
}
