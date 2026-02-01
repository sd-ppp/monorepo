import { beforeEach, describe, expect, it } from 'vitest';
import { sponsorAuthStore } from './authStore';

describe('sponsorAuthStore', () => {
  beforeEach(() => {
    sponsorAuthStore.getState().resetAuthState();
  });

  it('updates auth fields and resets', () => {
    sponsorAuthStore.getState().setAuthLoading(true);
    sponsorAuthStore.getState().setAuthError('oops');
    sponsorAuthStore.getState().setTenantId('tenant-1');

    const state = sponsorAuthStore.getState();
    expect(state.authLoading).toBe(true);
    expect(state.authError).toBe('oops');
    expect(state.tenantId).toBe('tenant-1');

    state.resetAuthState();
    const resetState = sponsorAuthStore.getState();
    expect(resetState.authLoading).toBe(false);
    expect(resetState.authError).toBe(null);
    expect(resetState.tenantId).toBe(null);
  });
});
