import { sdpppSDK } from '@sdppp/common';
import { useEffect, useMemo } from 'react';
import { ensureCompositeThumbnail } from '../../services/photoshop/operations';
import { getSlotPrimaryConfig } from '../../foundation/stores/types';
import type { ImageComponentState } from '../../foundation/stores/global-image-store';
import { RealtimeThumbnailStore } from '../../../realtime-thumbnail/state';
import { boundaryResourceFromSetting, buildRealtimeThumbKey } from '../../../realtime-thumbnail/utils';
import type { SlotViewModel } from './image-manager-types';

interface UseSlotsViewModelOptions {
  componentId: string;
  maxCount: number;
  urls: string[];
  component: ImageComponentState | undefined;
}

interface UseSlotsViewModelReturn {
  slots: SlotViewModel[];
  groupCount: number;
}

export function useSlotsViewModel({
  componentId,
  maxCount,
  urls,
  component,
}: UseSlotsViewModelOptions): UseSlotsViewModelReturn {
  const groupCount = useMemo(() => {
    if (maxCount === 1) return 1;
    return Math.max(urls?.length || 0, 1);
  }, [urls, maxCount]);

  useEffect(() => {
    const run = async () => {
      if (!component?.slots) return;
      const slotEntries = Object.entries(component.slots);
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
  }, [componentId, component?.slots]);

  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const thumbs = RealtimeThumbnailStore(state => state.thumbsByDoc[docId || 0]);

  const slots: SlotViewModel[] = useMemo(() => {
    const arr: SlotViewModel[] = [];

    for (let i = 0; i < groupCount; i++) {
      const slot = component?.slots?.[i];
      const primaryConfig = getSlotPrimaryConfig(slot);

      let primaryRealtimeThumb = '';
      if (primaryConfig?.type) {
        const typeKey = primaryConfig.type === 'mask' ? 'mask' : 'image';
        const key = buildRealtimeThumbKey(
          primaryConfig.content,
          primaryConfig.layerIdentify ?? null,
          !!primaryConfig.alt,
          boundaryResourceFromSetting(primaryConfig.boundary ?? null)
        );
        primaryRealtimeThumb = (thumbs as any)?.[typeKey]?.[key] || '';
      }

      const fallbackUrl = urls?.[i] || '';
      const imageUrl =
        slot?.compositeThumbnail ||
        primaryRealtimeThumb ||
        slot?.thumbnail ||
        fallbackUrl;

      arr.push({
        index: i,
        imageUrl,
        primaryAuto: !!primaryConfig,
        primaryContent: primaryConfig?.content ?? null,
        primaryLayerIdentify: primaryConfig?.layerIdentify ?? null,
        primaryBoundary: primaryConfig?.boundary ?? null,
        primaryAlt: !!primaryConfig?.alt,
        primaryTrackType: primaryConfig?.type ?? null,
        maskAuto: !!slot?.maskAutoEnabled,
        uploading: !!slot?.uploading,
        hasPrimary: !!slot?.primaryResourceId,
        hasMask: !!slot?.maskResourceId,
        compositeDirty: !!slot?.compositeDirty,
      });
    }
    return arr;
  }, [component?.slots, groupCount, thumbs, urls]);

  return { slots, groupCount };
}
