import { StateCreator } from 'zustand';
import { ImageComponentState } from './types';

export interface ComponentSlice {
  components: Record<string, ImageComponentState>;
  registerComponent: (id: string, config: { maxCount: number; isMask: boolean; urls: string[] }) => void;
  unregisterComponent: (id: string) => void;
  updateUrls: (id: string, urls: string[]) => void;
  getComponent: (id: string) => ImageComponentState | undefined;
}

export const createComponentSlice: StateCreator<ComponentSlice, [], [], ComponentSlice> = (set, get) => ({
  components: {},

  registerComponent: (id, config) => {
    set(state => {
      const existing = state.components[id];
      const urls = config.urls || [];

      return {
        components: {
          ...state.components,
          [id]: {
            id,
            maxCount: config.maxCount,
            isMask: config.isMask,
            urls,
            slots: existing?.slots || {},
          },
        },
      };
    });
  },

  unregisterComponent: (id) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      const next = { ...state.components };
      delete next[id];

      return { components: next };
    });
  },

  updateUrls: (id, urls) => {
    set(state => {
      const comp = state.components[id];
      if (!comp) return state;

      return {
        components: {
          ...state.components,
          [id]: { ...comp, urls: urls || [] },
        },
      };
    });
  },

  getComponent: (id) => get().components[id],
});
