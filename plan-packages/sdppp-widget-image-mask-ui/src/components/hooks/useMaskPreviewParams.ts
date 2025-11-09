import { useMemo } from 'react';

import { resolveThumbnailParams } from './resolveThumbnailParams';

export const useMaskPreviewParams = ({
  isAutoEnabled,
  contentUri,
  boundaryUri,
  maskUri,
  fileUri,
}: {
  isAutoEnabled: boolean;
  contentUri: string;
  boundaryUri: string;
  maskUri: string;
  fileUri: string;
}) =>
  useMemo(
    () =>
      resolveThumbnailParams({
        isAutoEnabled,
        contentUri,
        boundaryUri,
        maskUri,
        fileUri,
      }),
    [isAutoEnabled, contentUri, boundaryUri, maskUri, fileUri],
  );

export default useMaskPreviewParams;
