import { createResource, updateResource } from "../../image-holder.js";
import type { ImagingActionContext } from "./context.js";

interface CreateFromCBMParams {
  contentUri?: string;
  boundaryUri?: string;
  maskUri?: string;
  options?: Record<string, unknown>;
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

export function registerCreateFromCBMAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction(
    "fileResource.createFromCBM",
    async (params: CreateFromCBMParams) => {
      try {
        const materializer = context.materializers?.fromCBM;
        if (!materializer) {
          return { error: "materializers.fromCBM is not provided" };
        }

        const result = await materializer(params);
        const buffer = toUint8Array(result.buffer);
        const resourceId = createResource({
          type: "file",
          data: {
            buffer,
            mime: result.mime
          },
          originalMeta: {
            width: result.width,
            height: result.height,
            ...result.meta
          }
        });

        const thumbnailBase64 = typeof result.thumbnail === "string"
          ? result.thumbnail
          : (result.meta as any)?.thumbnail;
        if (typeof thumbnailBase64 === "string") {
          updateResource(resourceId, {
            thumbnailCache: {
              base64: thumbnailBase64,
              width: result.width,
              height: result.height,
              mime: "image/png",
              generatedAt: Date.now()
            }
          });
        }

        return {
          resource: resourceId,
          width: result.width,
          height: result.height,
          mime: result.mime,
          thumbnail: typeof thumbnailBase64 === "string" ? thumbnailBase64 : undefined
        };
      } catch (error: any) {
        return { error: error?.stack || error?.message || String(error) };
      }
    }
  );
}
