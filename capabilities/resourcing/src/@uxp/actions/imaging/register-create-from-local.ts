import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";
import { storage } from "uxp";

import { createResource, updateResource } from "../../image-holder.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import type { ImagingActionContext, MaterializedPayload } from "./context.js";
import { buildGenericFileThumbnail, buildVideoThumbnail, extensionFromMime, isImageExtension, mimeFromExtension, normaliseExtension } from "./helpers.js";

interface CreateFromLocalParams {
  multiple?: boolean;
  types?: Array<{ description?: string; extensions?: string[]; accept?: Record<string, unknown> }>;
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function isVideoExtension(extension?: string): boolean {
  const normalised = normaliseExtension(extension);
  if (!normalised) return false;
  return VIDEO_EXTENSIONS.includes(normalised);
}

function normalizeName(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === "undefined" || lower === "null") return undefined;
  return trimmed;
}

function normalizeExtensionValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normaliseExtension(value);
  if (!normalized) return undefined;
  if (normalized === ".undefined" || normalized === ".null") return undefined;
  return normalized;
}

function extensionFromName(name?: string | null): string | undefined {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;
  const dot = normalized.lastIndexOf(".");
  if (dot === -1) return undefined;
  return normalizeExtensionValue(normalized.slice(dot));
}

function normalizeNativePath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === "undefined" || lower === "null") {
    return undefined;
  }
  return trimmed;
}

function sanitizeAcceptRecord(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, string[]> = {};
  for (const [mime, extensions] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mime !== "string" || !Array.isArray(extensions)) continue;
    const sanitized = extensions
      .map(normalizeExtensionValue)
      .filter((ext): ext is string => Boolean(ext));
    if (!sanitized.length) continue;
    const trimmedMime = mime.trim();
    if (!trimmedMime) continue;
    result[trimmedMime] = sanitized;
  }
  return Object.keys(result).length ? result : undefined;
}

interface DescriptorValidationResult {
  extensions: Set<string>;
  accept: Record<string, string[]>;
  pickerTypes?: Array<{ description?: string; extensions: string[]; accept?: Record<string, string[]> }>;
}

async function materializeViaSystemDialog(params: CreateFromLocalParams | undefined): Promise<MaterializedPayload[]> {
  const pickerOptions: Record<string, unknown> = {
    allowMultiple: params?.multiple ?? false
  };

  const sanitizeTypes = (
    types?: Array<{ description?: string; extensions?: string[]; accept?: Record<string, unknown> }>
  ): DescriptorValidationResult => {
    const extensionsSet = new Set<string>();
    const acceptMap: Record<string, string[]> = {};

    if (!Array.isArray(types)) {
      return { extensions: extensionsSet, accept: acceptMap };
    }

    const pickerTypes = types
      .map(type => {
        if (!type || typeof type !== "object") return null;
        const description =
          typeof type.description === "string" && type.description.trim().length
            ? type.description.trim()
            : undefined;
        const extensions = Array.isArray(type.extensions)
          ? type.extensions.map(normalizeExtensionValue).filter((ext): ext is string => Boolean(ext))
          : [];
        const accept = sanitizeAcceptRecord(type.accept);
        if (!extensions.length && !accept) {
          return null;
        }
        extensions.forEach(ext => extensionsSet.add(ext));
        if (accept) {
          for (const [mime, extensionList] of Object.entries(accept)) {
            if (!acceptMap[mime]) {
              acceptMap[mime] = [...extensionList];
            } else {
              for (const ext of extensionList) {
                if (!acceptMap[mime].includes(ext)) {
                  acceptMap[mime].push(ext);
                }
              }
            }
          }
        }
        return {
          description,
          extensions,
          ...(accept ? { accept } : {}),
        };
      })
      .filter(
        (entry): entry is { description?: string; extensions: string[]; accept?: Record<string, string[]> } =>
          Boolean(entry)
      );

    return {
      extensions: extensionsSet,
      accept: acceptMap,
      pickerTypes: pickerTypes.length ? pickerTypes : undefined,
    };
  };

  const { extensions: allowedExtensions, pickerTypes } = sanitizeTypes(params?.types);
  const allowedExtensionsArray = Array.from(allowedExtensions);

  void pickerTypes;

  const entries = await storage.localFileSystem
    .getFileForOpening(pickerOptions as any)

  if (!entries) {
    throw new Error("cancelled");
  }

  const files = Array.isArray(entries) ? entries : [entries];
  if (!files.length) {
    throw new Error("cancelled");
  }

  return Promise.all(
    files.map(async file => {
      const name = normalizeName(file.name) ?? "local-file";
      const extension = extensionFromName(name);
      if (allowedExtensionsArray.length && (!extension || !allowedExtensions.has(extension))) {
        throw new Error(`Unsupported file type: ${extension ?? "unknown"}`);
      }
      const mime = mimeFromExtension(extension);
      const arrayBuffer = await file.read({ format: storage.formats.binary });
      return {
        buffer: toUint8Array(arrayBuffer),
        mime,
        name,
        meta: {
          nativePath: normalizeNativePath(file.nativePath)
        }
      };
    })
  );
}

export function registerCreateFromLocalAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction(
    "fileResource.createFromLocal",
    async (params: CreateFromLocalParams = {}) => {
      try {
        const payloads = await materializeViaSystemDialog(params);
        const results: Array<{
          resource: string | null;
          thumbnail?: string;
          width?: number;
          height?: number;
          mime?: string;
          nativePath?: string;
          error?: string;
        }> = [];

        for (const payload of payloads) {
          try {
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

            results.push({
              resource: resourceId,
              thumbnail: thumbnailBase64,
              width: imgWidth,
              height: imgHeight,
              mime,
              nativePath: normalizeNativePath(payload.meta?.nativePath)
            });
          } catch (fileError: any) {
            results.push({
              resource: null,
              error: fileError?.message || String(fileError),
              nativePath: normalizeNativePath(payload.meta?.nativePath)
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
        const message = (error?.message || String(error)).toLowerCase();
        if (message.includes("cancel")) {
          return { error: "cancelled" };
        }
        return { error: error?.stack || error?.message || String(error) };
      }
    }
  );
}
