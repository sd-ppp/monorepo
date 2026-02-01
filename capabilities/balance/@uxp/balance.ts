import { getSupabaseClientFromSDPPPSB } from '@sdppp/auth';
import { mcpMesh } from '@sdppp/ps-uxp/src/mesh/mesh';
import { createSupabaseBalanceFetcher } from '@sdppp/sdpppx-services';
import { resolveTenantId } from '../src/tenant';

export async function refreshBalance(): Promise<number | null> {
  const tenantId = resolveTenantId();
  if (!tenantId) {
    console.warn('[balance] missing tenantId, skip refresh');
    return null;
  }

  const supabase = getSupabaseClientFromSDPPPSB();
  if (!supabase) {
    console.warn('[balance] supabase client not initialized, skip refresh');
    return null;
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }
    const userId = userData?.user?.id ?? null;
    const fetcher = createSupabaseBalanceFetcher({
      getClient: async () => supabase,
    });
    const balance = await fetcher.fetchBalance(userId ?? undefined, tenantId);
    mcpMesh.store.setState({ balance: typeof balance === 'number' ? balance : null });
    return typeof balance === 'number' ? balance : null;
  } catch (error) {
    console.error('[balance] refresh failed', error);
    return null;
  }
}

export function clearBalance(): void {
  mcpMesh.store.setState({ balance: null });
}
