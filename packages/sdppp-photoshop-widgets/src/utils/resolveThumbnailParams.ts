import type {
  BoundaryUri,
  ContentUri,
  FileUri,
  MaskUri,
} from '../hooks/useThumbnail/types';
import type { UseThumbnailParams } from '../hooks/useThumbnail';

export const DEFAULT_CONTENT_URI = 'uxp://content/canvas';

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

  if (!isAutoEnabled && normalizedFileUri) {
    return {
      fileUri: normalizedFileUri as FileUri,
    };
  }

  return {
    contentUri: normalizedContentUri,
    boundaryUri: normalizedBoundaryUri as BoundaryUri,
    maskUri: normalizedMaskUri,
  };
};
