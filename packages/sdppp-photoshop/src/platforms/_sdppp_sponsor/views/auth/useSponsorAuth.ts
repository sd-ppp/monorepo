import { sdpppSDK, t } from '@sdppp/common';
import type { HeadersResolver } from '@sdppp/sdpppx-services';
import { supabaseSessionStore } from '@sdppp/auth';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { SDPPP_SPONSOR_BASE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../constants';
import { sponsorExecutionStore } from '../form/executionStore';
import { sponsorFormStore } from '../form/formStore';
import { sponsorHistoryStore } from '../history/historyStore';
import { sponsorSchemaStore } from '../schema/schemaStore';
import { sponsorTemplateStore } from '../templates/templateStore';
import { sponsorUiStore } from '../uiStore';
import { attachSupabaseAuthListener, ensureSupabaseSession, resetAuthListener } from './authSession';
import { sponsorAuthStore } from './authStore';
import { createSponsorClient } from './sponsorClient';
import { createTaskrouterServices } from './taskrouterServices';

export const useSponsorAuth = () => {
  const isLogin = useStore(sdpppSDK.stores.WebviewStore, (state: any) => state.isLogin);
  const authToken = useStore(sdpppSDK.stores.WebviewStore, (state: any) => state.token);
  const supabaseSession = useStore(supabaseSessionStore, (state) => state.session);

  useEffect(() => {
    if (!isLogin) {
      sponsorUiStore.getState().setInitialized(false);
      sponsorUiStore.getState().setBalanceLoading(false);
      sponsorUiStore.getState().setHasFetchedBalance(false);
      sponsorAuthStore.getState().resetAuthState();
      sponsorTemplateStore.getState().resetTemplates();
      sponsorSchemaStore.getState().resetSchema();
      sponsorFormStore.getState().resetFormValues();
      sponsorHistoryStore.getState().resetHistory();
      sponsorExecutionStore.getState().resetExecution();
      resetAuthListener();
      return;
    }

    const ensureAuth = async () => {
      const authState = sponsorAuthStore.getState();
      if (authState.authLoading) return;
      if (authState.client && authState.supabaseClient && supabaseSessionStore.getState().session) return;

      const baseUrl = SDPPP_SPONSOR_BASE_URL;
      const supabaseUrl = SUPABASE_URL;
      const supabaseAnonKey = SUPABASE_ANON_KEY;
      if (!baseUrl || !supabaseUrl || !supabaseAnonKey) {
        const missing: string[] = [];
        if (!baseUrl) missing.push(t('taskrouter.config.base_url'));
        if (!supabaseUrl) missing.push(t('taskrouter.config.supabase_url'));
        if (!supabaseAnonKey) missing.push(t('taskrouter.config.supabase_anon_key'));
        const separator = t('common.list_separator');
        sponsorAuthStore
          .getState()
          .setAuthError(
            t('taskrouter.error.remote_config_missing', {
              missing: missing.join(separator),
            })
          );
        return;
      }

      sponsorAuthStore.getState().setAuthLoading(true);
      sponsorAuthStore.getState().setAuthError(null);

      try {
        const { supabase, session, tenantId } = await ensureSupabaseSession();

        attachSupabaseAuthListener(supabase, {
          onSession: (nextSession) => sponsorAuthStore.getState().setSession(nextSession),
          onSignedOut: () => {
            sponsorAuthStore.getState().resetAuthState();
            sponsorUiStore.getState().setInitialized(false);
          },
        });

        const resolveAuthHeaders: HeadersResolver = async () => {
          const currentSession = supabaseSessionStore.getState().session;
          const token = currentSession?.access_token;
          if (!token) {
            const fallbackUserId = currentSession?.user?.id ?? session.user?.id ?? '';
            return { Authorization: `Bearer ${fallbackUserId}` };
          }
          return { Authorization: `Bearer ${token}` };
        };

        const services = createTaskrouterServices({
          baseUrl,
          headers: resolveAuthHeaders,
          supabase: {
            getClient: async () => supabase,
          },
        });

        const client = createSponsorClient({
          baseUrl,
          headers: resolveAuthHeaders,
          services,
          getTenantId: () => sponsorAuthStore.getState().tenantId,
        });

        sponsorAuthStore.getState().setSupabaseClient(supabase);
        sponsorAuthStore.getState().setSession(supabaseSessionStore.getState().session ?? session);
        sponsorAuthStore.getState().setTenantId(tenantId);
        sponsorAuthStore.getState().setServices(services);
        sponsorAuthStore.getState().setClient(client);
        sponsorUiStore.getState().setInitialized(true);
      } catch (error: any) {
        sponsorAuthStore.getState().setAuthError(error?.message ?? String(error));
      } finally {
        sponsorAuthStore.getState().setAuthLoading(false);
      }
    };

    void ensureAuth();
  }, [isLogin, authToken]);

  useEffect(() => {
    sponsorAuthStore.getState().setSession(supabaseSession);
  }, [supabaseSession]);
};
