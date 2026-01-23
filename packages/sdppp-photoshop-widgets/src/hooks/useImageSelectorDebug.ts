import { useMemo } from 'react';

import type { WidgetRenderMeta } from '@sdppp/widgetable-ui';
import type { UseThumbnailParams } from './useThumbnail';

export interface UseImageSelectorDebugOptions {
  auto: boolean;
  displayUrl: string;
  imageUrl: string;
  fileUri: string;
  contentUri: string;
  boundaryUri: string;
  defaultBoundaryUri: string;
  maskUri: string;
  contentHandleUri: string | null;
  maskHandleUri: string | null;
  thumbnailParams: UseThumbnailParams;
  renderMeta?: WidgetRenderMeta | null;
}

export const useImageSelectorDebug = ({
  auto,
  displayUrl,
  imageUrl,
  fileUri,
  contentUri,
  boundaryUri,
  maskUri,
  contentHandleUri,
  maskHandleUri,
  thumbnailParams,
  renderMeta,
  defaultBoundaryUri,
}: UseImageSelectorDebugOptions) => {
  const debugDetails = useMemo(
    () => ({
      contentUri: contentUri || '-',
      fileUri: fileUri || '-',
      boundaryUri: boundaryUri || '-',
      defaultBoundaryUri: defaultBoundaryUri || '-',
      maskUri: maskUri || '-',
      contentHandleUri: contentHandleUri || '-',
      maskHandleUri: maskHandleUri || '-',
      auto: auto ? 'true' : 'false',
      widgetPosition: renderMeta
        ? `${renderMeta.sameTypePosition}/${renderMeta.sameTypeTotal}`
        : '-',
      widgetAbsolute: renderMeta?.absolutePosition ?? '-',
    }),
    [
      auto,
      boundaryUri,
      contentHandleUri,
      contentUri,
      defaultBoundaryUri,
      fileUri,
      maskHandleUri,
      maskUri,
      renderMeta,
    ],
  );

  return { debugDetails };
};

export default useImageSelectorDebug;
