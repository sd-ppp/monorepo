import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { t } from '@sdppp/common';
import {
  clearSupabaseFromSDPPPSB,
  getSupabaseClientFromSDPPPSB,
  initializeSupabaseFromSDPPPSB,
  supabaseSessionStore,
} from '@sdppp/auth';
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
      supabaseSessionStore.getState().setSession(session);
      handlers.onSession(session);
      return;
    }
    if (event === 'SIGNED_OUT') {
      clearSupabaseFromSDPPPSB();
      supabaseSessionStore.getState().setSession(null);
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
    throw new Error(t('taskrouter.error.tenant_unresolved'));
  }
  const existingClient = getSupabaseClientFromSDPPPSB();
  const storedSession = supabaseSessionStore.getState().session;
  if (existingClient && storedSession) {
    return { supabase: existingClient, session: storedSession, tenantId };
  }
  const { client: supabase, session } = await initializeSupabaseFromSDPPPSB();
  const resolvedSession = session ?? supabaseSessionStore.getState().session;
  if (!resolvedSession) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw new Error(
        t('taskrouter.error.supabase_session_failed', {
          error: error?.message ?? t('common.error.unknown'),
        })
      );
    }
    supabaseSessionStore.getState().setSession(data.session);
    return { supabase, session: data.session, tenantId };
  }
  return {
    supabase,
    session: resolvedSession,
    tenantId,
  };
};
