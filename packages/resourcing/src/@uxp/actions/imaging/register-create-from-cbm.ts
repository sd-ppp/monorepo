import { Buffer } from "buffer";
import { Jimp, JimpMime } from "jimp";
import { app } from "photoshop";

import { BoundaryRectUtils } from "@sdppp/mcp-mesh-photoshop/types/boundary.js";
import { SpeicialIDManager } from "@sdppp/ps-uxp/src/common/specialLayer";
import { sdpppX } from "@sdppp/ps-uxp/src/entry/sdpppX";
import getDocumentInfo from "@sdppp/ps-uxp/src/logics/mcp/plugin/tools/get_document_info";
import getImage from "@sdppp/ps-uxp/src/logics/mcp/plugin/tools/get_image_new";
import getLayerInfo from "@sdppp/ps-uxp/src/logics/mcp/plugin/tools/get_layer_info";
import getSelection from "@sdppp/ps-uxp/src/logics/mcp/plugin/tools/get_selection";
import {
  buildGetImageParamsFromResources,
  buildGetMaskParamsFromResources
} from "../../../../../../internals/ps-uxp/src/mesh/actions/photoshop-impls/getImage.helpers";
import { buildBoundaryUri, extractDocIdFromUris, parseContentResource, parseMaskResource } from "../../../resource-uris.js";
import {
  createResource,
  updateResource,
  resolveResourceBuffer as resolveSharedResourceBuffer
} from "../../image-holder.js";
import type { CreateFromCbmParams, ImagingActionContext, MaterializedCbmPayload } from "./context.js";

const PNG_MIME = "image/png";
const DATA_URL_REGEX = /^data:([^;,]+)?(;base64)?,(.*)$/i;

function logMaterializer(event: string, payload: Record<string, unknown> = {}): void {
  try {
    console.log("[createFromCBM]", event, JSON.stringify(payload));
  } catch {
    console.log("[createFromCBM]", event, payload);
  }
}

function normalizeUri(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mime?: string } {
  const match = DATA_URL_REGEX.exec(dataUrl);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const mime = match[1] ?? undefined;
  const isBase64 = !!match[2];
  const payload = match[3] ?? "";
  if (isBase64) {
    return { buffer: Buffer.from(payload, "base64"), mime };
  }
  return { buffer: Buffer.from(decodeURIComponent(payload), "utf8"), mime };
}

async function isPhotoshopSelectionEmpty(): Promise<boolean> {
  try {
    const doc = app.activeDocument;
    if (!doc) return true;
    const selection = doc.selection;
    if (!selection) return true;
    if (typeof (selection as any).isEmpty === "function") {
      return await (selection as any).isEmpty();
    }

    const bounds = (selection as any).bounds;
    if (!bounds || !Array.isArray(bounds) || bounds.length < 4) {
      return true;
    }

    const [left, top, right, bottom] = bounds;
    const leftVal = typeof left === "object" && left ? Number(left?.value ?? left) : Number(left);
    const topVal = typeof top === "object" && top ? Number(top?.value ?? top) : Number(top);
    const rightVal = typeof right === "object" && right ? Number(right?.value ?? right) : Number(right);
    const bottomVal = typeof bottom === "object" && bottom ? Number(bottom?.value ?? bottom) : Number(bottom);

    if ([leftVal, topVal, rightVal, bottomVal].some((value) => !Number.isFinite(value))) {
      return true;
    }

    const width = rightVal - leftVal;
    const height = bottomVal - topVal;
    return width <= 0 || height <= 0;
  } catch (error) {
    logMaterializer("selectionCheck.error", { message: error instanceof Error ? error.message : String(error) });
    return true;
  }
}

