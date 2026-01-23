import { storage } from "uxp";

import { isResourceId } from "../../../resource-types.js";
import { deleteResource, resolveResource } from "../../image-holder.js";
import type { ImagingActionContext } from "./context.js";

export function registerDeleteDownloadedImageAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("fileResource.delete", async (params: { resources: string[] }) => {
    try {
      const { resources } = params;
      const localFileSystem = storage.localFileSystem;
      const tempFolder = await localFileSystem.getTemporaryFolder();

      for (const resourceId of resources) {
        if (typeof resourceId !== "string") continue;
        const entry = isResourceId(resourceId) ? resolveResource(resourceId) : undefined;
        if (entry?.data.path) {
          try {
            const nativePath = String(entry.data.path);
            if (nativePath.includes(tempFolder.nativePath)) {
              const relativePath = nativePath.replace(tempFolder.nativePath, "").replace(/^[\\/\\]/, "");
              const file = await tempFolder.getEntry(relativePath);
              await file?.delete();
            }
          } catch {
            // ignore cleanup failure
          }
        }
        if (isResourceId(resourceId)) {
          deleteResource(resourceId);
        }
      }

      return {};
    } catch (error: any) {
      return {
        error: error?.stack || error?.message || String(error)
      };
    }
  });
}
