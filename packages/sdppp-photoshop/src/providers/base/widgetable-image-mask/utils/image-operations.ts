import { sdpppSDK } from '@sdppp/common';

/**
 * Get images from Photoshop with proper boundary handling
 */
export const getPhotoshopImage = async (
  isMask = false,
  source: 'canvas' | 'curlayer' | 'selection',
  reverse?: boolean,
  layerIdentify?: string | null
) => {
  let thumbnail_url: string, file_token: string, imageSource: string, result: any;

  if (isMask) {
    const activeDocumentID = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    const webviewState: any = sdpppSDK.stores.WebviewStore.getState();
    const workBoundaries = webviewState.workBoundaries;
    const workBoundaryMaxSizes = (webviewState as any).workBoundaryMaxSizes || {};
    const boundary = workBoundaries[activeDocumentID];

    let boundaryParam: 'canvas' | 'curlayer' | 'selection' | {
      leftDistance: number;
      topDistance: number;
      rightDistance: number;
      bottomDistance: number;
      width: number;
      height: number;
    };
    if (!boundary || (boundary.width >= 999999 && boundary.height >= 999999)) {
      boundaryParam = 'canvas';
    } else {
      boundaryParam = boundary;
    }

    const maskParams: any = {
      content: source,
      reverse: !!reverse,
      imageSize:
        workBoundaryMaxSizes[activeDocumentID] ||
        sdpppSDK.stores.PhotoshopStore.getState().sdpppX['settings.imaging.defaultImagesSizeLimit'],
      boundary: boundaryParam as any,
    };

    if (layerIdentify) {
      maskParams.layer_identify = layerIdentify;
    }

    result = await sdpppSDK.plugins.photoshop.getMask(maskParams as any);
    thumbnail_url = result.thumbnail_url;
    file_token = result.file_token;
    imageSource = result.source;
  } else {
    const activeDocumentID = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    const webviewState: any = sdpppSDK.stores.WebviewStore.getState();
    const workBoundaries = webviewState.workBoundaries;
    const workBoundaryMaxSizes = (webviewState as any).workBoundaryMaxSizes || {};
    const boundary = workBoundaries[activeDocumentID];

    let boundaryParam: 'canvas' | 'curlayer' | 'selection' | {
      leftDistance: number;
      topDistance: number;
      rightDistance: number;
      bottomDistance: number;
      width: number;
      height: number;
    };
    if (!boundary || (boundary.width >= 999999 && boundary.height >= 999999)) {
      boundaryParam = 'canvas';
    } else {
      boundaryParam = boundary;
    }

    const getImageParams: any = {
      content: source,
      boundary: boundaryParam,
      imageSize:
        workBoundaryMaxSizes[activeDocumentID] ||
        sdpppSDK.stores.PhotoshopStore.getState().sdpppX['settings.imaging.defaultImagesSizeLimit'],
      cropBySelection: reverse ? 'negative' : 'no',
    };

    if (layerIdentify) {
      getImageParams.layer_identify = layerIdentify;
    }

    result = await sdpppSDK.plugins.photoshop.getImage(getImageParams);
    thumbnail_url = result.thumbnail_url;
    file_token = result.file_token;
    imageSource = result.source;
  }

  return { thumbnail_url, file_token, source: imageSource, result };
};

/**
 * Create and handle file input for disk uploads
 */
export const createFileInput = (
  onFileSelected: (file: File) => void,
  accept = 'image/*'
): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = false;
  input.style.position = 'fixed';
  input.style.left = '-10000px';
  input.style.top = '-10000px';
  document.body.appendChild(input);

  const cleanup = () => {
    try {
      input.value = '';
      document.body.removeChild(input);
    } catch {}
  };

  input.onchange = () => {
    const file = input.files?.[0];
    cleanup();
    if (file) {
      onFileSelected(file);
    }
  };

  input.click();
};

/**
 * Validate if file is an image
 */
export const validateImageFile = (file: File): boolean => {
  return file.type?.startsWith('image/') || false;
};

/**
 * Create blob URL from file
 */
export const createBlobUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * Revoke blob URL safely
 */
export const revokeBlobUrl = (url: string): void => {
  if (url?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
};
