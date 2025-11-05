import { sdpppSDK } from '@sdppp/common';
import type { BoundarySetting } from './types';
import { resolveBoundaryParam } from './utils';
import {
  TrackingEntry,
  getTrackingEntries,
  setThumbnailForDoc,
} from './state';

const resolveBoundaryForTracking = (entry: TrackingEntry): BoundarySetting =>
  resolveBoundaryParam(entry.boundaryResource ?? null) ?? 'canvas';

const tryGetLayerIdentify = async (
  tracking: TrackingEntry,
  cache: Map<string, boolean>,
  photoshopPlugin: any,
  currentLayerCache: { value: string | null | undefined }
): Promise<string | null> => {
  if (tracking.content !== 'curlayer') {
    return tracking.layerIdentify ?? null;
  }

  let resolved = tracking.layerIdentify ?? null;
  if (!resolved) {
    if (currentLayerCache.value === undefined) {
      try {
        const identifyRes = await photoshopPlugin?.getCurrentLayerIdentify?.({});
        currentLayerCache.value = identifyRes?.layer_identify ?? null;
      } catch (err) {
        currentLayerCache.value = null;
        console.warn('[RealtimeThumbnailStore] getCurrentLayerIdentify failed', err);
      }
    }
    resolved = currentLayerCache.value ?? null;
  }

  if (!resolved) return null;

  let isGroup = cache.get(resolved);
  if (isGroup === undefined) {
    try {
      const info = await photoshopPlugin?.getLayerInfo?.({ layer_identify: resolved });
      isGroup = !!info?.isGroup;
    } catch (err) {
      console.warn('[RealtimeThumbnailStore] getLayerInfo failed', err);
      isGroup = false;
    }
    cache.set(resolved, !!isGroup);
  }

  if (isGroup) {
    return null;
  }

  return resolved;
};

export const runFetch = async (): Promise<void> => {
  try {
    const docId = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    if (!docId) return;

    const trackList = getTrackingEntries(docId);
    if (trackList.length === 0) return;

    const photoshopPlugin = sdpppSDK.plugins.photoshop as any;
    const layerGroupCache = new Map<string, boolean>();
    const currentLayerIdentify = { value: undefined as string | null | undefined };

    for (const tracking of trackList) {
      const boundaryParam: BoundarySetting = resolveBoundaryForTracking(tracking);
      const resolvedLayerIdentify = await tryGetLayerIdentify(
        tracking,
        layerGroupCache,
        photoshopPlugin,
        currentLayerIdentify
      );

      if (tracking.content === 'curlayer' && resolvedLayerIdentify === null) {
        continue;
      }

      if (tracking.type === 'image') {
        const res = await sdpppSDK.plugins.photoshop.getImage({
          boundary: boundaryParam ?? 'canvas',
          content: tracking.content,
          imageSize: 192,
          imageQuality: 1,
          cropBySelection: tracking.alt ? 'negative' : 'no',
          SkipNonNormalLayer: true,
          layer_identify: resolvedLayerIdentify ?? undefined,
        });

        let thumb = (res as any)?.thumbnail;
        if (!thumb && res?.resource) {
          try {
            const thumbRes = await (sdpppSDK.plugins.photoshop as any)?.getThumbnail?.({
              resource: res.resource,
              maxSize: 192,
            });
            thumb = thumbRes?.thumbnail ?? thumb;
          } catch (err) {
            console.warn('[RealtimeThumbnailStore] getThumbnail image failed', err);
          }
        }

        if (thumb) {
          setThumbnailForDoc(
            docId,
            'image',
            tracking.content,
            thumb,
            !!tracking.alt,
            tracking.layerIdentify,
            tracking.boundaryResource ?? null
          );
        }

        if (typeof (res as any)?.resource === 'string') {
          try {
            await (sdpppSDK.plugins.photoshop as any)?.deleteDownloadedImage?.({ resources: [res.resource] });
          } catch (err) {
            console.warn('[RealtimeThumbnailStore] deleteDownloadedImage image failed', err);
          }
        }
      } else {
        const res = await sdpppSDK.plugins.photoshop.getMask({
          boundary: boundaryParam ?? 'canvas',
          content: tracking.content,
          reverse: !!tracking.alt,
          imageSize: 192,
          layer_identify: resolvedLayerIdentify ?? undefined,
        } as any);

        let thumb = (res as any)?.thumbnail;
        if (!thumb && res?.resource) {
          try {
            const thumbRes = await (sdpppSDK.plugins.photoshop as any)?.getThumbnail?.({
              resource: res.resource,
              maxSize: 192,
            });
            thumb = thumbRes?.thumbnail ?? thumb;
          } catch (err) {
            console.warn('[RealtimeThumbnailStore] getThumbnail mask failed', err);
          }
        }

        if (thumb) {
          setThumbnailForDoc(
            docId,
            'mask',
            tracking.content,
            thumb,
            !!tracking.alt,
            tracking.layerIdentify,
            tracking.boundaryResource ?? null
          );
        }

        if (typeof (res as any)?.resource === 'string') {
          try {
            await (sdpppSDK.plugins.photoshop as any)?.deleteDownloadedImage?.({ resources: [res.resource] });
          } catch (err) {
            console.warn('[RealtimeThumbnailStore] deleteDownloadedImage mask failed', err);
          }
        }
      }
    }
  } catch (error) {
    // swallow errors
  }
};
