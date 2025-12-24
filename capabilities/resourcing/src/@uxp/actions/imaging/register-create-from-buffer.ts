import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";

import { createResource, updateResource } from "../../image-holder.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import type { ImagingActionContext } from "./context.js";
import {
  buildGenericFileThumbnail,
  buildVideoThumbnail,
  extensionFromMime,
  mimeFromExtension,
  isImageExtension,
  normaliseExtension
} from "./helpers.js";

interface CreateFromBufferFile {
  buffer: ArrayBuffer | ArrayBufferView | Uint8Array | string;
  name?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnail?: string | null;
  meta?: Record<string, unknown>;
}

interface CreateFromBufferParams {
  files?: CreateFromBufferFile[];
}

interface NormalisedBuffer {
  buffer: Uint8Array;
  mimeFromDataUrl?: string;
}

function toUint8Array(value: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(value);
}

function normaliseBuffer(source: CreateFromBufferFile["buffer"]): NormalisedBuffer {
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("data:")) {
      const match = trimmed.match(/^data:([^;,]*)(;base64)?,(.*)$/s);
      if (!match) {
        throw new Error("invalid-data-url");
      }
      const [, mime = "", base64Flag, data] = match;
      const payload = base64Flag ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
      return {
        buffer: new Uint8Array(payload),
        mimeFromDataUrl: mime || undefined
      };
    }
    try {
      const bin = Buffer.from(trimmed, "base64");
      if (!bin.length && trimmed.length) {
        const utf8 = Buffer.from(trimmed, "utf8");
        return { buffer: new Uint8Array(utf8) };
      }
      return { buffer: new Uint8Array(bin) };
    } catch {
      const fallback = Buffer.from(trimmed, "utf8");
      return { buffer: new Uint8Array(fallback) };
    }
  }

  if (source instanceof Uint8Array || ArrayBuffer.isView(source) || source instanceof ArrayBuffer) {
    return { buffer: toUint8Array(source) };
  }

  throw new Error("unsupported-buffer");
}

function extensionFromName(name?: string | null): string | undefined {
  if (!name) {
    return undefined;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return undefined;
  }
  const dot = trimmed.lastIndexOf(".");
  if (dot === -1) {
    return undefined;
  }
  return normaliseExtension(trimmed.slice(dot)) ?? undefined;
}

export function registerCreateFromBufferAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction("fileResource.createFromBuffer", async (params: CreateFromBufferParams = {}) => {
    try {
      const files = Array.isArray(params.files) ? params.files : [];
      if (!files.length) {
        throw new Error("no-buffer-payload");
      }

      const results: Array<{
        resource: string | null;
        width?: number | null;
        height?: number | null;
        mime?: string | null;
        error?: string;
      }> = [];

      for (const descriptor of files) {
        try {
          const { buffer: rawBuffer, mimeFromDataUrl } = normaliseBuffer(descriptor.buffer);
          const buffer = toUint8Array(rawBuffer);
          const rawName = typeof descriptor.name === "string" ? descriptor.name.trim() : "";
          const name = rawName.length ? rawName : undefined;
          let extension = extensionFromName(name);
          let mime = descriptor.mime ?? mimeFromDataUrl ?? (extension ? mimeFromExtension(extension) : undefined) ?? null;

          if (!extension && mime) {
            extension = extensionFromMime(mime);
          }

          const payloadMime = mime ?? "application/octet-stream";
          if (!extension && payloadMime && payloadMime !== "application/octet-stream") {
            extension = extensionFromMime(payloadMime) ?? extension;
          }

          let thumbnail = descriptor.thumbnail ?? undefined;
          let width = descriptor.width ?? undefined;
          let height = descriptor.height ?? undefined;

          if (!thumbnail) {
            if (extension && isImageExtension(extension)) {
              try {
                const image = await Jimp.read(Buffer.from(buffer));
                width = width ?? image.width;
                height = height ?? image.height;
              } catch {
                thumbnail = buildGenericFileThumbnail(extension);
              }
            } else if (extension && VIDEO_EXTENSIONS.includes(extension)) {
              thumbnail = buildVideoThumbnail();
            } else {
              thumbnail = buildGenericFileThumbnail(extension ?? "");
            }
          }

          if (!width || !height) {
            if (extension && isImageExtension(extension)) {
              try {
                const image = await Jimp.read(Buffer.from(buffer));
                width = width ?? image.width;
                height = height ?? image.height;
              } catch {
                // ignore failures, keep existing width/height
              }
            }
          }

          const originalMeta = descriptor.meta && typeof descriptor.meta === "object" ? descriptor.meta : undefined;

          const resourceId = createResource({
            type: "file",
            data: {
              buffer,
              mime: payloadMime
            },
            originalMeta: {
              fileName: name,
              width,
              height,
              ...(originalMeta ?? {})
            }
          });

          if (thumbnail) {
            updateResource(resourceId, {
              thumbnailCache: {
                base64: thumbnail,
                width,
                height,
                mime: "image/png",
                generatedAt: Date.now()
              }
            });
          }

          results.push({
            resource: resourceId,
            width: width ?? null,
            height: height ?? null,
            mime: payloadMime
          });
        } catch (fileError: any) {
          results.push({
            resource: null,
            error: fileError?.message || String(fileError)
          });
        }
      }

      const successful = results.filter(entry => entry.resource && !entry.error);
      if (!successful.length) {
        return results[0] ?? { resource: null, error: "no-successful-resource" };
      }

      const [primary, ...rest] = successful;
      if (!rest.length) {
        return primary;
      }

      return {
        ...primary,
        batch: successful
      };
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
  });
}
