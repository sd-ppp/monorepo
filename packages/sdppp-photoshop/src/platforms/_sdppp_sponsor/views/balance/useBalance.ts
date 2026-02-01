import { useCallback, useEffect } from 'react';
import { sdpppSDK } from '@sdppp/common';
import { sponsorUiStore } from '../uiStore';
import { sponsorAuthStore } from '../auth/authStore';

export const useBalance = () => {
  const setLoadingBalance = sponsorUiStore(state => state.setBalanceLoading);
  const setHasFetchedBalance = sponsorUiStore(state => state.setHasFetchedBalance);
  const services = sponsorAuthStore(state => state.services);
  const tenantId = sponsorAuthStore(state => state.tenantId);

  const refreshBalance = useCallback(async () => {
    setLoadingBalance(true);
    setHasFetchedBalance(true);
    try {
      const webviewStore = sdpppSDK?.stores?.WebviewStore;
      if (!webviewStore) {
        return;
      }
      if (!services) {
        throw new Error('Taskrouter services not ready');
      }
      if (!tenantId) {
        throw new Error('tenantId missing');
      }
      const result = await services.fetchBalance(undefined, tenantId);
      const balance = typeof result.balance === 'number' ? result.balance : null;
      webviewStore.setState({ balance });
    } catch (error) {
      console.warn('[sdppp_sponsor] refresh balance failed', error);
      sdpppSDK?.stores?.WebviewStore?.setState({ balance: null });
    } finally {
      setLoadingBalance(false);
    }
  }, [services, setHasFetchedBalance, setLoadingBalance, tenantId]);

  useEffect(() => {
    const webviewStore = sdpppSDK?.stores?.WebviewStore;
    if (!webviewStore?.subscribe) {
      return () => undefined;
    }
    const unsubscribe = webviewStore.subscribe((state, prevState) => {
      if ((state as any).balance === (prevState as any).balance) return;
      setHasFetchedBalance(true);
    });
    return () => {
      unsubscribe?.();
    };
  }, [setHasFetchedBalance]);

  return { refreshBalance };
};
