import { GlobalImageStore } from '../stores/global-image-store';

export type AdvancedAutoContent = 'canvas' | 'curlayer' | 'selection';

export function normalizeAdvancedContent(value: any): AdvancedAutoContent {
  if (value === 'curlayer' || value === 'selection' || value === 'canvas') {
    return value;
  }
  return 'canvas';
}

export function shiftSlotsAfterRemoval(
  componentId: string,
  startIndex: number,
  removeAdvancedAutoRegistration?: (index: number) => void,
): void {
  const store = GlobalImageStore.getState();
  const compState = store.components[componentId];
  if (!compState) return;

  const slotKeys = Object.keys(compState.slots || {})
    .map(k => parseInt(k, 10))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => a - b);

  for (const k of slotKeys) {
    if (k < startIndex) continue;
    const src = compState.slots?.[k + 1];
    if (src) {
      store.setSlotUploading(componentId, k, !!src.uploading, src.uploadId || null);
      store.setSlotPrimaryResource(componentId, k, src.primaryResourceId ?? null);
      store.setSlotMaskResource(componentId, k, src.maskResourceId ?? null);
      store.setSlotContentUri(componentId, k, src.contentUri ?? null);
      store.setSlotBoundaryUri(componentId, k, src.boundaryUri ?? null);
      store.setSlotMaskUri(componentId, k, src.maskUri ?? null);
      store.setSlotFileUri(componentId, k, src.fileUri ?? null);
      store.setSlotPrimaryAutoEnabled(componentId, k, !!src.primaryAutoEnabled);
      store.markSlotCompositeDirty(
        componentId,
        k,
        typeof src.compositeDirty === 'boolean' ? src.compositeDirty : false,
      );
      store.setSlotCompositeResource(componentId, k, src.compositeResourceId ?? null);
      store.setSlotMaskAutoEnabled(componentId, k, !!src.maskAutoEnabled);
    } else {
      removeAdvancedAutoRegistration?.(k);
      store.clearSlot(componentId, k);
    }
  }
}
