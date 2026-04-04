import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import z from 'zod';
import { sdpppSDK } from '@sdppp/common';
import { authActions } from './authStore';
import { initializeSupabaseFromSDPPPSB } from '../supabase/sdppp-sb-session';
import {
  UXPAuthLoginRequestSchema,
  UXPAuthRegisterRequestSchema,
} from '@sdppp/mcp-mesh-photoshop/actions/uxp-auth-defs';

export type RegisterParams = z.infer<typeof UXPAuthRegisterRequestSchema>;
export type LoginParams = z.infer<typeof UXPAuthLoginRequestSchema>;

export type SendPassCodeParams = {
  phone?: string;
  email?: string;
};

export interface LoginProvider {
  intervalCheck(token: string): Promise<{
    loginValid: boolean;
    nextCheckTime: number;
  }>;
  validateToken(token: string): Promise<{
    username?: string;
    email?: string;
  }>;
  register(params: RegisterParams): Promise<void>;
  login(params: LoginParams): Promise<{
    token: string;
    refreshToken?: string | null;
  }>;
  isQRCodeSupported(): boolean;
  loginByQRCode(): AsyncGenerator<{
    qrcodeURL: string;
    status: string;
    userInfo?: any;
  }>;
  isPhoneLoginSupported(): boolean;
  sendPassCode(params: SendPassCodeParams): Promise<void>;
  getUserProfile(token: string): Promise<{
    username?: string;
    email?: string;
    [key: string]: any;
  }>;
}

let loginProvider: LoginProvider | null = null;

function requireProvider(): LoginProvider {
  if (!loginProvider) {
    throw new Error('AuthService provider is not set');
  }
  return loginProvider;
}

export const AuthService = {
  setProvider(provider: LoginProvider) {
    loginProvider = provider;
  },
  getProvider() {
    return loginProvider;
  },
  requireProvider,
  login(params: LoginParams) {
    return requireProvider().login(params);
  },
  register(params: RegisterParams) {
    return requireProvider().register(params);
  },
  sendPassCode(params: SendPassCodeParams) {
    return requireProvider().sendPassCode(params);
  },
  loginByQRCode() {
    return requireProvider().loginByQRCode();
  },
  validateToken(token: string) {
    return requireProvider().validateToken(token);
  },
  intervalCheck(token: string) {
    return requireProvider().intervalCheck(token);
  },
  getUserProfile(token: string) {
    return requireProvider().getUserProfile(token);
  },
};

export async function restoreAuthSession(providers: LoginProvider[] = []) {
  await authActions.initAuth();

  const currentToken = sdpppSDK?.stores?.WebviewStore?.getState?.()?.token;
  if (!currentToken) {
    authActions.clearAuth();
    return;
  }

  if (providers.length === 0) {
    const activeProvider = AuthService.getProvider();
    if (!activeProvider) {
      authActions.clearAuth();
      return;
    }
    try {
      const userInfo = await activeProvider.getUserProfile(currentToken);
      authActions.setAuthState({
        isLogin: true,
        token: currentToken,
        userInfo: userInfo,
        isGuest: false,
      });
    } catch {
      authActions.clearAuth();
    }
    return;
  }

  for (const provider of providers) {
    try {
      const userInfo = await provider.getUserProfile(currentToken);
      AuthService.setProvider(provider);
      authActions.setAuthState({
        isLogin: true,
        token: currentToken,
        userInfo: userInfo,
        isGuest: false,
      });
      return;
    } catch {
      // try next provider
    }
  }

  authActions.clearAuth();
}

interface AuthProviderProps {
  children: ReactNode;
  provider?: LoginProvider;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, provider }) => {
  const [initialized, setInitialized] = useState(false);
  const token = useStore(sdpppSDK.stores.WebviewStore, (state) => (state as any).token);

  useEffect(() => {
    if (provider) {
      AuthService.setProvider(provider);
    }
  }, [provider]);

  // 启动时从存储加载 auth 状态并验证 token
  useEffect(() => {
    async function initAuth() {
      await authActions.initAuth();

      const currentToken = sdpppSDK.stores.WebviewStore.getState().token;

      if (!currentToken) {
        setInitialized(true);
        return;
      }

      try {
        await initializeSupabaseFromSDPPPSB();
      } catch (error) {
        console.warn('[AuthProvider] Supabase session init failed:', error);
      }

      const activeProvider = AuthService.getProvider();
      if (!activeProvider) {
        setInitialized(true);
        return;
      }

      try {
        const userInfo = await activeProvider.getUserProfile(currentToken);
        console.log('[AuthProvider] Token validated successfully');

        authActions.setAuthState({
          isLogin: true,
          token: currentToken,
          userInfo: userInfo,
          isGuest: false,
        });
      } catch (error) {
        console.error('[AuthProvider] Token validation failed:', error);
        authActions.clearAuth();
      } finally {
        setInitialized(true);
      }
    }

    initAuth();
  }, []);

  // 周期性多端登录检测
  useEffect(() => {
    if (!token) return;

    const activeProvider = AuthService.getProvider();
    if (!activeProvider) return;

    let timeoutId: NodeJS.Timeout;

    async function checkLogin() {
      try {
        const { loginValid, nextCheckTime } = await activeProvider.intervalCheck(token);

        if (!loginValid) {
          console.warn('[AuthProvider] Multi-device login detected, logging out');
          authActions.clearAuth();
          authActions.setLoginMessage('检测到其他设备登录，已自动退出');
          return;
        }

        timeoutId = setTimeout(checkLogin, nextCheckTime);
      } catch (error) {
        console.error('[AuthProvider] Login check failed:', error);
        timeoutId = setTimeout(checkLogin, 15000);
      }
    }

    timeoutId = setTimeout(checkLogin, 10000);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [token]);

  if (!initialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#666',
        }}
      >
        Loading...
      </div>
    );
  }

  return <>{children}</>;
};
