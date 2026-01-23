import { create } from 'zustand';
import { createComponentSlice, type ComponentSlice } from './component-slice';
import { createSlotSlice, type SlotSlice } from './slot-slice';

export type GlobalImageStoreState = ComponentSlice & SlotSlice;

export const GlobalImageStore = create<GlobalImageStoreState>((...args) => ({
  ...createComponentSlice(...args),
  ...createSlotSlice(...args),
}));
