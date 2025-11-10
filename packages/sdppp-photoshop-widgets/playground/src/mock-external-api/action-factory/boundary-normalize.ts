import type { ActionContext } from './types';
import { normalizeBoundaryUri } from './boundary-utils';

export const normalizeBoundary = async (
  ctx: ActionContext,
  { boundary }: { boundary: string }
): Promise<{ boundary: string }> => {
  ctx.logger('mock resource.boundary.normalize in', boundary);
  try {
    const result = normalizeBoundaryUri(ctx, boundary);
    ctx.logger('mock resource.boundary.normalize out', result);
    return { boundary: result };
  } catch (error) {
    ctx.logger('mock resource.boundary.normalize error', String(error));
    return { boundary };
  }
};
