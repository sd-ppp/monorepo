import { mcpMesh } from '@sdppp/ps-uxp/src/mesh/mesh';

export async function refreshBalance(): Promise<number | null> {
  try {
    const state = mcpMesh.store.getState?.() as { balance?: number | null } | undefined;
    const balance = state?.balance;
    return typeof balance === 'number' ? balance : null;
  } catch (error) {
    console.error('[balance] refresh failed', error);
    return null;
  }
}

export function clearBalance(): void {
  void refreshBalance();
}