export async function resolveEffectiveBoundaryUri(params: CreateFromCbmParams): Promise<string> {
  const boundaryCandidate = normalizeUri(params.boundaryUri);
  if (boundaryCandidate) {
    return boundaryCandidate;
  }

  const contentUri = normalizeUri(params.contentUri);
  if (contentUri) {
    const parsed = parseContentResource(contentUri);
    const primitive = parsed.content === "selection" ? "selection" : parsed.content === "curlayer" ? "curlayer" : "canvas";
    return buildBoundaryUri(parsed.docId, primitive);
  }

  const maskUri = normalizeUri(params.maskUri);
  if (maskUri && maskUri.startsWith("uxp://mask/")) {
    const parsed = parseMaskResource(maskUri);
    const primitive = parsed.content === "selection" ? "selection" : parsed.content === "curlayer" ? "curlayer" : "canvas";
    return buildBoundaryUri(parsed.docId, primitive);
  }

  const docId = extractDocIdFromUris([boundaryCandidate, contentUri, maskUri]);
  if (docId != null) {
    return buildBoundaryUri(docId, "canvas");
  }

  throw new Error("Unable to resolve boundary for CBM materialization");
}

function getEffectiveImageSize(mesh: any, requested?: number): number {
  const activeNodeState = mesh?.getNode?.("uxp")?.store?.getState?.();
  const activeDocumentID = activeNodeState?.activeDocumentID;
  const meshState: any = mesh?.store?.getState?.() ?? {};
  const workBoundaryMaxSizes = (meshState as any)?.workBoundaryMaxSizes ?? {};
  const defaultSize = sdpppX["settings.imaging.defaultImagesSizeLimit"];

  if (requested && requested > 0) {
    return requested;
  }
  if (activeDocumentID != null && workBoundaryMaxSizes[activeDocumentID]) {
    return workBoundaryMaxSizes[activeDocumentID];
  }
  return defaultSize;
}

async function resolveBoundaryParam(
  boundary: ReturnType<typeof buildGetImageParamsFromResources>["boundary"],
  layerIdentify?: string | null
) {
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  if (typeof boundary === "string") {
    switch (boundary) {
      case "canvas": {
        const docInfo = await getDocumentInfo({ document_identify: documentIdentify });
        return docInfo.document_boundary;
      }
      case "curlayer": {
        const layerInfo = await getLayerInfo({
          document_identify: documentIdentify,
          layer_identify: layerIdentify ?? SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER()
        });
        return layerInfo.boundary;
      }
      case "selection": {
        const docInfo = await getDocumentInfo({ document_identify: documentIdentify });
        return docInfo.selection_boundary ?? docInfo.document_boundary;
      }
      default:
        throw new Error(`Unsupported boundary specification: ${boundary}`);
    }
  }

  const doc = app.activeDocument;
  if (!doc) {
    throw new Error("No active document to compute boundary rect.");
  }

  const docWidth = Number(doc.width);
  const docHeight = Number(doc.height);
  return BoundaryRectUtils.toSDPPPBounds(boundary, docWidth, docHeight);
}

function resolveLayerIdentifyForContent(
  content: ReturnType<typeof buildGetImageParamsFromResources>["content"],
  layerIdentify?: string | null
) {
  if (layerIdentify && layerIdentify.length > 0) {
    return layerIdentify;
  }
  switch (content) {
    case "canvas":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    case "curlayer":
      return SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER();
    case "selection":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    default:
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
  }
}

function resolveLayerIdentifyForMask(
  content: ReturnType<typeof buildGetMaskParamsFromResources>["content"],
  layerIdentify?: string | null
) {
  if (layerIdentify && layerIdentify.length > 0) {
    return layerIdentify;
  }
  switch (content) {
    case "canvas":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    case "curlayer":
      return SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER();
    case "selection":
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    default:
      return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
  }
}

async function buildThumbnailBase64(image: Jimp): Promise<string> {
  const clone = image.clone();
  clone.scaleToFit({ w: 320, h: 320 });
  const buffer = await clone.getBuffer(JimpMime.png);
  return "data:image/png;base64," + buffer.toString("base64");
}

