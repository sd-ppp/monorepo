/**
 * 高级 Supabase 会话管理
 * 
 * 相比基础的 session.ts，提供以下增强功能：
 * 1. 租户切换检测和自动清理
 * 2. 会话验证和智能复用（避免重复调用 bridge）
 * 3. 并发初始化保护
 * 4. 会话更新回调机制
 */

import { getSupabaseClient, initializeSupabase, clearSupabase, getSupabaseSession } from './session';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

// 简化的会话类型（兼容 chongchong taskrouter）
export type SimpleSupabaseSession = {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
};

// 全局状态
let globalInitPromise: Promise<{
  supabase: SupabaseClient;
  session: SimpleSupabaseSession;
  tenantId: string;
}> | null = null;

let globalTenantId: string | null = null;

// 会话更新回调
type SessionUpdateCallback = (session: SimpleSupabaseSession | null) => void;
let sessionUpdateCallback: SessionUpdateCallback | null = null;

/**
 * 注册会话更新回调（由 store 调用）
 */
export function registerSessionUpdateCallback(callback: SessionUpdateCallback) {
  sessionUpdateCallback = callback;
}

/**
 * 获取或初始化 Supabase 会话（智能单例模式）
 * - 首次调用：通过 authingbridge 初始化
 * - 后续调用：验证现有会话，有效则复用
 * - 租户切换：自动清理旧会话
 */
export async function obtainSupabaseSession(tenantId: string): Promise<{
  supabase: SupabaseClient;
  session: SimpleSupabaseSession;
  tenantId: string;
}> {
  // 并发初始化保护
  if (globalInitPromise) {
    console.log('[Supabase Advanced] Waiting for ongoing initialization...');
    return globalInitPromise;
  }

  // 租户切换检测
  if (globalTenantId && globalTenantId !== tenantId) {
    console.log('[Supabase Advanced] Tenant changed, clearing old session', {
      old: globalTenantId,
      new: tenantId,
    });
    clearSupabase();
    globalTenantId = null;
  }

  // 尝试复用现有会话
  try {
    const client = getSupabaseClient();
    console.log('[Supabase Advanced] Checking existing session...');
    
    const { data, error } = await client.auth.getSession();
    
    if (!error && data.session) {
      console.log('[Supabase Advanced] Existing session valid, reusing');
      return {
        supabase: client,
        session: convertToSimpleSession(data.session, tenantId),
        tenantId,
      };
    }
    
    console.log('[Supabase Advanced] Session invalid or expired', { error });
  } catch (err) {
    console.log('[Supabase Advanced] No existing client, initializing new session');
  }

  // 初始化新会话
  console.log('[Supabase Advanced] Initializing new session...');
  globalInitPromise = initializeNewSession(tenantId);
  
  try {
    const result = await globalInitPromise;
    globalTenantId = tenantId;
    return result;
  } finally {
    globalInitPromise = null;
  }
}

/**
 * 初始化新会话
 */
async function initializeNewSession(tenantId: string): Promise<{
  supabase: SupabaseClient;
  session: SimpleSupabaseSession;
  tenantId: string;
}> {
  // 使用基础 session.ts 的初始化功能
  const result = await initializeSupabase({ tenantId });
  
  const simpleSession = convertToSimpleSession(result.session, tenantId);
  
  // 监听会话更新
  result.client.auth.onAuthStateChange((event, session) => {
    console.log('[Supabase Advanced] Auth state changed:', event);
    
    if (event === 'TOKEN_REFRESHED' && session && sessionUpdateCallback) {
      sessionUpdateCallback(convertToSimpleSession(session, tenantId));
    } else if (event === 'SIGNED_OUT') {
      globalTenantId = null;
      if (sessionUpdateCallback) {
        sessionUpdateCallback(null);
      }
    }
  });
  
  return {
    supabase: result.client,
    session: simpleSession,
    tenantId,
  };
}

/**
 * 转换为简化的 Session 类型
 */
function convertToSimpleSession(session: Session, fallbackUserId: string): SimpleSupabaseSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? null,
    userId: session.user?.id ?? fallbackUserId,
  };
}

/**
 * 清理高级会话状态
 */
export function clearAdvancedSession() {
  clearSupabase();
  globalInitPromise = null;
  globalTenantId = null;
  if (sessionUpdateCallback) {
    sessionUpdateCallback(null);
  }
}

// 重新导出基础功能
export { getSupabaseClient, getSupabaseSession, getSupabaseUserId } from './session';
