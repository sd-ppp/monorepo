import { create } from 'zustand';
import type { FormilySchema } from '../../schemaUtils';

export type SponsorSchemaState = {
  schema: FormilySchema | null;
  metadata: Record<string, any> | null;
  cancelable: boolean | null;
  schemaError: string | null;
  loadingSchema: boolean;
  setSchema: (schema: FormilySchema | null) => void;
  setMetadata: (metadata: Record<string, any> | null) => void;
  setCancelable: (cancelable: boolean | null) => void;
  setSchemaError: (error: string | null) => void;
  setLoadingSchema: (loading: boolean) => void;
  resetSchema: () => void;
};

const initialState = {
  schema: null,
  metadata: null,
  cancelable: null,
  schemaError: null,
  loadingSchema: false,
};

export const sponsorSchemaStore = create<SponsorSchemaState>((set) => ({
  ...initialState,
  setSchema: (schema) => set({ schema }),
  setMetadata: (metadata) => set({ metadata }),
  setCancelable: (cancelable) => set({ cancelable }),
  setSchemaError: (schemaError) => set({ schemaError }),
  setLoadingSchema: (loadingSchema) => set({ loadingSchema }),
  resetSchema: () => set({ ...initialState }),
}));
