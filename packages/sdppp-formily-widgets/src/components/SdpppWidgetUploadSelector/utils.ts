import type { ResourceHandle } from '../../../context/SdpppWidgetContext';

export const resetHandle = (handle?: ResourceHandle | null) => {
  if (!handle) return;
  try {
    handle.dispose();
  } catch {
    // ignore dispose errors
  }
};

export const IDLE_PROGRESS = Object.freeze({ current: 0, total: 0 });

export const DEFAULT_PROGRESS = Object.freeze({ current: 0, total: 1 });