function applyMaskToImage(image: Jimp, mask: Jimp): void {
  logMaterializer("applyMask.prepare", {
    imageWidth: image.bitmap.width,
    imageHeight: image.bitmap.height,
    maskWidth: mask.bitmap.width,
    maskHeight: mask.bitmap.height
  });

  if (mask.bitmap.width !== image.bitmap.width || mask.bitmap.height !== image.bitmap.height) {
    logMaterializer("applyMask.resizeNeeded", {
      fromWidth: mask.bitmap.width,
      fromHeight: mask.bitmap.height
    });
    mask = mask.clone().resize({
      w: image.bitmap.width,
      h: image.bitmap.height
    });
    logMaterializer("applyMask.resizeDone", {
      maskWidth: mask.bitmap.width,
      maskHeight: mask.bitmap.height
    });
  }

  const baseData = image.bitmap.data;
  const maskData = mask.bitmap.data;
  const width = Math.min(image.bitmap.width, mask.bitmap.width);
  const height = Math.min(image.bitmap.height, mask.bitmap.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const baseIdx = (y * image.bitmap.width + x) * 4;
      const maskIdx = (y * mask.bitmap.width + x) * 4;
      const alpha = maskData[maskIdx + 3];
      if (alpha <= 0) continue;
      const factor = Math.max(0, 1 - Math.min(1, alpha / 255));
      baseData[baseIdx + 3] = Math.round(baseData[baseIdx + 3] * factor);
    }
  }

  logMaterializer("applyMask.complete", {
    finalMaskWidth: mask.bitmap.width,
    finalMaskHeight: mask.bitmap.height
  });
}

