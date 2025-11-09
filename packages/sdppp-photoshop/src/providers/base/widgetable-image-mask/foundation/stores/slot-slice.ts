import { StateCreator } from 'zustand';
import { sdpppSDK } from '@sdppp/common';
import { buildBoundaryUri, buildImageContentUri, buildMaskContentUri } from '../../../realtime-thumbnail/utils';
import type { ComponentSlice } from './component-slice';
import type { AutoSyncConfig, BoundaryUri, ContentUri, MaskUri, SlotState } from './types';

export interface SlotSlice {
  setSlotPrimaryConfig: (
    id: string,
    index: number,
    config: AutoSyncConfig | null
  ) => void;
  setSlotPrimaryAutoEnabled: (id: string, index: number, enabled: boolean) => void;
  setSlotUploading: (id: string, index: number, uploading: boolean, uploadId?: string | null) => void;
  setSlotPrimaryResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  setSlotMaskResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  markSlotCompositeDirty: (id: string, index: number, dirty?: boolean) => void;
  setSlotContentUri: (id: string, index: number, uri: ContentUri | null | undefined) => void;
  setSlotBoundaryUri: (id: string, index: number, uri: BoundaryUri | null | undefined) => void;
  setSlotMaskUri: (id: string, index: number, uri: MaskUri | null | undefined) => void;
  setSlotFileUri: (id: string, index: number, uri: string | null | undefined) => void;
  setSlotCompositeResource: (id: string, index: number, resourceId: string | null | undefined) => void;
  setSlotMaskAutoEnabled: (id: string, index: number, enabled: boolean) => void;
  clearSlot: (id: string, index: number) => void;
  getSlot: (id: string, index: number) => SlotState | undefined;
}

type SlotStore = ComponentSlice & SlotSlice;

// Initialize a slot with default track type based on component nature
const ensureSlot = (slot?: SlotState, defaultTrackType: 'image' | 'mask' = 'image'): SlotState =>
  slot ?? {
    primaryTrackType: defaultTrackType,
    primaryDocId: null,
    contentUri: null,
    boundaryUri: null,
    maskUri: null,
    fileUri: null,
    primaryAutoEnabled: false,
    maskAutoEnabled: false,
  };

