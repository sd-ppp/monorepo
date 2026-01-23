import { Buffer } from "buffer";
import { storage } from "uxp";

import type { ResourceEntry, ResourceId, ResourceListing } from "../resource-types.js";
import { createResourceId, isResourceId } from "../resource-types.js";
import { clearJimpHolder, removeJimpForResource } from "./actions/imaging/jimp-holder.js";

const resourceMap = new Map<ResourceId, ResourceEntry>();
const legacyPromiseMap = new Map<string, Promise<{ file_buffer: Uint8Array; file_mimetype: string }>>();

function toUint8Array(data: any): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    const view: any = data;
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return Uint8Array.from(data);
  }
  if (typeof data === "string") {
    return new Uint8Array(Buffer.from(data, "base64"));
  }
  throw new Error("Unsupported buffer data");
}

export function createResource(entry: ResourceEntry): ResourceId {
  const id = createResourceId(entry.type);
  resourceMap.set(id, entry);
  return id;
}

export function resolveResource(resourceId: ResourceId): ResourceEntry | undefined {
  return resourceMap.get(resourceId);
}

export function updateResource(resourceId: ResourceId, entry: Partial<ResourceEntry>) {
  const existing = resourceMap.get(resourceId);
  if (!existing) return;
  resourceMap.set(resourceId, {
    ...existing,
    ...entry,
    data: {
      ...existing.data,
      ...(entry.data ?? {})
    },
    originalMeta: entry.originalMeta ?? existing.originalMeta,
    thumbnailCache: entry.thumbnailCache !== undefined ? entry.thumbnailCache : existing.thumbnailCache
  });
}

export function deleteResource(resourceId: ResourceId) {
  resourceMap.delete(resourceId);
  legacyPromiseMap.delete(resourceId);
  removeJimpForResource(resourceId);
}

export function clearResources() {
  resourceMap.clear();
  legacyPromiseMap.clear();
  clearJimpHolder();
}

export function listResources(): ResourceListing[] {
  return Array.from(resourceMap.entries()).map(([id, entry]) => ({ id, entry }));
}

export function addImageHolder(imagePromise: Promise<{ file_buffer: Uint8Array; file_mimetype: string }>): ResourceId {
  const id = createResource({
    type: "image",
    data: {},
    originalMeta: { legacy: true }
  });

  const wrappedPromise = Promise.resolve(imagePromise).then((result) => {
    updateResource(id, {
      data: {
        buffer: result.file_buffer,
        mime: result.file_mimetype
      }
    });
    return result;
  });

  legacyPromiseMap.set(id, wrappedPromise);
  return id;
}

export function getResourceThumbnail(resourceId: ResourceId) {
  const entry = resourceMap.get(resourceId);
  return entry?.thumbnailCache;
}

export function setResourceThumbnail(
  resourceId: ResourceId,
  thumbnail: {
    buffer: Uint8Array;
    width?: number;
    height?: number;
    originalWidth?: number;
    originalHeight?: number;
    mime?: string;
  }
) {
  const entry = resourceMap.get(resourceId);
  if (!entry) {
    throw new Error("Resource not found");
  }
  const normalized = toUint8Array(thumbnail.buffer);
  const mime = thumbnail.mime ?? "image/png";
  const base64 = "data:" + mime + ";base64," + Buffer.from(normalized).toString("base64");
  updateResource(resourceId, {
    thumbnailCache: {
      buffer: normalized,
      base64,
      width: thumbnail.width,
      height: thumbnail.height,
      originalWidth: thumbnail.originalWidth,
      originalHeight: thumbnail.originalHeight,
      mime,
      generatedAt: Date.now()
    }
  });
}

export function removeImageHolder(fileToken: string) {
  if (legacyPromiseMap.has(fileToken)) {
    legacyPromiseMap.delete(fileToken);
    return;
  }
  if (isResourceId(fileToken)) {
    deleteResource(fileToken);
  }
}

