import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';
import { sdpppSDK } from '@sdppp/common';

type SupabaseSession = {
  access_token: string;
  refresh_token?: string | null;
};

type SupabaseSessionResult = {
  client: SupabaseClient;
  session: SupabaseSession;
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

function getAccessTokenFromStore(): string | null {
  return sdpppSDK?.stores?.WebviewStore?.getState?.()?.token ?? null;
}

function getRefreshTokenFromStore(): string | null {
  return sdpppSDK?.stores?.WebviewStore?.getState?.()?.refreshToken ?? null;
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

    if (!isSupabaseJwt(token)) {
      throw new Error('Expected Supabase token in store; got non-Supabase token');
    }
    const refreshToken = getRefreshTokenFromStore();
    if (!refreshToken) {
      throw new Error('Supabase refresh token not found. User must login again.');
    }
    const session: SupabaseSession = { access_token: token, refresh_token: refreshToken };

    const { error: sessionError } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? undefined,
    });

    if (sessionError) {
      throw new Error(`Failed to set Supabase session: ${sessionError.message}`);
    }

    globalClient = client;
    sdpppSDK?.stores?.WebviewStore?.setState?.({ supabaseClientReadyAt: Date.now() });
    return { client, session };
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
}
