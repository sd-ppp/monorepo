import { create } from 'zustand';
import { createComponentSlice, type ComponentSlice } from './component-slice';
import { createSlotSlice, type SlotSlice } from './slot-slice';
import { createThumbnailSlice, type ThumbnailSlice } from './thumbnail-slice';
export type GlobalImageStoreState = ComponentSlice & SlotSlice & ThumbnailSlice;

export const GlobalImageStore = create<GlobalImageStoreState>((...args) => ({
  ...createComponentSlice(...args),
  ...createSlotSlice(...args),
  ...createThumbnailSlice(...args),
}));
