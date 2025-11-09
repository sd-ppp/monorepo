import { sdpppSDK } from '@sdppp/common';
import { GlobalImageStore } from '../../foundation/stores/global-image-store';
import type { AutoSyncConfig } from '../../foundation/stores/types';

interface CaptureContext {
  boundaryParam: any;
  imageSize: number;
}

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
  GlobalImageStore.getState().setSlotPrimaryResource(
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
    cropBySelection: 'no',
    layer_identify: config.layerIdentify ?? undefined,
  });

  const resource: string | undefined = result?.resource;
  GlobalImageStore.getState().setSlotPrimaryResource(componentId, index, resource ?? null);

  GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, true);

  return {
    resource,
    thumbnail: result?.thumbnail ?? undefined,
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

    GlobalImageStore.getState().markSlotCompositeDirty(componentId, index, false);

    return {
      resource: result.resource,
      thumbnail: result?.thumbnail ?? undefined,
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
