import { sdpppSDK } from '@sdppp/common';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ensureCompositeThumbnail } from '../utils/image-operations';
import { GlobalImageStore, useComponent, type AdvancedSelectionState } from '../stores/global-image-store';
import { RealtimeThumbnailStore } from '../stores/realtime-thumbnail-store';
import { removeUrlAtIndex } from '../utils/upload-helpers';
import { useImageAutoSync } from './useImageAutoSync';
import { useImageSync } from './useImageSync';

export interface UseImageManagerOptions {
  componentId: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  onValueChange: (urls: string[]) => void;
}

export interface SlotViewModel {
  index: number;
  imageUrl: string;
  primaryAuto: boolean;
  maskAuto: boolean;
  uploading: boolean;
  hasPrimary: boolean;
  hasMask: boolean;
  compositeDirty: boolean;
  advancedSelection: AdvancedSelectionState | null;
  advancedAuto: boolean;
}

export interface UseImageManagerReturn {
  slots: SlotViewModel[];
  onPrimarySync: (index: number) => Promise<void>;
  onMaskSync: (index: number) => Promise<void>;
  onAdvancedSelect: (index: number) => Promise<void>;
  onAdvancedResync: (index: number) => Promise<void>;
  onAdvancedAutoToggle: (index: number, enable: boolean) => void;
  onAdvancedCancel: (index: number) => void;
  onPrimaryAutoToggle: (index: number, enable: boolean) => void;
  onMaskAutoToggle: (index: number, enable: boolean) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  uploading: boolean;
  uploadError: string;
  showAddRemove: boolean;
}

