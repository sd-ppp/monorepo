import { SUPABASE_CONFIG } from '@sdppp/auth';

export function resolveTenantId(): string | null {
  const tenantId = SUPABASE_CONFIG.tenantId;
  if (typeof tenantId !== 'string') return null;
  const trimmed = tenantId.trim();
  return trimmed.length > 0 ? trimmed : null;
}
