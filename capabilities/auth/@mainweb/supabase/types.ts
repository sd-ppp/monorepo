import type { SupabaseClient, Session } from '@supabase/supabase-js';

/**
 * Supabase 会话初始化结果
 */
export interface SupabaseSessionResult {
  client: SupabaseClient;
  session: Session;
  userId: string;
}

/**
 * Supabase 初始化选项
 */
export interface SupabaseInitOptions {
  /**
   * Authing token
   * 如果不提供,将自动从 mcpMesh.store 获取
   */
  authingToken?: string;
  
  /**
   * Tenant ID
   * 如果不提供,将使用配置中的默认值
   */
  tenantId?: string;
}
