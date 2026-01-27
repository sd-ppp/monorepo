import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';
import type { SupabaseSessionResult, SupabaseInitOptions } from './types';

// 全局单例
let supabaseClient: SupabaseClient | null = null;
let currentSession: Session | null = null;
let currentUserId: string | null = null;

/**
 * 创建内存存储
 * 从 taskrouter 迁移,用于非持久化的会话存储
 */
function createMemoryStorage() {
  const store: Map<string, string> = new Map();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  };
}

/**
 * 初始化 Supabase 会话
 * 通过 authing-bridge3 将 Authing token 转换为 Supabase token
 * 
 * @param options - 初始化选项
 * @returns Supabase 会话结果
 * 
 * @example
 * ```typescript
 * // 自动从 mcpMesh 获取 token
 * await initializeSupabase();
 * 
 * // 手动传入 token
 * await initializeSupabase({ 
 *   authingToken: 'your-token',
 *   tenantId: 'your-tenant-id' 
 * });
 * ```
 */
export async function initializeSupabase(
  options: SupabaseInitOptions = {}
): Promise<SupabaseSessionResult> {
  // 1. 获取 Authing token
  let authingToken = options.authingToken;
  if (!authingToken) {
    const sdkToken = sdpppSDK?.stores?.WebviewStore?.getState?.()?.token;
    authingToken = sdkToken;
    if (!authingToken) {
      throw new Error('Authing token not found. User must login first.');
    }
  }

  // 2. 获取配置
  const tenantId = options.tenantId || SUPABASE_CONFIG.tenantId;

  // 3. 创建 Supabase 客户端 (此时还未认证)
  const client = createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        storage: createMemoryStorage(),
        autoRefreshToken: true,
        persistSession: false,
      },
    }
  );

  // 4. 调用 authing-bridge3 Edge Function 转换 token
  const bridgeTenantId = '65b95867-1c57-42ed-baa5-849a89790b51';
  const { data: bridgeData, error: bridgeError } = await client.functions.invoke(
    SUPABASE_CONFIG.bridgeFunctionName,
    {
      body: {
        token: authingToken,
        tenantId: bridgeTenantId,
        nonce: undefined,
      },
      region: SUPABASE_CONFIG.bridgeRegion,
    }
  );

  if (bridgeError) {
    throw new Error(`Failed to exchange Authing token: ${bridgeError.message}`);
  }

  if (!bridgeData?.access_token || !bridgeData?.refresh_token) {
    throw new Error('Invalid response from authing-bridge3: missing tokens');
  }

  // 5. 使用返回的 token 设置 Supabase 会话
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: bridgeData.access_token,
    refresh_token: bridgeData.refresh_token,
  });

  if (sessionError || !sessionData.session) {
    throw new Error(`Failed to set Supabase session: ${sessionError?.message || 'Unknown error'}`);
  }

  // 6. 获取用户信息
  const { data: userData, error: userError } = await client.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error(`Failed to get user info: ${userError?.message || 'Unknown error'}`);
  }

  // 7. 保存到全局单例
  supabaseClient = client;
  currentSession = sessionData.session;
  currentUserId = userData.user.id;

  // 8. 监听 token 自动刷新和登出事件
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session) {
      currentSession = session;
      console.log('[Supabase] Session token refreshed');
    } else if (event === 'SIGNED_OUT') {
      clearSupabase();
      console.log('[Supabase] Session signed out');
    }
  });

  console.log('[Supabase] Session initialized successfully for user:', userData.user.id);

  return {
    client,
    session: sessionData.session,
    userId: userData.user.id,
  };
}

/**
 * 获取当前的 Supabase 客户端
 * 
 * @returns Supabase 客户端实例
 * @throws 如果未初始化
 * 
 * @example
 * ```typescript
 * const client = getSupabaseClient();
 * const { data } = await client.from('some_table').select('*');
 * ```
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initializeSupabase() first.');
  }
  return supabaseClient;
}

/**
 * 获取当前的 Supabase 会话
 * 
 * @returns 当前会话或 null
 */
export function getSupabaseSession(): Session | null {
  return currentSession;
}

/**
 * 获取当前用户的 Supabase User ID
 * 
 * @returns 用户 ID 或 null
 */
export function getSupabaseUserId(): string | null {
  return currentUserId;
}

/**
 * 清除 Supabase 会话
 * 通常在用户登出时调用
 */
export function clearSupabase(): void {
  supabaseClient = null;
  currentSession = null;
  currentUserId = null;
  console.log('[Supabase] Session cleared');
}

/**
 * 检查 Supabase 是否已初始化
 * 
 * @returns 是否已初始化
 */
export function isSupabaseInitialized(): boolean {
  return supabaseClient !== null;
}
