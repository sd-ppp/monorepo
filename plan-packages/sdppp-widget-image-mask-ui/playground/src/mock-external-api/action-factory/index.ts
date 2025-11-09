import type {
  ResourceThumbnailParams,
  ResourceThumbnailResult,
  WidgetImageMaskActions,
} from '../../../src/context/WidgetImageMaskContext';
import { createFromCBM } from './create-from-cbm';
import { createFromLocal } from './create-from-local';
import { createResourceThumbnail } from './resource-thumbnail';
import { normalizeBoundary } from './boundary-normalize';
import { resolveLayer } from './layer-resolve';
import type { FactoryDeps, ActionContext } from './types';
export { MIN_SELECTION_EDGE, roundRect } from './constants';

const createActionContext = (deps: FactoryDeps): ActionContext => ({
  getStage: () => {
    const stage = deps.stageRef.current;
    if (!stage) {
      throw new Error('Konva stage unavailable');
    }
    return stage;
  },
  getSelection: () => deps.selectionRef.current ?? null,
  resourceStore: deps.resourceStore,
  logger: deps.logger,
});

export const createMockActions = (deps: FactoryDeps): WidgetImageMaskActions => {
  const ctx = createActionContext(deps);

  const handleThumbnail = (params: ResourceThumbnailParams): Promise<ResourceThumbnailResult> =>
    createResourceThumbnail(ctx, params);

  return {
    'resource.layer.resolve': resolveLayer,
    'resource.boundary.normalize': payload => normalizeBoundary(ctx, payload),
    'resource.thumbnail': handleThumbnail,
    'resource.file.createFromCBM': params => createFromCBM(ctx, params),
    'resource.file.createFromLocal': () => createFromLocal(ctx),
  };
};

export type { FactoryDeps } from './types';
