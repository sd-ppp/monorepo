import React, { useCallback, useRef } from 'react';
import { useUploadPasses } from '../../../upload-pass-context';
import { sdpppSDK } from '@sdppp/common';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import { resolveWorkBoundaryContext } from '../../services/photoshop/operations';
import type { AutoSyncConfig, BoundarySetting } from '../../foundation/stores/types';

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

  const buildAutoConfig = useCallback((): AutoSyncConfig => {
    const desiredType: AutoSyncConfig['type'] = isMask ? 'mask' : 'image';
    const { boundaryParam } = resolveWorkBoundaryContext();
    const fallbackBoundary: BoundarySetting =
      typeof boundaryParam === 'object' || typeof boundaryParam === 'string'
        ? boundaryParam
        : null;
    const docIdRaw = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    const docId =
      typeof docIdRaw === 'number' && Number.isFinite(docIdRaw)
        ? Math.max(0, Math.floor(docIdRaw))
        : 0;

    return {
      type: desiredType,
      docId,
      content: 'canvas',
      layerIdentify: null,
      boundary: fallbackBoundary,
    };
  }, [isMask]);

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
      store.setSlotPrimaryAutoEnabled(componentId, index, enable);
      clearPass(index, 'primary');
      // Only toggle flag. Do not modify slot URIs or start uploads here.
    },
    [clearPass, componentId]
  );

  const setMaskAuto = useCallback(
    async (index: number, enable: boolean) => {
      GlobalImageStore.getState().setSlotMaskAutoEnabled(componentId, index, enable);
      clearPass(index, 'mask');
      // Only toggle flag. Do not modify slot URIs or start uploads here.
    },
    [clearPass, componentId]
  );

  return {
    setPrimaryAuto,
    setMaskAuto,
  };
}
