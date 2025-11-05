import { StateCreator } from 'zustand';
import { startAutoThumbnail, stopAutoThumbnail } from '../../../realtime-thumbnail/actions';
import type { ComponentSlice } from './component-slice';
import type { AutoSyncConfig, SlotState, TrackType } from './types';
import { getSlotPrimaryConfig } from './types';

export interface SlotSlice {
  setSlotPrimaryConfig: (
    id: string,
    index: number,
    config: AutoSyncConfig | null
  ) => void;
  setSlotThumbnail: (id: string, index: number, url: string | undefined) => void;
  setSlotUploading: (id: string, index: number, uploading: boolean, uploadId?: string | null) => void;
  setSlotPrimaryResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  setSlotMaskResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  setSlotCompositeThumbnail: (id: string, index: number, thumbnail: string | undefined) => void;
  markSlotCompositeDirty: (id: string, index: number, dirty?: boolean) => void;
  setSlotCompositeResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  setSlotMaskAutoEnabled: (id: string, index: number, enabled: boolean) => void;
  clearSlot: (id: string, index: number) => void;
  getSlot: (id: string, index: number) => SlotState | undefined;
}

type SlotStore = ComponentSlice & SlotSlice;

const ensureSlot = (slot?: SlotState): SlotState =>
  slot ?? {
    primaryTrackType: null,
    primaryContent: null,
    primaryLayerIdentify: null,
    primaryBoundary: null,
    primaryAlt: undefined,
  };

const applyPrimaryConfigToSlot = (
  slot: SlotState,
  config: AutoSyncConfig | null
): SlotState => {
  const next: SlotState = {
    ...slot,
    primaryTrackType: config?.type ?? null,
    primaryContent: config?.content ?? null,
    primaryLayerIdentify: config?.layerIdentify ?? null,
    primaryBoundary: config?.boundary ?? null,
    primaryAlt: config?.alt,
  };
  if (!config) {
    next.primaryAlt = undefined;
  }
  return next;
};

export const createSlotSlice: StateCreator<SlotStore, [], [], SlotSlice> = (set, get) => ({
  setSlotPrimaryConfig: (id, index, config) => {
    let previousConfig: AutoSyncConfig | null = null;

    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      previousConfig = getSlotPrimaryConfig(prev);
      const nextSlot: SlotState = applyPrimaryConfigToSlot(prev, config);

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });

    const comp = get().components[id];
    const type: TrackType = config?.type || previousConfig?.type || (comp?.isMask ? 'mask' : 'image');

    if (config) {
      startAutoThumbnail(
        type,
        config.content,
        !!config.alt,
        config.layerIdentify || undefined,
        config.boundary ?? null
      );
    } else if (previousConfig) {
      stopAutoThumbnail(
        previousConfig.type,
        previousConfig.content,
        previousConfig.layerIdentify || null,
        previousConfig.boundary ?? null
      );
    }
  },

  setSlotThumbnail: (id, index, url) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = { ...prev, thumbnail: url };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotUploading: (id, index, uploading, uploadId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = { ...prev, uploading, uploadId };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotPrimaryResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        primaryResourceId: resourceId ?? null,
        compositeDirty: resourceId !== prev.primaryResourceId ? true : prev.compositeDirty,
        compositeResourceId: resourceId !== prev.primaryResourceId ? null : prev.compositeResourceId,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotMaskResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        maskResourceId: resourceId ?? null,
        compositeDirty: resourceId !== prev.maskResourceId ? true : prev.compositeDirty,
        compositeResourceId: resourceId !== prev.maskResourceId ? null : prev.compositeResourceId,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotCompositeThumbnail: (id, index, thumbnail) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        compositeThumbnail: thumbnail,
        compositeDirty: false,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  markSlotCompositeDirty: (id, index, dirty = true) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        compositeDirty: dirty,
        compositeResourceId: dirty ? null : prev.compositeResourceId,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotCompositeResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        compositeResourceId: resourceId ?? null,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  setSlotMaskAutoEnabled: (id, index, enabled) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index]);
      const nextSlot: SlotState = {
        ...prev,
        maskAutoEnabled: enabled,
      };

      return {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
    });
  },

  clearSlot: (id, index) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const slots = { ...comp.slots };
      delete slots[index];

      return {
        ...state,
        components: {
          ...state.components,
          [id]: { ...comp, slots },
        },
      };
    });
  },

  getSlot: (id, index) => get().components[id]?.slots[index],
});
