import { create } from 'zustand';
import type { BoundaryResource, ContentType, TrackType } from './types';
import { areBoundaryResourcesEqual, buildRealtimeThumbKey } from './utils';

type ThumbKey = string;

export interface TrackingEntry {
  type: TrackType;
  content: ContentType;
  alt?: boolean;
  layerIdentify?: string | null;
  boundaryResource?: BoundaryResource;
}

interface DocThumbs {
  image?: Record<ThumbKey, string>;
  mask?: Record<ThumbKey, string>;
}

export interface TrackingState {
  trackingByDoc: Record<number, TrackingEntry[]>;
  thumbsByDoc: Record<number, DocThumbs>;
}

export const RealtimeThumbnailStore = create<TrackingState>(() => ({
  trackingByDoc: {},
  thumbsByDoc: {},
}));

const matchesTracking = (a: TrackingEntry, b: TrackingEntry): boolean =>
  a.type === b.type &&
  a.content === b.content &&
  (a.layerIdentify || null) === (b.layerIdentify || null) &&
  areBoundaryResourcesEqual(a.boundaryResource ?? null, b.boundaryResource ?? null);

export const getTrackingEntries = (docId: number): TrackingEntry[] =>
  RealtimeThumbnailStore.getState().trackingByDoc[docId] || [];

export const setTrackingEntries = (docId: number, entries: TrackingEntry[]): void => {
  RealtimeThumbnailStore.setState(state => ({
    trackingByDoc: { ...state.trackingByDoc, [docId]: entries },
  }));
};

export const addTrackingEntry = (docId: number, entry: TrackingEntry): void => {
  RealtimeThumbnailStore.setState(state => {
    const list = state.trackingByDoc[docId] || [];
    const next = list.filter(existing => !matchesTracking(existing, entry));
    next.push(entry);
    return {
      trackingByDoc: { ...state.trackingByDoc, [docId]: next },
    };
  });
};

export const removeTrackingEntry = (docId: number, entry: TrackingEntry): void => {
  RealtimeThumbnailStore.setState(state => {
    const list = state.trackingByDoc[docId] || [];
    const next = list.filter(existing => !matchesTracking(existing, entry));
    return {
      trackingByDoc: { ...state.trackingByDoc, [docId]: next },
    };
  });
};

export const clearTrackingEntries = (docId: number): void => {
  RealtimeThumbnailStore.setState(state => ({
    trackingByDoc: { ...state.trackingByDoc, [docId]: [] },
  }));
};

export const setThumbnailForDoc = (
  docId: number,
  type: TrackType,
  content: ContentType,
  dataUrl: string,
  alt?: boolean,
  layerIdentify?: string | null,
  boundaryResource?: BoundaryResource
): void => {
  RealtimeThumbnailStore.setState(state => ({
    thumbsByDoc: {
      ...state.thumbsByDoc,
      [docId]: {
        ...(state.thumbsByDoc[docId] || {}),
        [type]: {
          ...((state.thumbsByDoc[docId] || {})[type] || {}),
          [buildRealtimeThumbKey(content, layerIdentify ?? null, !!alt, boundaryResource ?? null)]: dataUrl,
        },
      },
    },
  }));
};
