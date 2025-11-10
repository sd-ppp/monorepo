import { Buffer } from "buffer";
import { storage } from "uxp";
import { Jimp, JimpMime } from "jimp";
import { createResource, updateResource } from "../../image-holder.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import { buildGenericFileThumbnail, buildVideoThumbnail, extensionFromMime, mimeFromExtension, isImageExtension } from "./helpers.js";
export function registerCreateFromExternalAction(context) {
    const { mcpMesh } = context;
    mcpMesh.implementAction("fileResource.createFromExternal", async (params) => {
        try {
            const { url } = params;
            const localFileSystem = storage.localFileSystem;
            const tempFolder = await localFileSystem.getTemporaryFolder();
            let buffer;
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
            }
            else {
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
                }
                else {
                    mimeType = response.headers.get("content-type") || "application/octet-stream";
                }
            }
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const finalFilename = `downloaded_file_${timestamp}_${randomSuffix}${extension}`;
            const tempFile = await tempFolder.createFile(finalFilename, { overwrite: true });
            await tempFile.write(new Uint8Array(buffer), { format: storage.formats.binary });
            let thumbnailBase64;
            let imgWidth;
            let imgHeight;
            if (isImageExtension(extension) || isImageMime) {
                try {
                    const image = await Jimp.read(buffer);
                    imgWidth = image.width;
                    imgHeight = image.height;
                    image.scaleToFit({ w: 320, h: 320 });
                    const thumbnailBuffer = await image.getBuffer(JimpMime.png);
                    thumbnailBase64 = "data:image/png;base64," + thumbnailBuffer.toString("base64");
                }
                catch (error) {
                    thumbnailBase64 = buildGenericFileThumbnail(extension);
                }
            }
            else if (VIDEO_EXTENSIONS.includes(extension)) {
                thumbnailBase64 = buildVideoThumbnail();
            }
            else {
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
            updateResource(resourceId, {
                thumbnailCache: {
                    base64: thumbnailBase64,
                    width: imgWidth,
                    height: imgHeight,
                    mime: "image/png",
                    generatedAt: Date.now()
                }
            });
            return {
                resource: resourceId,
                thumbnail: thumbnailBase64,
                width: imgWidth,
                height: imgHeight,
                mimeType
            };
        }
        catch (error) {
            return { error: error?.stack || error?.message || String(error) };
        }
    });
}
//# sourceMappingURL=register-create-from-external.js.map