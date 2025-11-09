import type { ActionContext } from './types';
import { normalizeBoundaryUri } from './boundary-utils';

export const normalizeBoundary = async (
  ctx: ActionContext,
  { boundary }: { boundary: string }
): Promise<{ boundary: string }> => {
  ctx.logger('mock resource.boundary.normalize in', boundary);
  try {
    const stage = ctx.getStage();
    const selection = ctx.getSelection();
    const result = normalizeBoundaryUri(stage, selection, boundary);
    ctx.logger('mock resource.boundary.normalize out', result);
    return { boundary: result };
  } catch (error) {
    ctx.logger('mock resource.boundary.normalize error', String(error));
    return { boundary };
  }
};
