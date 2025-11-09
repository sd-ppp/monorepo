import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";

import { resolveResource, resolveResourceBuffer, updateResource } from "../../image-holder.js";
import { isResourceId } from "../../resource-types.js";
import type { ImagingActionContext } from "./context.js";

export function registerThumbnailAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("fileResource.thumbnail", async (params: { resource: string; maxSize?: number }) => {
    try {
      const { resource, maxSize = 192 } = params;
      if (typeof resource !== "string" || !resource.length) {
        throw new Error("fileResource.thumbnail: resource is required");
      }
      if (!isResourceId(resource)) {
        throw new Error("fileResource.thumbnail: invalid resource id");
      }

      const entry = resolveResource(resource);
      if (!entry) {
        throw new Error("fileResource.thumbnail: resource not found");
      }

      const cached = entry.thumbnailCache;
      if (cached?.base64) {
        return {
          thumbnail: cached.base64,
          width: cached.width,
          height: cached.height
        };
      }

      const { buffer } = await resolveResourceBuffer(resource);
      const image = await Jimp.read(Buffer.from(buffer));
      const origW = image.width;
      const origH = image.height;
      image.scaleToFit({ w: maxSize, h: maxSize });
      const thumbnailBuffer = await image.getBuffer(JimpMime.png);
      const base64 = "data:image/png;base64," + thumbnailBuffer.toString("base64");

      updateResource(resource, {
        thumbnailCache: {
          base64,
          width: image.width,
          height: image.height,
          mime: "image/png",
          generatedAt: Date.now()
        }
      });

      return {
        thumbnail: base64,
        width: origW,
        height: origH
      };
    } catch (error: any) {
      return { error: error?.message || String(error) };
    }
  });
}
