import { sdpppSDK } from '@sdppp/common';
import type { BoundarySetting, ContentType, TrackType } from './types';
import { boundaryResourceFromSetting } from './utils';
import {
  TrackingEntry,
  addTrackingEntry,
  clearTrackingEntries,
  getTrackingEntries,
  removeTrackingEntry,
} from './state';
import { requestImmediateFetch } from './scheduler';

const buildTrackingEntry = (
  type: TrackType,
  content: ContentType,
  alt: boolean | undefined,
  layerIdentify: string | null | undefined,
  boundary: BoundarySetting | undefined | null
): TrackingEntry => ({
  type,
  content,
  alt: !!alt,
  layerIdentify: layerIdentify || null,
  boundaryResource: boundaryResourceFromSetting(boundary ?? null),
});

export function startAutoThumbnail(
  type: TrackType,
  content: ContentType,
  alt?: boolean,
  layerIdentify?: string | null,
  boundary?: BoundarySetting
) {
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  if (!docId) return;

  const entry = buildTrackingEntry(type, content, alt, layerIdentify, boundary);
  addTrackingEntry(docId, entry);
  requestImmediateFetch();
}

export function stopAutoThumbnail(
  type?: TrackType,
  content?: ContentType,
  layerIdentify?: string | null,
  boundary?: BoundarySetting
) {
  const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  if (!docId) return;

  if (type && content) {
    const entry = buildTrackingEntry(type, content, false, layerIdentify, boundary ?? null);
    removeTrackingEntry(docId, entry);
    return;
  }

  if (type) {
    const entries = getTrackingEntries(docId);
    entries
      .filter(item => item.type === type)
      .forEach(item => removeTrackingEntry(docId, item));
    return;
  }

  clearTrackingEntries(docId);
}
