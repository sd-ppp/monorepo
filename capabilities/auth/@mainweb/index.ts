/**
 * @sdppp/auth - 认证功能
 *
 * 提供 Supabase 会话管理,支持 UXP (自动 token) 和 Mainweb (手动 token)。
 */

import { initializeSupabase as coreInitializeSupabase } from './supabase/session';
import type { SupabaseSessionResult } from './supabase/types';

// ============================================================================
// Supabase 会话管理
// ============================================================================

export {
  initializeSupabase,
  getSupabaseClient,
  getSupabaseSession,
  getSupabaseUserId,
  clearSupabase,
  isSupabaseInitialized,
} from './supabase/session';

export type { SupabaseSessionResult, SupabaseInitOptions } from './supabase/types';

// ============================================================================
// 配置
// ============================================================================

export { SUPABASE_CONFIG } from './supabase/config';

// ============================================================================
// 高级 Supabase 会话管理（用于 SDPPPSponsor 等需要租户管理的场景）
// ============================================================================

export {
  obtainSupabaseSession,
  registerSessionUpdateCallback,
  clearAdvancedSession,
  type SimpleSupabaseSession,
} from './supabase/advanced-session';

// ============================================================================
// Mainweb 适配
// ============================================================================

export {
  AuthProvider,
  AuthService,
  authActions,
  useAuthStore,
  AuthingCNService,
  Login,
} from './authing';
export type { LoginProvider } from './authing';

/**
 * Mainweb 环境下初始化 Supabase
 *
 * @param authingToken - Authing token (必须提供)
 * @param tenantId - Tenant ID (可选,不传则使用默认配置)
 * @returns Supabase 会话结果
 *
 * @example
 * ```typescript
 * import { initializeSupabaseForMainweb } from '@sdppp/auth';
 *
 * const authingToken = getAuthingTokenFromSomeWhere();
 * await initializeSupabaseForMainweb(authingToken);
 * ```
 */
export async function initializeSupabaseForMainweb(
  authingToken: string,
  tenantId?: string
): Promise<SupabaseSessionResult> {
  if (!authingToken) {
    throw new Error('authingToken is required for mainweb environment');
  }

  return coreInitializeSupabase({
    authingToken,
    tenantId,
  });
}
