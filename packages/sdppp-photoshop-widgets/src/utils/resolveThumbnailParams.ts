import type { UseThumbnailParams } from '../hooks/useThumbnail';
import type {
  BoundaryUri,
  ContentUri,
  FileUri,
  MaskUri,
} from '../hooks/useThumbnail/types';

export const DEFAULT_CONTENT_URI = 'uxp://content/canvas';

const IMAGE_SIZE_LIMIT = 192;
const DEFAULT_IMAGE_QUALITY = 1;

const ensureImageSizeParams = (uri: string): string => {
  if (!uri.trim()) {
    return uri;
  }

  try {
    const parsed = new URL(uri);
    if (!parsed.searchParams.has('imageSize')) {
      parsed.searchParams.set('imageSize', String(IMAGE_SIZE_LIMIT));
    }
    if (!parsed.searchParams.has('imageQuality')) {
      parsed.searchParams.set('imageQuality', String(DEFAULT_IMAGE_QUALITY));
    }
    return parsed.toString();
  } catch {
    return uri;
  }
};

export interface ResolveThumbnailParamsInput {
  isAutoEnabled: boolean;
  contentUri: string;
  boundaryUri: string;
  maskUri: string;
  fileUri: string;
  defaultContentUri?: string;
}

export const resolveThumbnailParams = ({
  isAutoEnabled,
  contentUri,
  boundaryUri,
  maskUri,
  fileUri,
  defaultContentUri = DEFAULT_CONTENT_URI,
}: ResolveThumbnailParamsInput): UseThumbnailParams => {
  const normalizedContentUri = (contentUri.trim() || defaultContentUri) as ContentUri;
  const normalizedBoundaryUri = boundaryUri.trim();
  const normalizedMaskUri = maskUri.trim() as MaskUri | string;
  const normalizedFileUri = fileUri.trim();

  if (!isAutoEnabled) {
    return {
      fileUri: normalizedFileUri as FileUri,
    };
  }

  const boundaryWithSize = ensureImageSizeParams(normalizedBoundaryUri) as BoundaryUri;

  return {
    contentUri: normalizedContentUri,
    boundaryUri: boundaryWithSize,
    maskUri: normalizedMaskUri,
  };
};
