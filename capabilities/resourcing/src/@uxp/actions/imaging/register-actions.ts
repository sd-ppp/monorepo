import type { ImagingActionContext } from "./context.js";
import { registerCreateFromExternalAction } from "./register-create-from-external.js";
import { registerDeleteDownloadedImageAction } from "./register-delete-downloaded-image.js";
import { registerThumbnailAction } from "./register-get-thumbnail.js";
import { registerSaveAsAction } from "./register-request-save-image.js";
import { registerCreateFromLocalAction } from "./register-create-from-local.js";
import { registerCreateFromBufferAction } from "./register-create-from-buffer.js";
import { registerCreateByContentAction } from "./register-create-by-content.js";
import { registerCreateByMaskAction } from "./register-create-by-mask.js";
import { registerCombineByCbmAction } from "./register-combine-by-cbm.js";
import { registerBoundaryNormalizeAction } from "./register-boundary-normalize.js";
import { registerLayerResolveAction } from "./register-layer-resolve.js";
import { registerSelectionBoundaryMaintenance } from "../../store/register-selection-boundary.js";

export function registerImagingActions(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  registerCreateFromExternalAction(context);
  registerCreateFromLocalAction(context);
  registerCreateFromBufferAction(context);
  registerCreateByContentAction(context);
  registerCreateByMaskAction(context);
  registerCombineByCbmAction(context);
  registerDeleteDownloadedImageAction(context);
  registerThumbnailAction(context);
  registerSaveAsAction(context);
  registerBoundaryNormalizeAction(context);
  registerLayerResolveAction(context);

  registerSelectionBoundaryMaintenance(context);
}

export type {
  ImagingActionContext,
  MaterializedPayload,
  MaterializedCbmPayload,
  CreateByContentParams,
  CreateByMaskParams,
  CombineByCbmParams,
  McpMeshLike
} from "./context.js";
