import { sdpppSDK } from '@sdppp/common';
import React from 'react';
import { create } from 'zustand';

type ContentType = 'canvas' | 'curlayer' | 'selection';
type TrackType = 'image' | 'mask';

type ThumbKey = string;
interface DocThumbs {
  image?: Record<ThumbKey, string>;
  mask?: Record<ThumbKey, string>;
}

interface TrackingEntry { type: TrackType; content: ContentType; alt?: boolean; layerIdentify?: string | null }
interface TrackingState {
  trackingByDoc: Record<number, TrackingEntry[]>;
  thumbsByDoc: Record<number, DocThumbs>;
  addTracking: (docId: number, config: TrackingEntry) => void;
  removeTracking: (docId: number, config?: TrackingEntry) => void;
  clearTracking: (docId: number) => void;
  setThumb: (docId: number, type: TrackType, content: ContentType, dataUrl: string, alt?: boolean, layerIdentify?: string | null) => void;
}

const makeThumbKey = (content: ContentType, alt?: boolean, layerIdentify?: string | null) => {
  const base = layerIdentify ? `${content}:${layerIdentify}` : content;
  return alt ? `${base}_alt` : base;
};

export const RealtimeThumbnailStore = create<TrackingState>((set, get) => ({
  trackingByDoc: {},
  thumbsByDoc: {},
  addTracking: (docId, config) => {
    set(state => {
      const list = state.trackingByDoc[docId] || [];
      const next = list
        // ensure uniqueness by type+content+layerIdentify; replace different alt variant
        .filter(e => !(e.type === config.type && e.content === config.content && (e.layerIdentify || null) === (config.layerIdentify || null)));
      next.push(config);
      return { trackingByDoc: { ...state.trackingByDoc, [docId]: next } };
    });
    scheduleFetch(0);
  },
  removeTracking: (docId, config) => {
    set(state => {
      if (!config) return { trackingByDoc: { ...state.trackingByDoc, [docId]: [] } };
      const list = state.trackingByDoc[docId] || [];
      const next = list.filter(e => !(e.type === config.type && e.content === config.content && (e.layerIdentify || null) === (config.layerIdentify || null)));
      return { trackingByDoc: { ...state.trackingByDoc, [docId]: next } };
    });
  },
  clearTracking: (docId) => {
    set(state => ({ trackingByDoc: { ...state.trackingByDoc, [docId]: [] } }));
  },
  setThumb: (docId, type, content, dataUrl, alt, layerIdentify) => {
    set(state => ({
      thumbsByDoc: {
        ...state.thumbsByDoc,
        [docId]: {
          ...(state.thumbsByDoc[docId] || {}),
          [type]: {
            ...((state.thumbsByDoc[docId] || {})[type] || {}),
            [makeThumbKey(content, alt, layerIdentify) as ThumbKey]: dataUrl,
          },
        },
      },
    }));
  },
}));

let debounceTimer: any = null;
let lastRunAt = 0;

function scheduleFetch(delay = 1000) {
  if (debounceTimer) clearTimeout(debounceTimer);
  const now = Date.now();
  const remaining = delay - (now - lastRunAt);
  debounceTimer = setTimeout(() => {
    lastRunAt = Date.now();
    runFetch();
  }, remaining > 0 ? remaining : 0);
}

async function runFetch() {
  try {
    const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    if (!docId) return;
    const trackList = RealtimeThumbnailStore.getState().trackingByDoc[docId] || [];
    if (trackList.length === 0) return;

    const webviewState: any = sdpppSDK.stores.WebviewStore.getState();
    const boundaryMap = webviewState.workBoundaries || {};
    const boundaryRect = boundaryMap[docId];
    let boundaryParam: any;
    if (!boundaryRect || (boundaryRect.width >= 999999 && boundaryRect.height >= 999999)) {
      boundaryParam = 'canvas';
    } else {
      boundaryParam = boundaryRect;
    }

    for (const tracking of trackList) {
      if (tracking.type === 'image') {
        const res = await sdpppSDK.plugins.photoshop.getImage({
          boundary: boundaryParam,
          content: tracking.content,
          imageSize: 192,
          imageQuality: 1,
          cropBySelection: tracking.alt ? 'negative' : 'no',
          SkipNonNormalLayer: true,
          layer_identify: tracking.layerIdentify || undefined,
        });
        const thumb = res.thumbnail_url || '';
        if (thumb) {
          RealtimeThumbnailStore.getState().setThumb(docId, 'image', tracking.content, thumb, !!tracking.alt, tracking.layerIdentify);
        }
      } else {
        const res = await sdpppSDK.plugins.photoshop.getMask({
          boundary: boundaryParam,
          content: tracking.content,
          reverse: !!tracking.alt,
          imageSize: 192,
          layer_identify: tracking.layerIdentify || undefined,
        } as any);
        const thumb = (res as any)?.thumbnail_url || '';
        if (thumb) {
          RealtimeThumbnailStore.getState().setThumb(docId, 'mask', tracking.content, thumb, !!tracking.alt, tracking.layerIdentify);
        }
      }
    }
  } catch (e) {
    // swallow errors
  }
}

