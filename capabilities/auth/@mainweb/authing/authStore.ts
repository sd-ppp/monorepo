// Auth helper functions that operate directly on WebviewStore
// No separate zustand store needed - WebviewStore IS the auth store

import { sdpppSDK } from '@sdppp/common';
import { createSDPPPXServices } from '@sdppp/sdpppx-services';
import { SUPABASE_CONFIG } from '../supabase/config';
import { clearSupabaseFromSDPPPSB, getSupabaseClientFromSDPPPSB, initializeSupabaseFromSDPPPSB } from '../supabase/sdppp-sb-session';
import { supabaseSessionStore } from '../supabase/session-store';

const AUTH_STORAGE_KEY = 'sdppp-auth-storage';

interface AuthData {
  isLogin: boolean;
  token: string;
  refreshToken?: string;
  userInfo: Record<string, any>;
  isGuest: boolean;
}

async function refreshBalanceWithSupabase() {
  const tenantId = typeof SUPABASE_CONFIG.tenantId === 'string' ? SUPABASE_CONFIG.tenantId.trim() : '';
  if (!tenantId) {
    console.warn('[authActions] tenantId missing, skip balance refresh');
    return;
  }

  const session = supabaseSessionStore.getState().session;
  if (!session) {
    console.warn('[authActions] session missing, skip balance refresh');
    return;
  }

  const client = getSupabaseClientFromSDPPPSB();
  if (!client) {
    console.warn('[authActions] supabase client missing, skip balance refresh');
    return;
  }

  try {
    console.log('[authActions] refresh balance via services');
    const services = createSDPPPXServices({
      baseUrl: 'http://localhost',
      supabase: {
        getClient: async () => client,
      },
    });
    const result = await services.fetchBalance(undefined, tenantId);
    const balance = typeof result.balance === 'number' ? result.balance : null;
    console.log('[authActions] balance result', balance);
    sdpppSDK?.stores?.WebviewStore?.setState({ balance });
  } catch (error) {
    console.warn('[authActions] refresh balance failed', error);
    sdpppSDK?.stores?.WebviewStore?.setState({ balance: null });
  }
}

// Helper functions to update WebviewStore auth state
export const authActions = {
  setAuthState: (auth: Partial<AuthData & { loginMessage?: string }>) => {
    console.log('[authActions] setAuthState:', auth);
    const prevState = sdpppSDK.stores.WebviewStore.getState();
    sdpppSDK.stores.WebviewStore.setState(auth);
    const nextToken = auth.token ?? prevState.token;
    const nextRefreshToken = (auth as any).refreshToken ?? (prevState as any).refreshToken;
    const tokenChanged = nextToken !== prevState.token || nextRefreshToken !== (prevState as any).refreshToken;
    const hasClient = !!getSupabaseClientFromSDPPPSB();
    if (!nextToken) {
      clearSupabaseFromSDPPPSB();
      sdpppSDK?.stores?.WebviewStore?.setState({ balance: null });
    } else if (tokenChanged || !hasClient) {
      clearSupabaseFromSDPPPSB();
      initializeSupabaseFromSDPPPSB().then(() => {
        return refreshBalanceWithSupabase();
      }).catch((error) => {
        console.error('[authActions] initialize supabase failed:', error);
      });
    }
    // Persist to storage (exclude loginMessage)
    const { loginMessage, ...persistData } = auth;
    if (Object.keys(persistData).length > 0) {
      authActions.persistAuth();
    }
  },

  clearAuth: () => {
    const clearedState = {
      isLogin: false,
      token: '',
      refreshToken: '',
      userInfo: {},
      isGuest: false,
      loginMessage: '',
    };
    sdpppSDK.stores.WebviewStore.setState(clearedState);
    clearSupabaseFromSDPPPSB();
    sdpppSDK?.stores?.WebviewStore?.setState({ balance: null });
    authActions.persistAuth();
  },

  setLoginMessage: (message: string) => {
    sdpppSDK.stores.WebviewStore.setState({ loginMessage: message });
  },

  // Persist current auth state to UXP storage
  persistAuth: async () => {
    try {
      if (!sdpppSDK?.plugins?.photoshop) {
        return;
      }
      const state = sdpppSDK.stores.WebviewStore.getState();
      const authData: AuthData = {
        isLogin: state.isLogin,
        token: state.token,
        refreshToken: (state as any).refreshToken,
        userInfo: state.userInfo,
        isGuest: state.isGuest,
      };
      await sdpppSDK.plugins.photoshop.setStorage({
        key: AUTH_STORAGE_KEY,
        value: JSON.stringify({ state: authData })
      });
    } catch (error) {
      console.error('[authActions] persistAuth error:', error);
    }
  },

  // Load auth state from UXP storage
  loadAuth: async (): Promise<AuthData | null> => {
    try {
      if (!sdpppSDK?.plugins?.photoshop) {
        return null;
      }
      const result = await sdpppSDK.plugins.photoshop.getStorage({ key: AUTH_STORAGE_KEY });
      if (result.error || !result.value) return null;
      const parsed = JSON.parse(result.value);
      return parsed.state || null;
    } catch (error) {
      console.error('[authActions] loadAuth error:', error);
      return null;
    }
  },

  // Initialize auth state from storage
  initAuth: async () => {
    // Load saved auth from storage
    const savedAuth = await authActions.loadAuth();
    if (savedAuth) {
      sdpppSDK.stores.WebviewStore.setState(savedAuth);
    }
  }
};

// For backward compatibility - hook that returns actions
export function useAuthStore() {
  return {
    setAuthState: authActions.setAuthState,
    clearAuth: authActions.clearAuth,
    setLoginMessage: authActions.setLoginMessage,
  };
}
