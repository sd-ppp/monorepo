import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";
import { storage } from "uxp";

import { createResource, updateResource } from "../../image-holder.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import type { ImagingActionContext } from "./context.js";
import {
  buildGenericFileThumbnail,
  buildVideoThumbnail,
  extensionFromMime,
  isImageExtension,
  mimeFromExtension
} from "./helpers.js";

const DEFAULT_FILE_PREFIX = "downloaded_file";

function sanitizeFileName(input: string | undefined): string {
  if (!input) {
    return DEFAULT_FILE_PREFIX;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return DEFAULT_FILE_PREFIX;
  }
  const withoutExtension = trimmed.includes(".")
    ? trimmed.slice(0, trimmed.lastIndexOf("."))
    : trimmed;
  // Replace unsupported characters and collapse duplicates.
  const sanitized = withoutExtension
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  return sanitized || DEFAULT_FILE_PREFIX;
}

export function registerCreateFromExternalAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;

  mcpMesh.implementAction(
    "fileResource.createFromExternal",
    async (params: { url: string; fileName?: string }) => {
    try {
      const { url, fileName } = params;
      const localFileSystem = storage.localFileSystem;
      const tempFolder = await localFileSystem.getTemporaryFolder();

      let buffer: Buffer;
      let extension = ".png";
      let mimeType = "application/octet-stream";
      let isImageMime = false;

      if (url.startsWith("data:")) {
        const match = url.match(/^data:([^;]+)(;base64)?,(.*)$/);
        if (!match) {
          throw new Error("Invalid data URL");
        }
        const mime = match[1].toLowerCase();
        const isBase64 = !!match[2];
        const dataPart = match[3];
        const inferredExt = extensionFromMime(mime) ?? ".png";
        extension = inferredExt;
        isImageMime = mime.startsWith("image/");
        mimeType = mime;
        buffer = isBase64 ? Buffer.from(dataPart, "base64") : Buffer.from(decodeURIComponent(dataPart), "utf8");
      } else {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const lastDotIndex = pathname.lastIndexOf(".");
        extension = lastDotIndex > -1 ? pathname.substring(lastDotIndex).toLowerCase() : ".png";
        const filename = urlObj.searchParams.get("filename");
        if (filename) {
          const filenameDotIndex = filename.lastIndexOf(".");
          if (filenameDotIndex > -1) {
            extension = filename.substring(filenameDotIndex).toLowerCase();
          }
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        isImageMime = isImageExtension(extension);
        if (isImageMime) {
          mimeType = mimeFromExtension(extension);
        } else {
          mimeType = response.headers.get("content-type") || "application/octet-stream";
        }
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const sanitizedBase = sanitizeFileName(fileName);
      const finalFilename = `${sanitizedBase}_${timestamp}_${randomSuffix}${extension}`;
      const tempFile = await tempFolder.createFile(finalFilename, { overwrite: true });
      await tempFile.write(new Uint8Array(buffer), { format: storage.formats.binary });

      let thumbnailBase64: string | undefined;
      let imgWidth: number | undefined;
      let imgHeight: number | undefined;

      if (isImageExtension(extension) || isImageMime) {
        try {
          const image = await Jimp.read(buffer);
          imgWidth = image.width;
          imgHeight = image.height;
        } catch (error) {
          thumbnailBase64 = buildGenericFileThumbnail(extension);
        }
      } else if (VIDEO_EXTENSIONS.includes(extension)) {
        thumbnailBase64 = buildVideoThumbnail();
      } else {
        thumbnailBase64 = buildGenericFileThumbnail(extension);
      }

      const resourceId = createResource({
        type: "file",
        data: {
          buffer: new Uint8Array(buffer),
          mime: mimeType,
          path: tempFile.nativePath
        },
        originalMeta: {
          url,
          fileName: finalFilename,
          width: imgWidth,
          height: imgHeight,
          extension
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
        width: imgWidth,
        height: imgHeight,
        mimeType
      };
    } catch (error: any) {
      return { error: error?.stack || error?.message || String(error) };
    }
    }
  );
}