// Subscribe to Photoshop store changes to trigger fetch
// - For selection content, respect selectionStateID changes
// - For canvas/curlayer content, respect canvasStateID changes
(() => {
  sdpppSDK.stores.PhotoshopStore.subscribe((state, prev) => {
    const docId = state.activeDocumentID;
    const trackList = RealtimeThumbnailStore.getState().trackingByDoc[docId] || [];
    if (trackList.length === 0) return;
    const hasSelection = trackList.some(t => t.content === 'selection');
    const hasCurLayer = trackList.some(t => t.content === 'curlayer');
    const hasCanvas = trackList.some(t => t.content === 'canvas');
    if (hasSelection && state.selectionStateID !== prev?.selectionStateID) {
      scheduleFetch(500);
    }
    if (hasCurLayer) {
      const canvasChanged = state.canvasStateID !== prev?.canvasStateID;
      const selectionChanged = state.selectionStateID !== prev?.selectionStateID;
      if (canvasChanged || selectionChanged) {
        scheduleFetch(500);
      }
    }
    if (hasCanvas && state.canvasStateID !== prev?.canvasStateID) {
      scheduleFetch(1000);
    }
  });
})();

// Also react to boundary changes in WebviewStore (workBoundaries)
(() => {
  sdpppSDK.stores.WebviewStore.subscribe((state: any, prev: any) => {
    const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    if (!docId) return;
    const tracking = RealtimeThumbnailStore.getState().trackingByDoc[docId];
    if (!tracking) return;

    const curr = state?.workBoundaries?.[docId];
    const prevB = prev?.workBoundaries?.[docId];
    const eq = (a: any, b: any) => {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return a.leftDistance === b.leftDistance &&
        a.topDistance === b.topDistance &&
        a.rightDistance === b.rightDistance &&
        a.bottomDistance === b.bottomDistance &&
        a.width === b.width &&
        a.height === b.height;
    };
    if (!eq(curr, prevB)) {
      // Fetch quickly on boundary changes
      scheduleFetch(300);
    }
  });
})();

export function startAutoThumbnail(type: TrackType, content: ContentType, alt?: boolean, layerIdentify?: string | null) {
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  if (!docId) return;
  RealtimeThumbnailStore.getState().addTracking(docId, { type, content, alt: !!alt, layerIdentify: layerIdentify || null });
}

export function stopAutoThumbnail(type?: TrackType, content?: ContentType, layerIdentify?: string | null) {
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  if (!docId) return;
  if (type && content) {
    RealtimeThumbnailStore.getState().removeTracking(docId, { type, content, layerIdentify: layerIdentify || null });
  } else if (type) {
    const tracking = RealtimeThumbnailStore.getState().trackingByDoc[docId] || [];
    tracking
      .filter(entry => entry.type === type)
      .forEach(entry => RealtimeThumbnailStore.getState().removeTracking(docId, entry));
  } else {
    RealtimeThumbnailStore.getState().clearTracking(docId);
  }
}

export function useRealtimeThumbnail(type: TrackType, content: ContentType, layerIdentify?: string | null) {
  // Bind to current active document
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const thumbs = RealtimeThumbnailStore(state => state.thumbsByDoc[docId]);

  // Ensure tracking follows active document switches
  React.useEffect(() => {
    if (!docId) return;
    // Add tracking for this doc
    RealtimeThumbnailStore.getState().addTracking(docId, { type, content, layerIdentify: layerIdentify || null });

    // Cleanup: remove tracking from the original doc when deps change
    return () => {
      RealtimeThumbnailStore.getState().removeTracking(docId, { type, content, layerIdentify: layerIdentify || null });
    };
  }, [docId, type, content, layerIdentify]);

  const key = makeThumbKey(content, false, layerIdentify ?? null);
  return (thumbs && thumbs[type]?.[key]) || '';
}
