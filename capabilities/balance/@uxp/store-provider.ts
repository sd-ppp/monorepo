import { mcpMesh } from '@sdppp/ps-uxp/src/mesh/mesh';
import { clearBalance, refreshBalance } from './balance';

let unsubscribeToken: (() => void) | null = null;
let unsubscribeSupabaseReady: (() => void) | null = null;

export async function execute() {
  const sdkNode = mcpMesh.getNode('sdk');
  const token = sdkNode.store.getState().token;
  if (token) {
    void refreshBalance();
  } else {
    clearBalance();
  }

  if (!unsubscribeToken) {
    unsubscribeToken = sdkNode.store.subscribe(
      state => state.token,
      (nextToken, prevToken) => {
        if (!nextToken) {
          clearBalance();
          return;
        }
        if (nextToken !== prevToken) {
          void refreshBalance();
        }
      }
    );
  }

  if (!unsubscribeSupabaseReady) {
    unsubscribeSupabaseReady = sdkNode.store.subscribe(
      state => (state as any).supabaseClientReadyAt,
      (nextReadyAt, prevReadyAt) => {
        if (nextReadyAt && nextReadyAt !== prevReadyAt) {
          void refreshBalance();
        }
      }
    );
  }
}
