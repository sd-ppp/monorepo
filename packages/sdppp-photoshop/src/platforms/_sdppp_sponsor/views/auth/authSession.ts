import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { initializeSupabaseFromSDPPPSB, clearSupabaseFromSDPPPSB } from '@sdppp/auth';
import { resolveTenantId } from '../../constants';

export type AuthSessionResult = {
  supabase: SupabaseClient;
  session: Session;
  tenantId: string;
};

let authListenerAttached = false;

export const attachSupabaseAuthListener = (
  client: SupabaseClient,
  handlers: {
    onSession: (session: Session) => void;
    onSignedOut: () => void;
  }
) => {
  if (authListenerAttached) return;
  authListenerAttached = true;
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session) {
      handlers.onSession(session);
      return;
    }
    if (event === 'SIGNED_OUT') {
      clearSupabaseFromSDPPPSB();
      authListenerAttached = false;
      handlers.onSignedOut();
    }
  });
};

export const resetAuthListener = () => {
  authListenerAttached = false;
};

export const ensureSupabaseSession = async (): Promise<AuthSessionResult> => {
  const tenantId = resolveTenantId();
  if (!tenantId) {
    throw new Error('未能解析租户信息');
  }
  const { client: supabase } = await initializeSupabaseFromSDPPPSB();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error(`Failed to get Supabase session: ${error?.message ?? 'Unknown error'}`);
  }
  return {
    supabase,
    session: data.session,
    tenantId,
  };
};
