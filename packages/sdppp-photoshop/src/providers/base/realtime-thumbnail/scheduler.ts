import { sdpppSDK } from '@sdppp/common';
import { getTrackingEntries } from './state';
import { runFetch } from './fetcher';

let debounceTimer: NodeJS.Timeout | null = null;
let lastRunAt = 0;

const scheduleFetch = (delay = 1000) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const now = Date.now();
  const remaining = delay - (now - lastRunAt);
  debounceTimer = setTimeout(() => {
    lastRunAt = Date.now();
    void runFetch();
  }, remaining > 0 ? remaining : 0);
};

export const requestImmediateFetch = () => {
  scheduleFetch(0);
};

export const requestFetchWithDelay = (delay: number) => {
  scheduleFetch(delay);
};

const initPhotoshopWatcher = () => {
  sdpppSDK.stores.PhotoshopStore.subscribe((state, prev) => {
    const docId = state.activeDocumentID;
    if (!docId) return;

    const trackList = getTrackingEntries(docId);
    if (trackList.length === 0) return;

    const hasSelection = trackList.some(t => t.content === 'selection');
    const hasCurLayer = trackList.some(t => t.content === 'curlayer');
    const hasCanvas = trackList.some(t => t.content === 'canvas');

    if (hasSelection && state.selectionStateID !== prev?.selectionStateID) {
      requestFetchWithDelay(500);
    }

    if (hasCurLayer) {
      const canvasChanged = state.canvasStateID !== prev?.canvasStateID;
      const selectionChanged = state.selectionStateID !== prev?.selectionStateID;
      if (canvasChanged || selectionChanged) {
        requestFetchWithDelay(500);
      }
    }

    if (hasCanvas && state.canvasStateID !== prev?.canvasStateID) {
      requestFetchWithDelay(1000);
    }
  });
};

initPhotoshopWatcher();
