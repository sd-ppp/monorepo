import { sdpppSDK } from '@sdppp/common';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import type { AutoSyncConfig } from '../../foundation/stores/types';

interface CaptureContext {
  boundaryParam: any;
  imageSize: number;
}

export const DEFAULT_THUMBNAIL_SIZE = 192;

export const resolveWorkBoundaryContext = (): CaptureContext => {
  const activeDocumentID =
    sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
  const webviewState: any = sdpppSDK.stores.WebviewStore.getState();
  const workBoundaries = webviewState?.workBoundaries || {};
  const workBoundaryMaxSizes = webviewState?.workBoundaryMaxSizes || {};
  const boundary = workBoundaries[activeDocumentID];
  const defaultLimit =
    sdpppSDK.stores.PhotoshopStore.getState().sdpppX[
      'settings.imaging.defaultImagesSizeLimit'
    ];

  let boundaryParam: any = 'canvas';
  if (
    boundary &&
    !(
      boundary.width >= 999999 &&
      boundary.height >= 999999
    )
  ) {
    boundaryParam = boundary;
  }

  return {
    boundaryParam,
    imageSize: workBoundaryMaxSizes[activeDocumentID] || defaultLimit,
  };
};

export interface CaptureResponse {
  resource?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export const captureWorkBoundaryImage = async (
  componentId: string,
  index: number
): Promise<CaptureResponse> => {
  const { boundaryParam, imageSize } = resolveWorkBoundaryContext();

  const result = await sdpppSDK.plugins.photoshop.getImage({
    content: 'canvas',
    boundary: boundaryParam,
    imageSize,
    imageQuality: 1,
    cropBySelection: 'no',
  });

  const resource: string | undefined = result?.resource;
  const thumbnail: string | undefined = result?.thumbnail;

  GlobalImageStore.getState().setSlotPrimaryResource(
    componentId,
    index,
    resource ?? null
  );

  if (thumbnail) {
    GlobalImageStore.getState().setSlotThumbnail(componentId, index, thumbnail);
  } else if (resource) {
    try {
      const thumbRes = await sdpppSDK.plugins.photoshop.getThumbnail({
        resource,
        maxSize: DEFAULT_THUMBNAIL_SIZE,
      });
      if (thumbRes?.thumbnail) {
        GlobalImageStore.getState().setSlotThumbnail(
          componentId,
          index,
          thumbRes.thumbnail
        );
      }
    } catch (error) {
      console.warn('[captureWorkBoundaryImage] getThumbnail failed', error);
    }
  }

  GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

  return {
    resource,
    thumbnail: thumbnail ?? undefined,
    width: result?.width,
    height: result?.height,
  };
};

export const captureAutoImage = async (
  componentId: string,
  index: number,
  config: AutoSyncConfig
): Promise<CaptureResponse> => {
  const { boundaryParam: defaultBoundary, imageSize } = resolveWorkBoundaryContext();
  const boundary = config.boundary ?? defaultBoundary ?? 'canvas';

  const result = await sdpppSDK.plugins.photoshop.getImage({
    content: config.content,
    boundary,
    imageSize,
    imageQuality: 1,
    cropBySelection: config.alt ? 'negative' : 'no',
    layer_identify: config.layerIdentify ?? undefined,
  });

  const resource: string | undefined = result?.resource;
  const thumbnail: string | undefined = result?.thumbnail;

  GlobalImageStore.getState().setSlotPrimaryResource(componentId, index, resource ?? null);

  if (thumbnail) {
    GlobalImageStore.getState().setSlotThumbnail(componentId, index, thumbnail);
  } else if (resource) {
    try {
      const thumbRes = await sdpppSDK.plugins.photoshop.getThumbnail({
        resource,
        maxSize: DEFAULT_THUMBNAIL_SIZE,
      });
      if (thumbRes?.thumbnail) {
        GlobalImageStore.getState().setSlotThumbnail(componentId, index, thumbRes.thumbnail);
      }
    } catch (error) {
      console.warn('[captureAutoImage] getThumbnail failed', error);
    }
  }

  GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

  return {
    resource,
    thumbnail: thumbnail ?? undefined,
    width: result?.width,
    height: result?.height,
  };
};

export const captureCurrentMask = async (
  componentId: string,
  index: number
): Promise<CaptureResponse> => {
  const { boundaryParam, imageSize } = resolveWorkBoundaryContext();

  const tryGetMask = async (
    content: 'selection' | 'canvas',
    boundary: any,
    reverse: boolean
  ) => {
    return await sdpppSDK.plugins.photoshop.getMask({
      content,
      reverse,
      imageSize,
      boundary,
    } as any);
  };

  let result: any;
  try {
    result = await tryGetMask('selection', 'selection', true);
    if (!result?.resource) {
      throw new Error('Empty selection mask');
    }
  } catch (error) {
    try {
      result = await tryGetMask('canvas', boundaryParam, false);
    } catch (fallbackError) {
      console.warn('[captureCurrentMask] getMask fallback failed', fallbackError);
      result = undefined;
    }
  }

  const resource: string | undefined = result?.resource;
  GlobalImageStore.getState().setSlotMaskResource(
    componentId,
    index,
    resource ?? null
  );
  GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

  return {
    resource,
    thumbnail: result?.thumbnail ?? undefined,
    width: result?.width,
    height: result?.height,
  };
};

export const ensureCompositeThumbnail = async (
  componentId: string,
  index: number
): Promise<string | undefined> => {
  const slot = GlobalImageStore.getState().getSlot(componentId, index);
  if (!slot) return undefined;

  const {
    primaryResourceId,
    maskResourceId,
    compositeDirty,
    compositeThumbnail,
    compositeResourceId,
  } = slot;

  if (!primaryResourceId || !maskResourceId) {
    return compositeThumbnail ?? slot.thumbnail;
  }

  if (!compositeDirty) {
    if (compositeThumbnail) {
      return compositeThumbnail;
    }

    if (compositeResourceId) {
      try {
        const res = await sdpppSDK.plugins.photoshop.getThumbnail({
          resource: compositeResourceId,
          maxSize: DEFAULT_THUMBNAIL_SIZE,
        });
        if (res?.thumbnail) {
          GlobalImageStore.getState().setSlotCompositeThumbnail(
            componentId,
            index,
            res.thumbnail
          );
          return res.thumbnail;
        }
      } catch (error) {
        console.warn('[ensureCompositeThumbnail] cached composite thumbnail failed', error);
        GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);
      }
    }
  }

