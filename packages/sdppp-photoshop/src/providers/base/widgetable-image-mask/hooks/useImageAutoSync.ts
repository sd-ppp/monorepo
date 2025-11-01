import React, { useCallback, useRef } from 'react';
import { useUploadPasses } from '../../upload-pass-context';
import { GlobalImageStore, type AutoSyncConfig } from '../stores/global-image-store';
import {
  captureCurrentMask,
  captureWorkBoundaryImage,
  composeImageWithMask,
} from '../utils/image-operations';
import { updateUrlsAtIndex, isAbortError } from '../utils/upload-helpers';

export interface UseImageAutoSyncOptions {
  componentId: string;
  urls: string[];
  isMask: boolean;
  onValueChange: (urls: string[]) => void;
}

type PassKind = 'primary' | 'mask';

export function useImageAutoSync({
  componentId,
  urls,
  isMask,
  onValueChange,
}: UseImageAutoSyncOptions) {
  const { addUploadPass, removeUploadPass } = useUploadPasses();
  const passesRef = useRef<Map<string, any>>(new Map());
  const urlsRef = useRef<string[]>(urls || []);

  React.useEffect(() => {
    urlsRef.current = urls || [];
  }, [urls]);

  const passKey = useCallback((index: number, kind: PassKind) => `${index}:${kind}`, []);

  const clearPass = useCallback(
    (index: number, kind: PassKind) => {
      const key = passKey(index, kind);
      const existing = passesRef.current.get(key);
      if (existing) {
        try {
          removeUploadPass(existing);
        } catch {}
        passesRef.current.delete(key);
      }
    },
    [passKey, removeUploadPass]
  );

  const setPrimaryAuto = useCallback(
    async (index: number, enable: boolean) => {
      const autoConfig: AutoSyncConfig | null = enable
        ? {
            type: isMask ? 'mask' : 'image',
            content: 'canvas',
            alt: false,
            layerIdentify: null,
          }
        : null;

      GlobalImageStore.getState().setSlotAuto(componentId, index, autoConfig);
      clearPass(index, 'primary');

      if (!enable) {
        return;
      }

      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

      const uploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          if (signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, true);
          } catch {}

          const capture = await captureWorkBoundaryImage(componentId, index);

          if (!capture.resource) {
            throw new Error('Missing resource from Photoshop');
          }

          return {
            type: 'resource' as const,
            resource: capture.resource,
            fileName: `${Date.now()}.png`,
            mimeType: 'image/png',
          };
        },
        onUploaded: async (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);
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

      passesRef.current.set(passKey(index, 'primary'), uploadPass);
      addUploadPass(uploadPass);
    },
    [addUploadPass, clearPass, componentId, isMask, onValueChange, passKey]
  );

  const setMaskAuto = useCallback(
    async (index: number, enable: boolean) => {
      GlobalImageStore.getState().setSlotMaskAutoEnabled(componentId, index, enable);
      clearPass(index, 'mask');

      if (!enable) {
        return;
      }

      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

      const uploadPass = {
        getUploadFile: async (signal?: AbortSignal) => {
          if (signal?.aborted) {
            throw new DOMException('Upload aborted', 'AbortError');
          }

          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, true);
          } catch {}

          const slot = GlobalImageStore.getState().getSlot(componentId, index);
          if (!slot?.primaryResourceId) {
            const primaryCapture = await captureWorkBoundaryImage(componentId, index);
            if (!primaryCapture.resource) {
              throw new Error('Missing primary resource for masking');
            }
          }

          const maskCapture = await captureCurrentMask(componentId, index);
          if (!maskCapture.resource) {
            throw new Error('Missing mask resource from Photoshop');
          }

          const composite = await composeImageWithMask(componentId, index);
          if (!composite.resource) {
            throw new Error('Failed to compose image with mask');
          }

          return {
            type: 'resource' as const,
            resource: composite.resource,
            fileName: `${Date.now()}.png`,
            mimeType: 'image/png',
          };
        },
        onUploaded: async (finalUrl: string) => {
          const next = updateUrlsAtIndex(urlsRef.current, index, finalUrl);
          onValueChange(next);
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
        onUploadError: (error: any) => {
          if (!isAbortError(error)) {
            console.warn('Mask auto sync upload failed:', error);
          }
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
      };

      passesRef.current.set(passKey(index, 'mask'), uploadPass);
      addUploadPass(uploadPass);
    },
    [addUploadPass, clearPass, componentId, onValueChange, passKey]
  );

  return {
    setPrimaryAuto,
    setMaskAuto,
  };
}
