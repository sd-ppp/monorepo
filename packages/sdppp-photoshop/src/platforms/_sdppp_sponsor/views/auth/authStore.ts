import type { SDPPPXServices } from '@sdppp/sdpppx-services';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { SDPPPSponsor } from '../../client';

export type SponsorAuthState = {
  authLoading: boolean;
  authError: string | null;
  supabaseSession: Session | null;
  supabaseClient: SupabaseClient | null;
  tenantId: string | null;
  services: SDPPPXServices | null;
  client: SDPPPSponsor | null;
  setAuthLoading: (loading: boolean) => void;
  setAuthError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setSupabaseClient: (client: SupabaseClient | null) => void;
  setTenantId: (tenantId: string | null) => void;
  setServices: (services: SDPPPXServices | null) => void;
  setClient: (client: SDPPPSponsor | null) => void;
  resetAuthState: () => void;
};

const initialState = {
  authLoading: false,
  authError: null,
  supabaseSession: null,
  supabaseClient: null,
  tenantId: null,
  services: null,
  client: null,
};

export const sponsorAuthStore = create<SponsorAuthState>((set) => ({
  ...initialState,
  setAuthLoading: (authLoading) => set({ authLoading }),
  setAuthError: (authError) => set({ authError }),
  setSession: (supabaseSession) => set({ supabaseSession }),
  setSupabaseClient: (supabaseClient) => set({ supabaseClient }),
  setTenantId: (tenantId) => set({ tenantId }),
  setServices: (services) => set({ services }),
  setClient: (client) => set({ client }),
  resetAuthState: () => set({ ...initialState }),
}));
