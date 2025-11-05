import { sdpppSDK } from '@sdppp/common';
import { RealtimeThumbnailStore } from '../../../realtime-thumbnail/state';
import { boundaryResourceFromSetting, buildRealtimeThumbKey } from '../../../realtime-thumbnail/utils';
import { GlobalImageStore } from './global-image-store-store';
import { getSlotPrimaryConfig } from './types';

export function useComponent(componentId: string) {
  return GlobalImageStore(state => state.components[componentId]);
}

export function useImageSlotState(componentId: string, index: number) {
  const comp = useComponent(componentId);
  const slot = comp?.slots?.[index];
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const thumbs = RealtimeThumbnailStore(state => state.thumbsByDoc[docId || 0]);

  const makeKey = () => {
    const primaryConfig = getSlotPrimaryConfig(slot);
    if (!primaryConfig) return null;

    const boundaryResource = boundaryResourceFromSetting(primaryConfig.boundary ?? null);
    return buildRealtimeThumbKey(
      primaryConfig.content,
      primaryConfig.layerIdentify ?? null,
      !!primaryConfig.alt,
      boundaryResource
    );
  };

  const rtKey = makeKey();
  const rt = rtKey
    ? (comp?.isMask ? thumbs?.mask?.[rtKey] : thumbs?.image?.[rtKey])
    : '';

  const previewUrl = rt || slot?.thumbnail || '';
  const activeAutoSyncId = getSlotPrimaryConfig(slot)?.content || null;

  return {
    previewUrl,
    activeAutoSyncId,
    uploading: !!slot?.uploading,
    slot,
    comp,
  };
}
