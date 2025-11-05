import { StateCreator } from 'zustand';
import type { ComponentSlice } from './component-slice';
import type { ImageComponentState, SlotState } from './types';

export interface ThumbnailSlice {
  clearAllImageThumbnails: () => void;
  clearAllMaskThumbnails: () => void;
}

type ThumbnailStore = ComponentSlice & ThumbnailSlice;

const clearThumbnails = (components: Record<string, ImageComponentState>, isMask: boolean) => {
  const nextComponents: Record<string, ImageComponentState> = { ...components };

  for (const [compId, comp] of Object.entries(components)) {
    if (!!comp?.isMask === isMask && comp?.slots) {
      const nextSlots: Record<number, SlotState> = { ...comp.slots };

      for (const [key, slot] of Object.entries(comp.slots)) {
        const idx = Number(key);
        nextSlots[idx] = { ...slot, thumbnail: undefined };
      }

      nextComponents[compId] = { ...comp, slots: nextSlots };
    }
  }

  return nextComponents;
};

export const createThumbnailSlice: StateCreator<ThumbnailStore, [], [], ThumbnailSlice> = (set) => ({
  clearAllImageThumbnails: () => {
    set(state => ({
      components: clearThumbnails(state.components, false),
    }));
  },

  clearAllMaskThumbnails: () => {
    set(state => ({
      components: clearThumbnails(state.components, true),
    }));
  },
});
