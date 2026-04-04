/**
 * @sdppp/auth - 认证功能
 *
 * 提供 Supabase 会话管理,支持 UXP (自动 token) 和 Mainweb (手动 token)。
 */

// ============================================================================
// Supabase 会话管理
// ============================================================================

export {
  clearSupabaseFromSDPPPSB, getSupabaseClientFromSDPPPSB, initializeSupabaseFromSDPPPSB
} from './supabase/sdppp-sb-session';
export { supabaseSessionStore } from './supabase/session-store';

export type { SupabaseInitOptions, SupabaseSessionResult } from './supabase/types';

// ============================================================================
// 配置
// ============================================================================

export { SUPABASE_CONFIG } from './supabase/config';

// ============================================================================
// Mainweb 适配
// ============================================================================

export {
  authActions, AuthingCNService, AuthProvider,
  AuthService, useAuthStore
} from './authing';
export type { LoginProvider } from './authing';