async function loadMaskSnapshotForMaterializer(mesh: any, boundaryUri: string, maskUri: string | undefined | null) {
  const normalizedMaskUri = normalizeUri(maskUri);
  if (!normalizedMaskUri) {
    return null;
  }

  if (normalizedMaskUri.startsWith("uxp://mask/")) {
    logMaterializer("maskSnapshot.layer", { maskUri: normalizedMaskUri, boundaryUri });
    const parsedMask = parseMaskResource(normalizedMaskUri);
    const selectionEmpty = parsedMask.content === "selection" ? await isPhotoshopSelectionEmpty() : false;
    const layerSnapshot = await loadMaskSnapshotJimp(mesh, boundaryUri, normalizedMaskUri);
    const width = layerSnapshot.jimp.bitmap.width;
    const height = layerSnapshot.jimp.bitmap.height;
    if (selectionEmpty) {
      logMaterializer("maskSnapshot.layer.emptySelection", { width, height });
      const fallback = await createSolidMask(width, height);
      return {
        jimp: fallback,
        thumbnail: await buildThumbnailBase64(fallback)
      };
    }

    logMaterializer("maskSnapshot.layer.loaded", { width, height });
    return layerSnapshot;
  }

  if (normalizedMaskUri.startsWith("uxp://file/")) {
    logMaterializer("maskSnapshot.resource", { maskUri: normalizedMaskUri });
    const { buffer } = await resolveSharedResourceBuffer(normalizedMaskUri);
    logMaterializer("maskSnapshot.resource.buffer", {
      byteLength: buffer?.byteLength ?? buffer?.length ?? null
    });
    const jimpImage = await Jimp.read(Buffer.from(buffer));
    logMaterializer("maskSnapshot.resource.loaded", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return {
      jimp: jimpImage,
      thumbnail: await buildThumbnailBase64(jimpImage)
    };
  }

  if (DATA_URL_REGEX.test(normalizedMaskUri)) {
    logMaterializer("maskSnapshot.dataUrl", { maskUriLength: normalizedMaskUri.length });
    const decoded = decodeDataUrl(normalizedMaskUri);
    logMaterializer("maskSnapshot.dataUrl.decoded", {
      byteLength: decoded.buffer.byteLength,
      mime: decoded.mime
    });
    const jimpImage = await Jimp.read(decoded.buffer);
    logMaterializer("maskSnapshot.dataUrl.loaded", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return {
      jimp: jimpImage,
      thumbnail: await buildThumbnailBase64(jimpImage)
    };
  }

  logMaterializer("maskSnapshot.unsupported", { maskUri: normalizedMaskUri });
  return null;
}

async function createSolidMask(width: number, height: number): Promise<Jimp> {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return new Jimp({
    width: safeWidth,
    height: safeHeight,
    color: 0x00000000
  });
}

export async function loadContentSnapshotJimp(mesh: any, boundaryUri: string, contentUri: string) {
  const built = buildGetImageParamsFromResources(boundaryUri, contentUri);
  logMaterializer("contentSnapshot.buildParams", {
    boundary: built.boundary,
    content: built.content,
    imageSize: built.imageSize,
    imageQuality: built.imageQuality,
    layerIdentify: built.layer_identify
  });
  const effectiveImageSize = getEffectiveImageSize(mesh, built.imageSize);
  logMaterializer("contentSnapshot.effectiveSize", { effectiveImageSize });
  const boundaryParam = await resolveBoundaryParam(built.boundary, built.layer_identify ?? null);
  const layerIdentify = resolveLayerIdentifyForContent(built.content, built.layer_identify ?? null);
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  const jimpImage = await getImage.getJimpImage({
    document_identify: documentIdentify,
    layer_identify: layerIdentify,
    boundary: boundaryParam,
    max_wh: effectiveImageSize,
    quality: built.imageQuality
  });
  logMaterializer("contentSnapshot.loaded", {
    width: jimpImage.bitmap.width,
    height: jimpImage.bitmap.height
  });

  if (built.content === "selection") {
    try {
      const selection = await getSelection({
        document_identify: documentIdentify,
        boundary: boundaryParam,
        max_wh: effectiveImageSize
      });
      const { blob, width, height } = selection;
      if (blob && blob.length === width * height) {
        for (let i = 0; i < width * height; i++) {
          const idx = i * 4;
          const alpha = blob[i];
          if (idx + 3 < jimpImage.bitmap.data.length) {
            jimpImage.bitmap.data[idx + 3] = alpha;
          }
        }
      }
    } catch (error) {
      console.warn("[createFromCBM] Failed to apply selection alpha", error);
    }
  }

  return {
    jimp: jimpImage,
    thumbnail: await buildThumbnailBase64(jimpImage)
  };
}

export async function loadMaskSnapshotJimp(mesh: any, boundaryUri: string, maskUri: string) {
  const built = buildGetMaskParamsFromResources(boundaryUri, maskUri);
  logMaterializer("maskSnapshot.buildParams", {
    boundary: built.boundary,
    content: built.content,
    imageSize: built.imageSize,
    reverse: built.reverse,
    layerIdentify: built.layer_identify
  });
  const effectiveImageSize = getEffectiveImageSize(mesh, built.imageSize);
  logMaterializer("maskSnapshot.effectiveSize", { effectiveImageSize });
  const boundaryParam = await resolveBoundaryParam(built.boundary, built.layer_identify ?? null);
  const layerIdentify = resolveLayerIdentifyForMask(built.content, built.layer_identify ?? null);
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  const jimpImage = await getImage.getJimpImage({
    document_identify: documentIdentify,
    layer_identify: layerIdentify,
    boundary: boundaryParam,
    max_wh: effectiveImageSize
  });

  if (built.content === "selection") {
    try {
      const selection = await getSelection({
        document_identify: documentIdentify,
        boundary: boundaryParam,
        max_wh: effectiveImageSize
      });
      const { blob, width, height } = selection;
      if (blob && blob.length === width * height) {
        for (let i = 0; i < width * height; i++) {
          const idx = i * 4;
          const alpha = blob[i];
          if (idx + 3 < jimpImage.bitmap.data.length) {
            jimpImage.bitmap.data[idx + 3] = alpha;
          }
        }
      }
    } catch (error) {
      console.warn("[createFromCBM] Failed to apply selection alpha to mask", error);
    }
  }

  jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (_x: number, _y: number, idx: number) => {
    const alpha = jimpImage.bitmap.data[idx + 3];
    const grayValue = built.reverse ? 255 - alpha : alpha;
    jimpImage.bitmap.data[idx + 0] = grayValue;
    jimpImage.bitmap.data[idx + 1] = grayValue;
    jimpImage.bitmap.data[idx + 2] = grayValue;
    jimpImage.bitmap.data[idx + 3] = grayValue;
  });

  logMaterializer("maskSnapshot.layer.snapshotReady", {
    width: jimpImage.bitmap.width,
    height: jimpImage.bitmap.height
  });

  return {
    jimp: jimpImage,
    thumbnail: await buildThumbnailBase64(jimpImage)
  };
}

async function materializeFromCBM(mesh: any, params: CreateFromCbmParams): Promise<MaterializedCbmPayload> {
  logMaterializer("start", {
    hasContent: !!params.contentUri,
    hasMask: !!params.maskUri,
    boundaryUri: params.boundaryUri
  });

  const contentUri = normalizeUri(params.contentUri);
  const maskUri = normalizeUri(params.maskUri);

  if (!contentUri && !maskUri) {
    logMaterializer("errorMissingUris");
    throw new Error("contentUri or maskUri must be provided");
  }

  const boundaryUri = await resolveEffectiveBoundaryUri(params);
  logMaterializer("boundaryResolved", { boundaryUri });

  if (!contentUri && maskUri) {
    const maskSnapshot = await loadMaskSnapshotForMaterializer(mesh, boundaryUri, maskUri);
    if (!maskSnapshot) {
      logMaterializer("maskSnapshotMissing", { maskUri });
      throw new Error("Unable to resolve mask snapshot");
    }
    logMaterializer("materializeMask", {
      width: maskSnapshot.jimp.bitmap.width,
      height: maskSnapshot.jimp.bitmap.height
    });
    return {
      type: "mask",
      image: maskSnapshot.jimp,
      thumbnail: maskSnapshot.thumbnail,
      mime: PNG_MIME,
      meta: {
        boundaryUri,
        sourceMaskUri: maskUri
      }
    };
  }

  if (!contentUri) {
    logMaterializer("errorMissingContent", { maskUri });
    throw new Error("contentUri is required when maskUri is not provided");
  }

  const contentSnapshot = await loadContentSnapshotJimp(mesh, boundaryUri, contentUri);
  logMaterializer("contentSnapshot", {
    width: contentSnapshot.jimp.bitmap.width,
    height: contentSnapshot.jimp.bitmap.height,
    boundaryUri,
    contentUri
  });

  const image = contentSnapshot.jimp;
  let thumbnail = contentSnapshot.thumbnail;
  const meta: Record<string, unknown> = {
    boundaryUri,
    contentUri
  };

  if (maskUri) {
    const maskSnapshot = await loadMaskSnapshotForMaterializer(mesh, boundaryUri, maskUri);
    if (!maskSnapshot) {
      logMaterializer("maskSnapshotMissing", { maskUri });
      throw new Error("Unable to resolve mask snapshot");
    }
    logMaterializer("applyMask", {
      maskWidth: maskSnapshot.jimp.bitmap.width,
      maskHeight: maskSnapshot.jimp.bitmap.height
    });
    applyMaskToImage(image, maskSnapshot.jimp);
    thumbnail = await buildThumbnailBase64(image);
    meta.maskApplied = maskUri;
  }

  logMaterializer("success", {
    width: image.bitmap.width,
    height: image.bitmap.height,
    hasMask: !!maskUri
  });

  return {
    type: "image",
    image,
    thumbnail,
    mime: PNG_MIME,
    meta
  };
}

function ensureParams(params?: CreateFromCbmParams): CreateFromCbmParams {
  if (!params) {
    return {};
  }
  return params;
}

export function registerCreateFromCBMAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;
  const mesh = mcpMesh as any;

  mcpMesh.implementAction("fileResource.createFromCBM", async (rawParams: CreateFromCbmParams = {}) => {
    try {
      try {
        console.log("[createFromCBM] invoke", JSON.stringify(rawParams));
      } catch {
        console.log("[createFromCBM] invoke", rawParams);
      }

      const params = ensureParams(rawParams);
      const materialized = await materializeFromCBM(mesh, params);
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
          : await buildThumbnailBase64(image);

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
  });
}