export const createSlotSlice: StateCreator<SlotStore, [], [], SlotSlice> = (set, get) => {
  const rawLogger = sdpppSDK?.logger?.extend?.('image-mask-store');
  const safeLog = (event: string, payload: unknown) => {
    try {
      rawLogger?.(event, payload as any);
    } catch {
      // noop
    }
  };
  return {
  setSlotPrimaryConfig: (id, index, config) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      let nextSlot: SlotState;

      if (!config) {
        nextSlot = {
          ...prev,
          contentUri: null,
          boundaryUri: null,
          maskUri: null,
          primaryDocId: null,
          primaryAutoEnabled: false,
        };
      } else {
        // Do not modify primaryTrackType after initialization
        const fallbackDocId = prev.primaryDocId ?? 0;
        const rawDocId = config.docId;
        const docId =
          Number.isFinite(rawDocId) && typeof rawDocId === 'number'
            ? Math.max(0, Math.floor(rawDocId))
            : fallbackDocId;
        const contentUri = buildImageContentUri(docId, config.content, config.layerIdentify ?? null);
        const boundaryUri = buildBoundaryUri(docId, config.boundary ?? null);
        const maskUri = buildMaskContentUri(docId, config.content, config.layerIdentify ?? null);

        nextSlot = {
          ...prev,
          primaryDocId: docId,
          contentUri,
          boundaryUri,
          maskUri,
          fileUri: null,
        };
      }

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotPrimaryConfig', {
        id,
        index,
        hadPrev: !!comp.slots[index],
        next: {
          hasContentUri: !!(nextSlot as any).contentUri,
          hasBoundaryUri: !!(nextSlot as any).boundaryUri,
          hasMaskUri: !!(nextSlot as any).maskUri,
          primaryDocId: (nextSlot as any).primaryDocId ?? null,
        },
      });
      return nextState;
    });
  },
  setSlotPrimaryAutoEnabled: (id, index, enabled) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        primaryAutoEnabled: enabled,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotPrimaryAutoEnabled', { id, index, enabled });
      return nextState;
    });
  },
  setSlotUploading: (id, index, uploading, uploadId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = { ...prev, uploading, uploadId };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotUploading', { id, index, uploading, uploadId: uploadId ?? null });
      return nextState;
    });
  },

  setSlotPrimaryResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        primaryResourceId: resourceId ?? null,
        compositeDirty: resourceId !== prev.primaryResourceId ? true : prev.compositeDirty,
        compositeResourceId: resourceId !== prev.primaryResourceId ? null : prev.compositeResourceId,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotPrimaryResource', {
        id,
        index,
        prevPrimary: prev.primaryResourceId ?? null,
        nextPrimary: nextSlot.primaryResourceId ?? null,
        compositeDirty: nextSlot.compositeDirty ?? false,
        clearedComposite: nextSlot.compositeResourceId === null && prev.compositeResourceId && prev.compositeResourceId !== nextSlot.compositeResourceId,
      });
      return nextState;
    });
  },

  setSlotMaskResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        maskResourceId: resourceId ?? null,
        compositeDirty: resourceId !== prev.maskResourceId ? true : prev.compositeDirty,
        compositeResourceId: resourceId !== prev.maskResourceId ? null : prev.compositeResourceId,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotMaskResource', {
        id,
        index,
        prevMask: prev.maskResourceId ?? null,
        nextMask: nextSlot.maskResourceId ?? null,
        compositeDirty: nextSlot.compositeDirty ?? false,
        clearedComposite: nextSlot.compositeResourceId === null && prev.compositeResourceId && prev.compositeResourceId !== nextSlot.compositeResourceId,
      });
      return nextState;
    });
  },

  markSlotCompositeDirty: (id, index, dirty = true) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        compositeDirty: dirty,
        compositeResourceId: dirty ? null : prev.compositeResourceId,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('markSlotCompositeDirty', {
        id,
        index,
        dirty,
      });
      return nextState;
    });
  },

  setSlotContentUri: (id, index, uri) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        contentUri: uri ?? null,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotContentUri', { id, index, hasContentUri: !!nextSlot.contentUri });
      return nextState;
    });
  },

  setSlotBoundaryUri: (id, index, uri) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        boundaryUri: uri ?? null,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotBoundaryUri', { id, index, hasBoundaryUri: !!nextSlot.boundaryUri });
      return nextState;
    });
  },

  setSlotMaskUri: (id, index, uri) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        maskUri: uri ?? null,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotMaskUri', { id, index, hasMaskUri: !!nextSlot.maskUri });
      return nextState;
    });
  },

  setSlotFileUri: (id, index, uri) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        fileUri: uri ?? null,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotFileUri', { id, index, hasFileUri: !!nextSlot.fileUri });
      return nextState;
    });
  },

  setSlotCompositeResource: (id, index, resourceId) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        compositeResourceId: resourceId ?? null,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotCompositeResource', {
        id,
        index,
        hasComposite: !!nextSlot.compositeResourceId,
      });
      return nextState;
    });
  },

  setSlotMaskAutoEnabled: (id, index, enabled) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const prev = ensureSlot(comp.slots[index], comp.isMask ? 'mask' : 'image');
      const nextSlot: SlotState = {
        ...prev,
        maskAutoEnabled: enabled,
      };

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: {
            ...comp,
            slots: { ...comp.slots, [index]: nextSlot },
          },
        },
      };
      safeLog('setSlotMaskAutoEnabled', { id, index, enabled });
      return nextState;
    });
  },

  clearSlot: (id, index) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const slots = { ...comp.slots };
      delete slots[index];

      const nextState = {
        ...state,
        components: {
          ...state.components,
          [id]: { ...comp, slots },
        },
      };
      safeLog('clearSlot', { id, index });
      return nextState;
    });
  },

  getSlot: (id, index) => get().components[id]?.slots[index],
  };
};
