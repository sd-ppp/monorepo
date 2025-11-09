import { storage } from "uxp";

import { isResourceId } from "../../../resource-types.js";
import { ensureResourceTempFile, resolveResource } from "../../image-holder.js";
import type { ImagingActionContext } from "./context.js";

export function registerSaveAsAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("fileResource.saveAs", async (params: { resources: string[] }) => {
    try {
      const { resources = [] } = params;
      const localFileSystem = storage.localFileSystem;
      const tempFolder = await localFileSystem.getTemporaryFolder();

      let saveFolder;
      try {
        saveFolder = await localFileSystem.getFolder();
      } catch (error: any) {
        const message = (error?.message || "").toLowerCase();
        if (message.includes("cancel")) {
          return { error: "cancelled" };
        }
        throw error;
      }

      for (const resourceId of resources) {
        if (typeof resourceId !== "string") continue;
        try {
          const ensuredPath = isResourceId(resourceId)
            ? await ensureResourceTempFile(resourceId).catch(() => undefined)
            : undefined;

          if (!ensuredPath) {
            continue;
          }

          const nativePath = String(ensuredPath);
          if (nativePath.includes(tempFolder.nativePath)) {
            const relativePath = nativePath.replace(tempFolder.nativePath, "").replace(/^[\\/\\]/, "");
            const tempFile = await tempFolder.getEntry(relativePath);

            if (!tempFile) {
              continue;
            }

            const fileName = tempFile.name;
            const arrayBuffer = await tempFile.read({ format: storage.formats.binary });
            const saveFile = await saveFolder.createFile(fileName, { overwrite: true });
            await saveFile.write(arrayBuffer, { format: storage.formats.binary });
            continue;
          }

          const entryUrl = nativePath.startsWith("file://") ? nativePath : `file://${nativePath}`;
          const fileEntry = await localFileSystem.getEntryWithUrl(entryUrl);
          if (!fileEntry) {
            continue;
          }

          const resourceEntry = isResourceId(resourceId) ? resolveResource(resourceId) : undefined;
          const fallbackName =
            typeof resourceEntry?.originalMeta?.fileName === "string"
              ? String(resourceEntry.originalMeta.fileName)
              : fileEntry.name || `resource-${Date.now()}`;
          const arrayBuffer = await fileEntry.read({ format: storage.formats.binary });
          const saveFile = await saveFolder.createFile(fallbackName, { overwrite: true });
          await saveFile.write(arrayBuffer, { format: storage.formats.binary });
        } catch {
          // continue even if a single resource fails
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