  try {
    const composite = await composeImageWithMask(componentId, index);
    if (composite.thumbnail) {
      GlobalImageStore.getState().setSlotCompositeThumbnail(
        componentId,
        index,
        composite.thumbnail
      );
      return composite.thumbnail;
    }

    if (composite.resource) {
      const res = await sdpppSDK.plugins.photoshop.getThumbnail({
        resource: composite.resource,
        maxSize: DEFAULT_THUMBNAIL_SIZE,
      });
      if (res?.thumbnail) {
        GlobalImageStore.getState().setSlotCompositeThumbnail(
          componentId,
          index,
          res.thumbnail
        );
        return res.thumbnail;
      }
    }
  } catch (error) {
    console.warn('[ensureCompositeThumbnail] compose failed', error);
    GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);
  }

  return GlobalImageStore.getState().getSlot(componentId, index)?.compositeThumbnail ?? slot.thumbnail;
};

export const composeImageWithMask = async (
  componentId: string,
  index: number
): Promise<CaptureResponse> => {
  const slot = GlobalImageStore.getState().getSlot(componentId, index);
  if (!slot?.primaryResourceId) {
    throw new Error('Primary image resource is missing');
  }
  if (!slot?.maskResourceId) {
    throw new Error('Mask resource is missing');
  }

  try {
    const result = await sdpppSDK.plugins.photoshop.applyMaskToImage({
      imageResource: slot.primaryResourceId,
      maskResource: slot.maskResourceId,
      invertMask: false,
    });
    if (!result?.resource) {
      console.warn('[composeImageWithMask] applyMaskToImage returned empty resource', {
        componentId,
        index,
        primaryResourceId: slot.primaryResourceId,
        maskResourceId: slot.maskResourceId,
        result: result ? { hasResource: !!result.resource, hasThumbnail: !!result.thumbnail, width: result.width, height: result.height } : null,
      });
      throw new Error('applyMaskToImage returned empty resource');
    }

    GlobalImageStore.getState().setSlotCompositeResource(componentId, index, result.resource);

    let thumbnail = result?.thumbnail;
    if (!thumbnail) {
      try {
        const res = await sdpppSDK.plugins.photoshop.getThumbnail({
          resource: result.resource,
          maxSize: DEFAULT_THUMBNAIL_SIZE,
        });
        if (res?.thumbnail) {
          thumbnail = res.thumbnail;
        }
      } catch (thumbError) {
        console.warn('[composeImageWithMask] thumbnail fetch failed', thumbError);
      }
    }

    if (thumbnail) {
      GlobalImageStore.getState().setSlotCompositeThumbnail(componentId, index, thumbnail);
      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, false);
    } else {
      GlobalImageStore.getState().setSlotCompositeThumbnail(componentId, index, undefined);
      GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);
    }

    return {
      resource: result.resource,
      thumbnail: thumbnail ?? undefined,
      width: result?.width,
      height: result?.height,
    };
  } catch (error) {
    console.warn('[composeImageWithMask] applyMaskToImage failed', {
      componentId,
      index,
      primaryResourceId: slot?.primaryResourceId,
      maskResourceId: slot?.maskResourceId,
      error,
    });
    GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);
    throw error;
  }
};
