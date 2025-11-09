import { Buffer } from "buffer";
import { JimpMime } from "jimp";

import {
  createResource,
  updateResource
} from "../../image-holder.js";
import type {
  CreateFromCbmParams,
  ImagingActionContext,
  MaterializedCbmPayload
} from "./context.js";

const PNG_MIME = "image/png";

async function buildThumbnail(image: MaterializedCbmPayload["image"]): Promise<string> {
  const clone = image.clone();
  clone.scaleToFit({ w: 320, h: 320 });
  const buffer = await clone.getBuffer(JimpMime.png);
  return "data:image/png;base64," + Buffer.from(buffer).toString("base64");
}

function ensureParams(params?: CreateFromCbmParams): CreateFromCbmParams {
  if (!params) {
    return {};
  }
  return params;
}

export function registerCreateFromCBMAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction(
    "fileResource.createFromCBM",
    async (rawParams: CreateFromCbmParams) => {
      try {
        try {
          console.log("[createFromCBM] invoke", JSON.stringify(rawParams));
        } catch {
          console.log("[createFromCBM] invoke", rawParams);
        }
        const materializer = context.materializers?.fromCBM;
        if (!materializer) {
          return { error: "materializers.fromCBM is not provided" };
        }

        const params = ensureParams(rawParams);
        const materialized = await materializer(params);
        if (!materialized?.image) {
          throw new Error("fromCBM returned empty image payload");
        }

        const image = materialized.image;
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const mime = materialized.mime ?? PNG_MIME;
        const pngBuffer = await image.getBuffer(JimpMime.png);

        const resourceId = createResource({
          type: "file",
          data: {
            buffer: new Uint8Array(pngBuffer),
            mime
          },
          originalMeta: {
            width,
            height,
            ...(materialized.meta ?? {})
          }
        });

        const thumbnail =
          typeof materialized.thumbnail === "string"
            ? materialized.thumbnail
            : await buildThumbnail(image);

        updateResource(resourceId, {
          thumbnailCache: {
            base64: thumbnail,
            width,
            height,
            mime: PNG_MIME,
            generatedAt: Date.now()
          }
        });

        const response = {
          resource: resourceId,
          thumbnail,
          width,
          height,
          mime
        };
        try {
          console.log(
            "[createFromCBM] response",
            JSON.stringify({
              resource: resourceId,
              width,
              height,
              hasThumbnail: typeof thumbnail === "string"
            })
          );
        } catch {
          console.log("[createFromCBM] response", {
            resource: resourceId,
            width,
            height,
            hasThumbnail: typeof thumbnail === "string"
          });
        }
        return response;
      } catch (error: any) {
        try {
          console.error("[createFromCBM] error", error);
        } catch {}
        return {
          error: error?.message || String(error)
        };
      }
    }
  );
}
