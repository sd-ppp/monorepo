import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";

import { isResourceId } from "../../../resource-types.js";
import { getResourceThumbnail, resolveResource, resolveResourceBuffer, setResourceThumbnail } from "../../image-holder.js";
import type { ImagingActionContext } from "./context.js";
import { getJimpForResource } from "./jimp-holder.js";

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
        console.warn("[fileResource.thumbnail] resourceMissing", { resource });
        throw new Error("fileResource.thumbnail: resource not found");
      }

      const cached = getResourceThumbnail(resource);
      if (cached?.buffer || cached?.base64) {
        const base64 =
          cached.base64 ??
          ("data:" +
            (cached.mime ?? "image/png") +
            ";base64," +
            Buffer.from(cached.buffer ?? new Uint8Array()).toString("base64"));
        if (!cached.base64 && cached.buffer) {
          setResourceThumbnail(resource, {
            buffer: cached.buffer,
            width: cached.width,
            height: cached.height,
            originalWidth: cached.originalWidth,
            originalHeight: cached.originalHeight,
            mime: cached.mime
          });
        }
        return {
          thumbnail: base64,
          width: cached.originalWidth ?? cached.width,
          height: cached.originalHeight ?? cached.height
        };
      }

      const cachedJimp = getJimpForResource(resource);
      let image: Jimp | null = cachedJimp ? cachedJimp.image.clone() : null;
      if (!image) {
        const { buffer } = await resolveResourceBuffer(resource);
        image = await Jimp.read(Buffer.from(buffer)); 
      } else {
        console.info("[fileResource.thumbnail] usingJimpCache", {
          resource,
          width: image.bitmap.width,
          height: image.bitmap.height
        });
      }

      const origW = image.width;
      const origH = image.height;
      image.scaleToFit({ w: maxSize, h: maxSize });
      const thumbnailBuffer = await image.getBuffer(JimpMime.png);
      setResourceThumbnail(resource, {
        buffer: new Uint8Array(thumbnailBuffer),
        width: image.width,
        height: image.height,
        originalWidth: origW,
        originalHeight: origH,
        mime: "image/png"
      });
      const base64 = "data:image/png;base64," + Buffer.from(thumbnailBuffer).toString("base64");

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
