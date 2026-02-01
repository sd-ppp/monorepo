import { create } from 'zustand';
import { createForm } from '@formily/core';
import type { Form } from '@formily/core';

export type CustomApiFormState = {
  form: Form;
  currentValues: Record<string, any>;
  setCurrentValues: (values: Record<string, any>) => void;
  resetFormValues: () => void;
};

const initialForm = createForm();

export const customapiFormStore = create<CustomApiFormState>((set, get) => ({
  form: initialForm,
  currentValues: {},
  setCurrentValues: (currentValues) => set({ currentValues }),
  resetFormValues: () => {
    const form = get().form;
    form.reset();
    form.setInitialValues({});
    form.setValues({});
    set({ currentValues: {} });
  },
}));
