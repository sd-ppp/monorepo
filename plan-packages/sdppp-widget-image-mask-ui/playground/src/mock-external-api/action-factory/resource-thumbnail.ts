import type { ResourceThumbnailParams, ResourceThumbnailResult } from '../../../src/context/WidgetImageMaskContext';
import type { ActionContext } from './types';

export const createResourceThumbnail = async (
  ctx: ActionContext,
  { resource }: ResourceThumbnailParams
): Promise<ResourceThumbnailResult> => {
  const thumbnail = ctx.resourceStore.getThumbnail(resource);
  return { thumbnail };
};
