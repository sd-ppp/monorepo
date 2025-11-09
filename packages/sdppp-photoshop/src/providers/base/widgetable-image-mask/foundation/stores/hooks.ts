import { GlobalImageStore } from './global-image-store';
import { getSlotPrimaryConfig } from './types';

export function useComponent(componentId: string) {
  return GlobalImageStore(state => state.components[componentId]);
}

export function useImageSlotState(componentId: string, index: number) {
  const comp = useComponent(componentId);
  const slot = comp?.slots?.[index];
  const activeAutoSyncId = getSlotPrimaryConfig(slot)?.content || null;

  return {
    previewSource: {
      fileUri: slot?.fileUri ?? null,
      contentUri: slot?.contentUri ?? null,
      boundaryUri: slot?.boundaryUri ?? null,
      maskUri: slot?.maskUri ?? null,
    },
    activeAutoSyncId,
    uploading: !!slot?.uploading,
    slot,
    comp,
  };
}
