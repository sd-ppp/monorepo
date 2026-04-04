import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';
import { sdpppSDK } from '@sdppp/common';
import { supabaseSessionStore } from './session-store';

type SupabaseSessionResult = {
  client: SupabaseClient;
  session: Session;
};

type SupabaseBridgeResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: unknown;
};

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
};

let globalClient: SupabaseClient | null = null;
let globalInitPromise: Promise<SupabaseSessionResult> | null = null;

function getSDK(): typeof sdpppSDK | undefined {
  return sdpppSDK ?? (globalThis as typeof globalThis & { sdpppSDK?: typeof sdpppSDK }).sdpppSDK;
}

function getAccessTokenFromStore(): string | null {
  const sdk = getSDK();
  return sdk?.stores?.WebviewStore?.getState?.()?.token ?? null;
}

function getRefreshTokenFromStore(): string | null {
  const sdk = getSDK();
  return sdk?.stores?.WebviewStore?.getState?.()?.refreshToken ?? null;
}

function isSupabaseJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1]));
    return payload?.iss?.includes('supabase') || !!payload?.role;
  } catch {
    return false;
  }
}

async function exchangeAuthingToken(
  client: SupabaseClient,
  authingToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data, error } = await client.functions.invoke(SUPABASE_CONFIG.bridgeFunctionName, {
    body: {
      token: authingToken,
      tenantId: SUPABASE_CONFIG.tenantId,
      nonce: undefined,
    },
    region: SUPABASE_CONFIG.bridgeRegion,
  });

  if (error) {
    throw new Error(`Failed to exchange Authing token: ${error.message}`);
  }

  const response = data as SupabaseBridgeResponse | null;
  if (!response?.access_token || !response?.refresh_token) {
    throw new Error('Invalid response from authing-bridge3: missing tokens');
  }

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
  };
}

export async function initializeSupabaseFromSDPPPSB(): Promise<SupabaseSessionResult> {
  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
    throw new Error('Supabase config is missing url/anonKey');
  }

  if (globalInitPromise) return globalInitPromise;

  globalInitPromise = (async () => {
    const token = getAccessTokenFromStore();
    if (!token) {
      throw new Error('Auth token not found. User must login first.');
    }

    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        storage: createMemoryStorage(),
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    let accessToken = token;
    let refreshToken = getRefreshTokenFromStore();

    if (isSupabaseJwt(token)) {
      if (!refreshToken) {
        throw new Error('Supabase refresh token not found. User must login again.');
      }
    } else {
      const exchanged = await exchangeAuthingToken(client, token);
      accessToken = exchanged.accessToken;
      refreshToken = exchanged.refreshToken;
    }

    const { data, error: sessionError } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
    });

    if (sessionError) {
      throw new Error(`Failed to set Supabase session: ${sessionError.message}`);
    }

    globalClient = client;
    supabaseSessionStore.getState().setSession(data.session ?? null);
    getSDK()?.stores?.WebviewStore?.setState?.({ supabaseClientReadyAt: Date.now() });
    if (!data.session) {
      throw new Error('Supabase session missing after setSession');
    }
    return { client, session: data.session };
  })();

  try {
    return await globalInitPromise;
  } finally {
    globalInitPromise = null;
  }
}

export function getSupabaseClientFromSDPPPSB(): SupabaseClient | null {
  return globalClient;
}

export function clearSupabaseFromSDPPPSB() {
  globalClient = null;
  globalInitPromise = null;
  supabaseSessionStore.getState().setSession(null);
}
