import { registerCreateFromExternalAction } from "./register-create-from-external.js";
import { registerDeleteDownloadedImageAction } from "./register-delete-downloaded-image.js";
import { registerThumbnailAction } from "./register-get-thumbnail.js";
import { registerSaveAsAction } from "./register-request-save-image.js";
import { registerCreateFromLocalAction } from "./register-create-from-local.js";
import { registerCreateFromCBMAction } from "./register-create-from-cbm.js";
import { registerBoundaryNormalizeAction } from "./register-boundary-normalize.js";
import { registerLayerResolveAction } from "./register-layer-resolve.js";
export function registerImagingActions(context) {
    const { mcpMesh } = context;
    registerCreateFromExternalAction(context);
    registerCreateFromLocalAction(context);
    registerCreateFromCBMAction(context);
    registerDeleteDownloadedImageAction(context);
    registerThumbnailAction(context);
    registerSaveAsAction(context);
    registerBoundaryNormalizeAction(context);
    registerLayerResolveAction(context);
}
//# sourceMappingURL=register-actions.js.map