export function useImageManager({
  componentId,
  maxCount,
  isMask,
  urls,
  onValueChange,
}: UseImageManagerOptions): UseImageManagerReturn {
  useEffect(() => {
    GlobalImageStore.getState().registerComponent(componentId, {
      maxCount,
      isMask,
      urls,
    });

    return () => {
      GlobalImageStore.getState().unregisterComponent(componentId);
    };
  }, [componentId, maxCount, isMask]);

  useEffect(() => {
    const store = GlobalImageStore.getState();
    const currentComponent = store.components[componentId];

    if (
      currentComponent &&
      JSON.stringify(currentComponent.urls) !== JSON.stringify(urls)
    ) {
      GlobalImageStore.getState().updateUrls(componentId, urls);
    }
  }, [componentId, urls]);

  const comp = useComponent(componentId);
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const thumbs = RealtimeThumbnailStore(state => state.thumbsByDoc[docId || 0]);

  const groupCount = useMemo(() => {
    if (maxCount === 1) return 1;
    return Math.max(urls?.length || 0, 1);
  }, [urls, maxCount]);

  useEffect(() => {
    const run = async () => {
      if (!comp?.slots) return;
      const slotEntries = Object.entries(comp.slots);
      for (const [idxStr, slot] of slotEntries) {
        const idx = Number(idxStr);
        if (
          Number.isFinite(idx) &&
          slot?.compositeDirty &&
          slot.primaryResourceId &&
          slot.maskResourceId
        ) {
          await ensureCompositeThumbnail(componentId, idx);
        }
      }
    };
    void run();
  }, [componentId, comp?.slots]);

  const slots: SlotViewModel[] = useMemo(() => {
    const arr: SlotViewModel[] = [];
    for (let i = 0; i < groupCount; i++) {
      const slot = comp?.slots?.[i];

      let realtimeThumb = '';
      if (slot?.auto?.type) {
        const typeKey = slot.auto.type === 'mask' ? 'mask' : 'image';
        const contentKey = slot.auto.content;
        const baseKey = slot.auto.layerIdentify
          ? `${contentKey}:${slot.auto.layerIdentify}`
          : contentKey;
        const key = slot.auto.alt ? `${baseKey}_alt` : baseKey;
        realtimeThumb = (thumbs as any)?.[typeKey]?.[key] || '';
      }

      const fallbackUrl = urls?.[i] || '';
      const imageUrl =
        slot?.compositeThumbnail ||
        realtimeThumb ||
        slot?.thumbnail ||
        fallbackUrl;

      arr.push({
        index: i,
        imageUrl,
        primaryAuto: slot?.auto?.content === 'canvas',
        maskAuto: !!slot?.maskAutoEnabled,
        uploading: !!slot?.uploading,
        hasPrimary: !!slot?.primaryResourceId,
        hasMask: !!slot?.maskResourceId,
        compositeDirty: !!slot?.compositeDirty,
        advancedSelection: slot?.advancedSelection ?? null,
        advancedAuto: !!slot?.advancedAutoEnabled,
      });
    }
    return arr;
  }, [comp?.slots, groupCount, thumbs, urls]);

  const { onSync, uploading, uploadError } = useImageSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  const { setPrimaryAuto, setMaskAuto } = useImageAutoSync({
    componentId,
    urls,
    isMask,
    onValueChange,
  });

  const onAdd = useCallback(() => {
    if (maxCount === 1) return;
    const limit = Math.max(1, maxCount || 0);
    const curr = urls || [];
    if (curr.length >= limit) return;
    const next = [...curr, ''];
    onValueChange(next);
  }, [urls, maxCount, onValueChange]);

  const onRemove = useCallback(
    (index: number) => {
      const curr = urls || [];
      if (curr.length <= 1 && maxCount === 1) {
        const next = [...curr];
        if (!next.length) {
          onValueChange(['']);
          return;
        }
        next[index] = '';
        onValueChange(next);
        return;
      }

      try {
        const compState = GlobalImageStore.getState().components[componentId];
        const slotKeys = Object.keys(compState?.slots || {})
          .map(k => parseInt(k, 10))
          .filter(n => !Number.isNaN(n))
          .sort((a, b) => a - b);

        for (const k of slotKeys) {
          if (k < index) continue;
          const src = compState?.slots?.[k + 1];
          if (src) {
            GlobalImageStore.getState().setSlotAuto(componentId, k, src.auto || null);
            GlobalImageStore.getState().setSlotThumbnail(componentId, k, src.thumbnail);
            GlobalImageStore.getState().setSlotUploading(componentId, k, !!src.uploading, src.uploadId || null);
            GlobalImageStore.getState().setSlotPrimaryResource(componentId, k, src.primaryResourceId ?? null);
            GlobalImageStore.getState().setSlotMaskResource(componentId, k, src.maskResourceId ?? null);
            GlobalImageStore.getState().setSlotCompositeThumbnail(componentId, k, src.compositeThumbnail);
            GlobalImageStore.getState().markSlotCompositeDirty(
              componentId,
              k,
              typeof src.compositeDirty === 'boolean' ? src.compositeDirty : false
            );
            GlobalImageStore.getState().setSlotCompositeResource(componentId, k, src.compositeResourceId ?? null);
            GlobalImageStore.getState().setSlotMaskAutoEnabled(componentId, k, !!src.maskAutoEnabled);
            GlobalImageStore.getState().setSlotAdvancedSelection(componentId, k, src.advancedSelection ?? null);
            GlobalImageStore.getState().setSlotAdvancedAutoEnabled(componentId, k, !!src.advancedAutoEnabled);
          } else {
            GlobalImageStore.getState().clearSlot(componentId, k);
          }
        }
      } catch (error) {
        console.warn('[useImageManager] onRemove shift failed', error);
      }

      const next = removeUrlAtIndex(curr, index);
      onValueChange(next);
    },
    [urls, maxCount, onValueChange, componentId]
  );

  const handlePrimarySync = useCallback(
    async (index: number) => {
      await onSync(index, 'primary', { altKey: false, shiftKey: false });
    },
    [onSync]
  );

  const handleMaskSync = useCallback(
    async (index: number) => {
      await onSync(index, 'maskCrop', { altKey: false, shiftKey: false });
    },
    [onSync]
  );

  const handleAdvancedSelect = useCallback(
    async (index: number) => {
      await onSync(index, 'sourcePicker', { altKey: false, shiftKey: false });
    },
    [onSync]
  );

  const handleAdvancedResync = useCallback(
    async (index: number) => {
      await onSync(index, 'advancedResync', { altKey: false, shiftKey: false });
    },
    [onSync]
  );

  const handlePrimaryAutoToggle = useCallback(
    (index: number, enable: boolean) => {
      void setPrimaryAuto(index, enable);
    },
    [setPrimaryAuto]
  );

  const handleMaskAutoToggle = useCallback(
    (index: number, enable: boolean) => {
      void setMaskAuto(index, enable);
    },
    [setMaskAuto]
  );

  const handleAdvancedAutoToggle = useCallback(
    (index: number, enable: boolean) => {
      const slotState = GlobalImageStore.getState().getSlot(componentId, index);
      GlobalImageStore.getState().setSlotAdvancedAutoEnabled(componentId, index, enable);
      if (enable && slotState?.advancedSelection) {
        void onSync(index, 'advancedResync', { altKey: false, shiftKey: false });
      }
    },
    [componentId, onSync]
  );

  const handleAdvancedCancel = useCallback(
    (index: number) => {
      GlobalImageStore.getState().setSlotAdvancedSelection(componentId, index, null);
      GlobalImageStore.getState().setSlotAdvancedAutoEnabled(componentId, index, false);
    },
    [componentId]
  );

  const showAddRemove = maxCount !== 1;

  return {
    slots,
    onPrimarySync: handlePrimarySync,
    onMaskSync: handleMaskSync,
    onAdvancedSelect: handleAdvancedSelect,
    onAdvancedResync: handleAdvancedResync,
    onAdvancedAutoToggle: handleAdvancedAutoToggle,
    onAdvancedCancel: handleAdvancedCancel,
    onPrimaryAutoToggle: handlePrimaryAutoToggle,
    onMaskAutoToggle: handleMaskAutoToggle,
    onAdd,
    onRemove,
    uploading,
    uploadError,
    showAddRemove,
  };
}
