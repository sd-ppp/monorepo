import { Buffer } from "buffer";
import { storage } from "uxp";
import { Jimp, JimpMime } from "jimp";

import { createResource, updateResource } from "../../image-holder.js";
import { mimeFromExtension, normaliseExtension, isImageExtension, buildGenericFileThumbnail, buildVideoThumbnail, extensionFromMime } from "./helpers.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import type { ImagingActionContext, MaterializedPayload } from "./context.js";

interface CreateFromLocalParams {
  types?: Array<{ description?: string; extensions?: string[] }>;
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function isVideoExtension(extension?: string): boolean {
  const normalised = normaliseExtension(extension);
  if (!normalised) return false;
  return VIDEO_EXTENSIONS.includes(normalised);
}

function extensionFromName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return undefined;
  return normaliseExtension(name.slice(dot));
}

async function materializeViaSystemDialog(params: CreateFromLocalParams | undefined): Promise<MaterializedPayload> {
  const options = params?.types ? { types: params.types } : undefined;
  const file = await storage.localFileSystem.getFileForOpening(options as any).catch(() => undefined);
  if (!file) {
    throw new Error("cancelled");
  }
  const name = file.name ?? "local-file";
  const extension = extensionFromName(name);
  const mime = mimeFromExtension(extension);
  const arrayBuffer = await file.read({ format: storage.formats.binary });
  return {
    buffer: toUint8Array(arrayBuffer),
    mime,
    name,
    meta: {
      nativePath: file.nativePath
    }
  };
}

export function registerCreateFromLocalAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction(
    "fileResource.createFromLocal",
    async (params: CreateFromLocalParams = {}) => {
      try {
        const payload = context.materializers?.fromLocalFile
          ? await context.materializers.fromLocalFile(params)
          : await materializeViaSystemDialog(params);

        const buffer = toUint8Array(payload.buffer);
        let extension = extensionFromName(payload.name);
        if (!extension && payload.mime) {
          extension = extensionFromMime(payload.mime);
        }
        const mime = payload.mime ?? mimeFromExtension(extension);

        let thumbnailBase64: string | undefined = payload.thumbnail;
        let imgWidth = payload.width;
        let imgHeight = payload.height;

        if (!thumbnailBase64) {
          if (isImageExtension(extension)) {
            try {
              const image = await Jimp.read(Buffer.from(buffer));
              imgWidth = imgWidth ?? image.width;
              imgHeight = imgHeight ?? image.height;
              image.scaleToFit({ w: 320, h: 320 });
              const thumbnailBuffer = await image.getBuffer(JimpMime.png);
              thumbnailBase64 = "data:image/png;base64," + thumbnailBuffer.toString("base64");
            } catch {
              thumbnailBase64 = buildGenericFileThumbnail(extension ?? "");
            }
          } else if (isVideoExtension(extension)) {
            thumbnailBase64 = buildVideoThumbnail();
          } else {
            thumbnailBase64 = buildGenericFileThumbnail(extension ?? "");
          }
        }

        const resourceId = createResource({
          type: "file",
          data: {
            buffer,
            mime,
            path: payload.meta?.nativePath as string | undefined
          },
          originalMeta: {
            fileName: payload.name,
            width: imgWidth,
            height: imgHeight,
            ...payload.meta
          }
        });

        if (thumbnailBase64) {
          updateResource(resourceId, {
            thumbnailCache: {
              base64: thumbnailBase64,
              width: imgWidth,
              height: imgHeight,
              mime: "image/png",
              generatedAt: Date.now()
            }
          });
        }

        return {
          resource: resourceId,
          thumbnail: thumbnailBase64,
          width: imgWidth,
          height: imgHeight,
          mime
        };
      } catch (error: any) {
        const message = (error?.message || String(error)).toLowerCase();
        if (message.includes("cancel")) {
          return { error: "cancelled" };
        }
        return { error: error?.stack || error?.message || String(error) };
      }
    }
  );
}
