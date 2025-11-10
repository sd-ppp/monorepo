import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";
import { storage } from "uxp";
import { createResource, updateResource } from "../../image-holder.js";
import { VIDEO_EXTENSIONS } from "./constants.js";
import { buildGenericFileThumbnail, buildVideoThumbnail, extensionFromMime, isImageExtension, mimeFromExtension, normaliseExtension } from "./helpers.js";
function toUint8Array(buffer) {
    return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
function isVideoExtension(extension) {
    const normalised = normaliseExtension(extension);
    if (!normalised)
        return false;
    return VIDEO_EXTENSIONS.includes(normalised);
}
function extensionFromName(name) {
    if (!name)
        return undefined;
    const dot = name.lastIndexOf(".");
    if (dot === -1)
        return undefined;
    return normaliseExtension(name.slice(dot));
}
async function materializeViaSystemDialog(params) {
    const pickerOptions = {
        allowMultiple: params?.multiple ?? false
    };
    if (params?.types) {
        pickerOptions.types = params.types;
    }
    const entries = await storage.localFileSystem
        .getFileForOpening(pickerOptions);
    if (!entries) {
        throw new Error("cancelled");
    }
    const files = Array.isArray(entries) ? entries : [entries];
    if (!files.length) {
        throw new Error("cancelled");
    }
    return Promise.all(files.map(async (file) => {
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
    }));
}
export function registerCreateFromLocalAction(context) {
    const { mcpMesh } = context;
    mcpMesh.implementAction("fileResource.createFromLocal", async (params = {}) => {
        try {
            const payloads = await materializeViaSystemDialog(params);
            const results = [];
            for (const payload of payloads) {
                try {
                    const buffer = toUint8Array(payload.buffer);
                    let extension = extensionFromName(payload.name);
                    if (!extension && payload.mime) {
                        extension = extensionFromMime(payload.mime);
                    }
                    const mime = payload.mime ?? mimeFromExtension(extension);
                    let thumbnailBase64 = payload.thumbnail;
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
                            }
                            catch {
                                thumbnailBase64 = buildGenericFileThumbnail(extension ?? "");
                            }
                        }
                        else if (isVideoExtension(extension)) {
                            thumbnailBase64 = buildVideoThumbnail();
                        }
                        else {
                            thumbnailBase64 = buildGenericFileThumbnail(extension ?? "");
                        }
                    }
                    const resourceId = createResource({
                        type: "file",
                        data: {
                            buffer,
                            mime,
                            path: payload.meta?.nativePath
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
                        mime
                    });
                }
                catch (fileError) {
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
        }
        catch (error) {
            const message = (error?.message || String(error)).toLowerCase();
            if (message.includes("cancel")) {
                return { error: "cancelled" };
            }
            return { error: error?.stack || error?.message || String(error) };
        }
    });
}
//# sourceMappingURL=register-create-from-local.js.map