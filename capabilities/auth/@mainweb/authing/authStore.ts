// Auth helper functions that operate directly on WebviewStore
// No separate zustand store needed - WebviewStore IS the auth store

import { sdpppSDK } from '@sdppp/common';

const AUTH_STORAGE_KEY = 'sdppp-auth-storage';

interface AuthData {
  isLogin: boolean;
  token: string;
  userInfo: Record<string, any>;
  isGuest: boolean;
}

// Helper functions to update WebviewStore auth state
export const authActions = {
  setAuthState: (auth: Partial<AuthData & { loginMessage?: string }>) => {
    sdpppSDK.stores.WebviewStore.setState(auth);
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
      userInfo: {},
      isGuest: false,
      loginMessage: '',
    };
    sdpppSDK.stores.WebviewStore.setState(clearedState);
    authActions.persistAuth();
  },

  setLoginMessage: (message: string) => {
    sdpppSDK.stores.WebviewStore.setState({ loginMessage: message });
  },

  // Persist current auth state to UXP storage
  persistAuth: async () => {
    try {
      const state = sdpppSDK.stores.WebviewStore.getState();
      const authData: AuthData = {
        isLogin: state.isLogin,
        token: state.token,
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