export async function getImageHolder(fileToken: string) {
  if (legacyPromiseMap.has(fileToken)) {
    return legacyPromiseMap.get(fileToken);
  }
  if (!isResourceId(fileToken)) {
    return undefined;
  }
  const entry = resolveResource(fileToken);
  if (!entry) return undefined;
  if (entry.data.buffer && entry.data.mime) {
    return {
      file_buffer: entry.data.buffer,
      file_mimetype: entry.data.mime
    };
  }
  return undefined;
}

async function readNativePath(nativePath: string): Promise<Uint8Array | undefined> {
  const localFileSystem = storage.localFileSystem;
  const tempFolder = await localFileSystem.getTemporaryFolder();

  try {
    if (nativePath.includes(tempFolder.nativePath)) {
      const relativePath = nativePath.replace(tempFolder.nativePath, "").replace(/^[\\/\\]/, "");
      const tempEntry = await tempFolder.getEntry(relativePath);
      const arrayBuffer = await tempEntry?.read({ format: storage.formats.binary });
      return arrayBuffer ? new Uint8Array(arrayBuffer) : undefined;
    }

    const url = nativePath.startsWith("file://") ? nativePath : `file://${nativePath}`;
    const fileEntry = await localFileSystem.getEntryWithUrl(url);
    const arrayBuffer = await fileEntry?.read({ format: storage.formats.binary });
    return arrayBuffer ? new Uint8Array(arrayBuffer) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveResourceBuffer(resourceOrToken: string): Promise<{ buffer: Uint8Array; mime?: string }> {
  const loadLegacy = async () => {
    const legacy = await getImageHolder(resourceOrToken);
    if (!legacy) {
      throw new Error("Resource not found");
    }
    return {
      buffer: toUint8Array(legacy.file_buffer),
      mime: legacy.file_mimetype
    };
  };

  if (!isResourceId(resourceOrToken)) {
    return loadLegacy();
  }

  const entry = resolveResource(resourceOrToken);
  if (!entry) {
    return loadLegacy();
  }

  if (entry.data.buffer) {
    const buffer = toUint8Array(entry.data.buffer);
    updateResource(resourceOrToken, {
      data: {
        ...entry.data,
        buffer
      }
    });
    return {
      buffer,
      mime: entry.data.mime
    };
  }

  if (entry.data.path) {
    const buffer = await readNativePath(String(entry.data.path));
    if (buffer) {
      updateResource(resourceOrToken, {
        data: {
          ...entry.data,
          buffer
        }
      });
      return {
        buffer,
        mime: entry.data.mime
      };
    }
  }

  return loadLegacy();
}

export async function ensureResourceTempFile(
  resourceOrToken: string,
  options?: { extensionHint?: string }
): Promise<string> {
  if (!isResourceId(resourceOrToken)) {
    throw new Error("ensureResourceTempFile expects a resource id");
  }

  const entry = resolveResource(resourceOrToken);
  if (!entry) {
    throw new Error("Resource not found");
  }

  if (entry.data.path) {
    return entry.data.path;
  }

  const { buffer, mime } = await resolveResourceBuffer(resourceOrToken);
  const localFileSystem = storage.localFileSystem;
  const tempFolder = await localFileSystem.getTemporaryFolder();

  const ext = (() => {
    if (entry.originalMeta?.fileName) {
      const name = String(entry.originalMeta.fileName);
      const idx = name.lastIndexOf(".");
      if (idx >= 0) {
        return name.substring(idx);
      }
    }
    if (options?.extensionHint) {
      return options.extensionHint.startsWith(".") ? options.extensionHint : `.${options.extensionHint}`;
    }
    if (mime) {
      const map: Record<string, string> = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
        "image/tiff": ".tif",
        "image/heic": ".heic"
      };
      if (map[mime]) {
        return map[mime];
      }
    }
    return ".bin";
  })();

  const fileName = `resource_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const tempFile = await tempFolder.createFile(fileName, { overwrite: true });
  await tempFile.write(new Uint8Array(buffer), { format: storage.formats.binary });

  updateResource(resourceOrToken, {
    data: {
      ...entry.data,
      path: tempFile.nativePath
    }
  });

  return tempFile.nativePath;
}

export type { ResourceEntry, ResourceListing, ResourceThumbnailCache, ResourceType };
