import {
  clearAdvancedSession,
  obtainSupabaseSession as obtainSupabaseSessionCore,
  registerSessionUpdateCallback,
  type SimpleSupabaseSession,
} from '@sdppp/auth';
import { resolveTenantId } from './constants';

export type SupabaseSession = SimpleSupabaseSession;

export async function obtainSupabaseSession(): Promise<{
  supabase: any;
  session: SupabaseSession;
  tenantId: string;
}> {
  const tenantId = resolveTenantId();
  if (!tenantId) {
    throw new Error('未能解析租户信息');
  }
  return obtainSupabaseSessionCore(tenantId);
}

export { registerSessionUpdateCallback };

export function clearSupabaseSession() {
  clearAdvancedSession();
}
