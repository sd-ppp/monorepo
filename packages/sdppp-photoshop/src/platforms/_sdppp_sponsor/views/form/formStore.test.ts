import { describe, expect, it, beforeEach } from 'vitest';
import { sponsorFormStore } from './formStore';

describe('sponsorFormStore', () => {
  beforeEach(() => {
    sponsorFormStore.getState().resetFormValues();
  });

  it('updates form values and resets', () => {
    sponsorFormStore.getState().setCurrentValues({ prompt: 'hello' });
    expect(sponsorFormStore.getState().currentValues).toEqual({ prompt: 'hello' });

    sponsorFormStore.getState().resetFormValues();
    expect(sponsorFormStore.getState().currentValues).toEqual({});
  });
});
