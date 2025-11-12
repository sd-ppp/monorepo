import { useEffect, useMemo } from 'react';

import type { WidgetRenderMeta } from '@sdppp/widgetable-ui';
import type { WidgetImageMaskLogger } from '../context/WidgetImageMaskContext';
import type { UseThumbnailParams } from './useThumbnail';

export interface UseImageSelectorDebugOptions {
  auto: boolean;
  displayUrl: string;
  imageUrl: string;
  fileUri: string;
  contentUri: string;
  boundaryUri: string;
  maskUri: string;
  thumbnailParams: UseThumbnailParams;
  logger: WidgetImageMaskLogger;
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
  thumbnailParams,
  logger,
  renderMeta,
}: UseImageSelectorDebugOptions) => {
  const debugDetails = useMemo(
    () => ({
      contentUri: contentUri || '-',
      fileUri: fileUri || '-',
      boundaryUri: boundaryUri || '-',
      maskUri: maskUri || '-',
      auto: auto ? 'true' : 'false',
      widgetPosition: renderMeta
        ? `${renderMeta.sameTypePosition}/${renderMeta.sameTypeTotal}`
        : '-',
      widgetAbsolute: renderMeta?.absolutePosition ?? '-',
    }),
    [auto, boundaryUri, contentUri, fileUri, maskUri, renderMeta],
  );

  useEffect(() => {
    logger(
      'ImageSelector useThumbnail params',
      JSON.stringify({
        auto,
        params: thumbnailParams,
      }),
    );
  }, [logger, auto, thumbnailParams]);

  useEffect(() => {
    const sanitize = (value: string): string =>
      typeof value === 'string' && value.startsWith('data:') ? '<data-url>' : value;

    logger(
      'ImageSelector display source',
      JSON.stringify({
        auto,
        imageUrl: sanitize(imageUrl),
        fileUri,
        displayUrl: sanitize(displayUrl),
        source: displayUrl
          ? displayUrl === imageUrl
            ? 'imageUrl'
            : displayUrl === fileUri
              ? 'fileUri'
              : 'previewUrl'
          : 'empty',
      }),
    );
  }, [logger, auto, displayUrl, imageUrl, fileUri]);

  useEffect(() => {
    if (!renderMeta) return;
    logger('ImageSelector render meta', JSON.stringify(renderMeta));
  }, [logger, renderMeta]);

  return { debugDetails };
};

export default useImageSelectorDebug;
