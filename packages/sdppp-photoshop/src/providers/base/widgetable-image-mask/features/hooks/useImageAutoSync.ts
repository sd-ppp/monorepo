import React, { useCallback, useRef } from 'react';
import { useUploadPasses } from '../../../upload-pass-context';
import { GlobalImageStore, type AutoSyncConfig, getSlotPrimaryConfig } from '../../foundation/stores/global-image-store';
import {
  captureCurrentMask,
  captureWorkBoundaryImage,
  composeImageWithMask,
  resolveWorkBoundaryContext,
  captureAutoImage,
} from '../../services/photoshop/operations';
import { createSlotUploadPass } from '../../services/upload/upload-helpers';
import type { BoundarySetting, SlotState } from '../../foundation/stores/types';

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

  const buildAutoConfig = useCallback(
    (slot: SlotState | undefined): AutoSyncConfig => {
      const desiredType: AutoSyncConfig['type'] = isMask ? 'mask' : 'image';
      const { boundaryParam } = resolveWorkBoundaryContext();
      const fallbackBoundary: BoundarySetting =
        typeof boundaryParam === 'object' || typeof boundaryParam === 'string'
          ? boundaryParam
          : null;

      const currentAuto = getSlotPrimaryConfig(slot);
      if (currentAuto) {
        return {
          ...currentAuto,
          type: desiredType,
          boundary: currentAuto.boundary ?? fallbackBoundary,
        };
      }

      return {
        type: desiredType,
        content: slot?.primaryContent ?? 'canvas',
        alt: typeof slot?.primaryAlt === 'boolean' ? slot.primaryAlt : false,
        layerIdentify: slot?.primaryLayerIdentify ?? null,
        boundary: slot?.primaryBoundary ?? fallbackBoundary,
      };
    },
    [isMask]
  );

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
      const store = GlobalImageStore.getState();
      const slotState = store.getSlot(componentId, index);
      const autoConfig: AutoSyncConfig | null = enable ? buildAutoConfig(slotState) : null;

      store.setSlotPrimaryConfig(componentId, index, autoConfig);
      clearPass(index, 'primary');

      if (!enable) {
        return;
      }

      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

      const uploadPass = createSlotUploadPass({
        componentId,
        index,
        urlsRef,
        onValueChange,
        logPrefix: 'Auto sync upload',
        onStart: () => {
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, true);
          } catch {}
        },
        onComplete: () => {
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
        captureResource: async () => {
          const latestSlot = GlobalImageStore.getState().getSlot(componentId, index);
          const config = buildAutoConfig(latestSlot);
          const capture = await captureAutoImage(componentId, index, config);
          if (!capture.resource) {
            throw new Error('Missing resource from Photoshop');
          }
          return capture.resource;
        },
      });

      passesRef.current.set(passKey(index, 'primary'), uploadPass);
      addUploadPass(uploadPass);
    },
    [addUploadPass, buildAutoConfig, clearPass, componentId, onValueChange, passKey]
  );

  const setMaskAuto = useCallback(
    async (index: number, enable: boolean) => {
      GlobalImageStore.getState().setSlotMaskAutoEnabled(componentId, index, enable);
      clearPass(index, 'mask');

      if (!enable) {
        return;
      }

      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

      const uploadPass = createSlotUploadPass({
        componentId,
        index,
        urlsRef,
        onValueChange,
        logPrefix: 'Mask auto sync upload',
        onStart: () => {
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, true);
          } catch {}
        },
        onComplete: () => {
          try {
            GlobalImageStore.getState().setSlotUploading(componentId, index, false);
          } catch {}
        },
        captureResource: async () => {
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

          return composite.resource;
        },
      });

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
