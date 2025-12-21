import { Buffer } from "buffer";
import { Jimp } from "jimp";
import { app } from "photoshop";

import {
  applyMaskToSnapshot,
  createSnapshot,
  cropSnapshot,
  ensurePositiveRect,
  type MaskSnapshot,
  type StageRect
} from "@sdppp/cbm-calculator";
import { sdpppX } from "@sdppp/ps-uxp/src/entry/sdpppX";
import { logger as sdpppLogger } from "@sdppp/ps-uxp/src/logger";
import {
  BoundaryRectUtils,
  buildGetImageParamsFromResources,
  buildGetMaskParamsFromResources,
  getDocumentInfo,
  getImage,
  getLayerInfo,
  getSelection,
  SpeicialIDManager,
  type BoundaryRect
} from "../../../ps-adapter/index";
import {
  buildBoundaryUri,
  extractDocIdFromUris,
  parseBoundaryResource,
  parseContentResource,
  parseMaskResource
} from "../../../resource-uris.js";
import {
  getResourceThumbnail,
  resolveResourceBuffer as resolveSharedResourceBuffer
} from "../../image-holder.js";
import type {
  CombineByCbmParams,
  CreateByContentParams,
  CreateByMaskParams,
  MaterializedCbmPayload
} from "./context.js";
import { getJimpForResource } from "./jimp-holder.js";

export const PNG_MIME = "image/png";
const DATA_URL_REGEX = /^data:([^;,]+)?(;base64)?,(.*)$/i;

const perfLogger = sdpppLogger.extend("perf");
const PERF_ALLOWED_REGEX = /^fileResource\.(createBy|createFrom|combineBy)[^.]+\.action$/;

const shouldLogPerf = (label: string): boolean => PERF_ALLOWED_REGEX.test(label);

export type CbmMaterializeRequest = {
  contentUri?: string;
  boundaryUri?: string;
  maskUri?: string | null;
  options?: Record<string, unknown>;
};

export interface MaskSnapshotPayload {
  jimp: Jimp;
  reverse?: boolean;
}

export type BoundaryFetchSpec = ReturnType<typeof buildGetImageParamsFromResources>["boundary"];

export const projectBoundaryRectFromResource = (
  boundaryUri: string,
  options?: { imageSizeOverride?: number | null }
): { docWidth: number; docHeight: number; cropRect: StageRect } | null => {
  try {
    const parsed = parseBoundaryResource(boundaryUri);
    if (typeof parsed.boundary === "string") {
      return null;
    }
    const rect = parsed.boundary;
    const docWidth = Math.round(rect.leftDistance + rect.width + rect.rightDistance);
    const docHeight = Math.round(rect.topDistance + rect.height + rect.bottomDistance);
    if (!(docWidth > 0 && docHeight > 0)) {
      console.warn("[createFromCBM] boundary projection invalid", {
        boundaryUri,
        docWidth,
        docHeight
      });
      return null;
    }
    const boundaryWidth = Math.max(1, Math.round(rect.width));
    const boundaryHeight = Math.max(1, Math.round(rect.height));
    const boundaryMaxSide = Math.max(boundaryWidth, boundaryHeight);
    const docMaxSide = Math.max(docWidth, docHeight);
    const override = options?.imageSizeOverride;
    const targetSize = override !== undefined ? override : parsed.imageSize;
    const maxTarget = targetSize && targetSize > 0 ? targetSize : docMaxSide;
    const scaleBase = boundaryMaxSide > 0 ? boundaryMaxSide : docMaxSide;
    const scale =
      scaleBase > 0 && maxTarget > 0 ? Math.min(1, maxTarget / scaleBase) : 1;
    const scaledDocWidth = Math.max(1, Math.round(docWidth * scale));
    const scaledDocHeight = Math.max(1, Math.round(docHeight * scale));
    const cropRect = ensurePositiveRect({
      x: Math.round(rect.leftDistance * scale),
      y: Math.round(rect.topDistance * scale),
      width: Math.max(1, Math.round(rect.width * scale)),
      height: Math.max(1, Math.round(rect.height * scale))
    });
    if (!(scaledDocWidth > 0 && scaledDocHeight > 0)) {
      console.warn("[createFromCBM] boundary projection scaled invalid", {
        boundaryUri,
        scaledDocWidth,
        scaledDocHeight
      });
      return null;
    }
    return {
      docWidth: scaledDocWidth,
      docHeight: scaledDocHeight,
      cropRect
    };
  } catch (error) {
    console.warn("[createFromCBM] boundary projection failed", {
      boundaryUri,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

interface ContentSnapshotPayload {
  jimp: Jimp;
}

interface LoadContentSnapshotOptions {
  boundaryOverride?: BoundaryFetchSpec;
  prebuiltParams?: ReturnType<typeof buildGetImageParamsFromResources>;
  skipBoundaryParam?: boolean;
  preferThumbnail?: boolean;
  maxSizeOverride?: number;
}

interface LoadMaskSnapshotOptions {
  boundaryOverride?: BoundaryFetchSpec;
  preferThumbnail?: boolean;
  maxSizeOverride?: number;
}

export function createPerfTracker(label: string): (stage: string, extra?: Record<string, unknown>) => void {
  if (!shouldLogPerf(label)) {
    return () => undefined;
  }
  const startedAt = Date.now();
  const logger = perfLogger.extend(label);
  return (stage: string, extra?: Record<string, unknown>) => {
    const elapsed = Date.now() - startedAt;
    if (extra) {
      logger(`${stage} +${elapsed}ms`, extra);
    } else {
      logger(`${stage} +${elapsed}ms`);
    }
  };
}

export function normalizeUri(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isCanvasMaskUri(value?: string | null): boolean {
  const normalized = normalizeUri(value);
  if (!normalized || !normalized.startsWith("uxp://mask/")) {
    return false;
  }
  try {
    const parsed = parseMaskResource(normalized);
    return parsed.content === "canvas";
  } catch {
    return false;
  }
}

function normalizeFileResourceUri(uri: string): { resourceId: string; reverse?: boolean } {
  try {
    const parsed = new URL(uri);
    const reverseParam = parsed.searchParams.get("reverse");
    const reverse =
      reverseParam === "1" || reverseParam?.trim().toLowerCase() === "true"
        ? true
        : reverseParam === "0"
          ? false
          : undefined;
    parsed.search = "";
    parsed.hash = "";
    return {
      resourceId: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
      reverse
    };
  } catch {
    return { resourceId: uri };
  }
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

const boundaryRectToSDPPP = (rect: BoundaryRect) => BoundaryRectUtils.toSDPPPBoundsAuto(rect);

async function isPhotoshopSelectionEmpty(): Promise<boolean> {
  try {
    const doc = app.activeDocument;
    if (!doc) return true;
    const selection = doc.selection;
    if (!selection) return true;

    const bounds = (selection as any).bounds;
    if (!bounds) {
      return true;
    }

    return false;
  } catch (error) {
    return true;
  }
}

export async function resolveEffectiveBoundaryUri(params: CbmMaterializeRequest): Promise<string> {
  const boundaryCandidate = normalizeUri(params.boundaryUri);
  if (boundaryCandidate) {
    return boundaryCandidate;
  }

  const contentUri = normalizeUri(params.contentUri);
  if (contentUri && !contentUri.startsWith("uxp://file/")) {
    const parsed = parseContentResource(contentUri);
    return buildBoundaryUri(parsed.docId, "canvas");
  }

  const maskUri = normalizeUri(params.maskUri);
  if (maskUri && maskUri.startsWith("uxp://mask/")) {
    const parsed = parseMaskResource(maskUri);
    return buildBoundaryUri(parsed.docId, "canvas");
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
        return boundaryRectToSDPPP(docInfo.document_boundary);
      }
      case "curlayer": {
        const layerInfo = await getLayerInfo({
          document_identify: documentIdentify,
          layer_identify: layerIdentify ?? SpeicialIDManager.get_SPECIAL_LAYER_SELECTED_LAYER()
        });
        return boundaryRectToSDPPP(layerInfo.boundary);
      }
      case "selection": {
        const docInfo = await getDocumentInfo({ document_identify: documentIdentify });
        const selectionRect = docInfo.selection_boundary ?? docInfo.document_boundary;
        return boundaryRectToSDPPP(selectionRect);
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

export async function loadMaskSnapshotForMaterializer(
  mesh: any,
  boundaryUri: string,
  maskUri: string | undefined | null,
  options?: LoadMaskSnapshotOptions
): Promise<MaskSnapshotPayload | null> {
  const log = createPerfTracker("loadMaskSnapshotForMaterializer");
  log("start", { boundaryUri, hasMaskUri: Boolean(maskUri) });
  const normalizedMaskUri = normalizeUri(maskUri);
  if (!normalizedMaskUri) {
    log("noMaskUri");
    console.warn("[createFromCBM] mask ignored: missing maskUri", { boundaryUri });
    return null;
  }

  if (normalizedMaskUri.startsWith("uxp://mask/")) {
    const parsedMask = parseMaskResource(normalizedMaskUri);
    if (parsedMask.maskType === "empty") {
      log("emptyMaskUri", { maskUri: normalizedMaskUri });
    }
    const selectionEmpty =
      parsedMask.maskType === "selection" ? await isPhotoshopSelectionEmpty() : false;
    log("maskUriDetected", {
      maskType: parsedMask.maskType,
      reverse: parsedMask.reverse
    });
    const fetchLog = createPerfTracker("loadMaskSnapshotForMaterializer.getJimpImage");
    const layerSnapshot = await loadMaskSnapshotJimp(mesh, boundaryUri, normalizedMaskUri, options);
    fetchLog("completed", {
      width: layerSnapshot.jimp.bitmap.width,
      height: layerSnapshot.jimp.bitmap.height
    });
    const width = layerSnapshot.jimp.bitmap.width;
    const height = layerSnapshot.jimp.bitmap.height;
    if (selectionEmpty) {
      const fallback = await createSolidMask(width, height);
      const parsedBoundary = parseBoundaryResource(boundaryUri);
      const boundaryType = typeof parsedBoundary.boundary === "string" ? parsedBoundary.boundary : "rect";
      log("selectionEmptyFallback", {
        width,
        height,
        boundaryType,
        docId: parsedBoundary.docId,
        maskType: parsedMask.maskType
      });
      console.warn("[createFromCBM] mask fallback due to empty selection", {
        boundaryUri,
        maskUri: normalizedMaskUri,
        maskContent: parsedMask.maskType
      });
      return {
        jimp: fallback
      };
    }

    log("maskSnapshotReady", { width, height });
    return { jimp: layerSnapshot.jimp };
  }

  if (normalizedMaskUri.startsWith("uxp://file/")) {
    const fetchLog = createPerfTracker("loadMaskSnapshotForMaterializer.resolveSharedBuffer");
    const normalized = normalizeFileResourceUri(normalizedMaskUri);
    const cached = getJimpForResource(normalized.resourceId);
    if (cached) {
      log("maskJimpCacheHit", {
        width: cached.image.bitmap.width,
        height: cached.image.bitmap.height
      });
      if (options?.maxSizeOverride) {
        resizeImageToMaxSize(cached.image, options.maxSizeOverride);
      }
      return {
        jimp: cached.image,
        reverse: normalized.reverse
      };
    }
    if (options?.preferThumbnail) {
      const cachedThumbnail = getResourceThumbnail(normalized.resourceId as any);
      if (cachedThumbnail?.buffer) {
        log("maskThumbnailHit", {
          width: cachedThumbnail.width,
          height: cachedThumbnail.height
        });
        const jimpImage = await Jimp.read(Buffer.from(cachedThumbnail.buffer));
        return {
          jimp: jimpImage,
          reverse: normalized.reverse
        };
      }
    }
    const { buffer } = await resolveSharedResourceBuffer(normalized.resourceId);
    const jimpImage = await Jimp.read(Buffer.from(buffer));
    if (options?.maxSizeOverride) {
      resizeImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    fetchLog("completed", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    const sample = Array.from(
      { length: Math.min(10, jimpImage.bitmap.width * jimpImage.bitmap.height) },
      (_unused, index) => {
        const idx = index * 4;
        return {
          r: jimpImage.bitmap.data[idx + 0],
          g: jimpImage.bitmap.data[idx + 1],
          b: jimpImage.bitmap.data[idx + 2],
          a: jimpImage.bitmap.data[idx + 3]
        };
      }
    );
    log("maskFileSample", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height,
      sample
    });
    if (jimpImage.bitmap.width <= 32 || jimpImage.bitmap.height <= 32) {
      console.warn("[createFromCBM] mask very small relative to boundary", {
        maskUri: normalizedMaskUri,
        width: jimpImage.bitmap.width,
        height: jimpImage.bitmap.height
      });
    }
    if (normalized.reverse !== undefined) {
      log("maskFileReverseDetected", { reverse: normalized.reverse });
    }
    return {
      jimp: jimpImage,
      reverse: normalized.reverse
    };
  }

  if (DATA_URL_REGEX.test(normalizedMaskUri)) {
    const fetchLog = createPerfTracker("loadMaskSnapshotForMaterializer.decodeDataUrl");
    const decoded = decodeDataUrl(normalizedMaskUri);
    const jimpImage = await Jimp.read(decoded.buffer);
    if (options?.maxSizeOverride) {
      resizeImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    fetchLog("completed", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return {
      jimp: jimpImage
    };
  }

  log("unsupportedMaskUri", { maskUri: normalizedMaskUri });
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

export async function loadContentSnapshotJimp(
  mesh: any,
  boundaryUri: string,
  contentUri: string,
  options?: LoadContentSnapshotOptions
): Promise<ContentSnapshotPayload> {
  const log = createPerfTracker("loadContentSnapshotJimp");
  log("start", { boundaryUri, contentUri });
  const normalizedContentUri = normalizeUri(contentUri);
  if (!normalizedContentUri) {
    throw new Error("contentUri is required for CBM materialization");
  }

  if (normalizedContentUri.startsWith("uxp://file/")) {
    const normalizedFile = normalizeFileResourceUri(normalizedContentUri);
    const cached = getJimpForResource(normalizedFile.resourceId);
    if (cached) {
      log("jimpCacheHit", {
        width: cached.image.bitmap.width,
        height: cached.image.bitmap.height
      });
      console.info("[fileResource.combineByCBM] loadContentSnapshotJimp cacheHit", {
        resourceId: normalizedFile.resourceId,
        width: cached.image.bitmap.width,
        height: cached.image.bitmap.height
      });
      if (options?.maxSizeOverride) {
        resizeImageToMaxSize(cached.image, options.maxSizeOverride);
      }
      return {
        jimp: cached.image
      };
    }
    if (options?.preferThumbnail) {
      const cachedThumbnail = getResourceThumbnail(normalizedFile.resourceId as any);
      if (cachedThumbnail?.buffer) {
        log("thumbnailHit", {
          width: cachedThumbnail.width,
          height: cachedThumbnail.height
        });
        const jimpImage = await Jimp.read(Buffer.from(cachedThumbnail.buffer));
        console.info("[fileResource.combineByCBM] loadContentSnapshotJimp thumbnailFallback", {
          resourceId: normalizedFile.resourceId,
          width: jimpImage.bitmap.width,
          height: jimpImage.bitmap.height
        });
        return {
          jimp: jimpImage
        };
      }
    }
    const fetchLog = createPerfTracker("loadContentSnapshotJimp.resolveSharedBuffer");
    const { buffer } = await resolveSharedResourceBuffer(normalizedFile.resourceId);
    const jimpImage = await Jimp.read(Buffer.from(buffer));
    console.info("[fileResource.combineByCBM] loadContentSnapshotJimp cacheMiss", {
      resourceId: normalizedFile.resourceId,
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    if (options?.maxSizeOverride) {
      resizeImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    fetchLog("completed", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return {
      jimp: jimpImage
    };
  }

  if (DATA_URL_REGEX.test(normalizedContentUri)) {
    const fetchLog = createPerfTracker("loadContentSnapshotJimp.decodeDataUrl");
    const decoded = decodeDataUrl(normalizedContentUri);
    const jimpImage = await Jimp.read(decoded.buffer);
    if (options?.maxSizeOverride) {
      resizeImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    fetchLog("completed", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return {
      jimp: jimpImage
    };
  }

  const built = options?.prebuiltParams ?? buildGetImageParamsFromResources(boundaryUri, normalizedContentUri);
  const boundarySpecForFetch = options?.boundaryOverride ?? built.boundary;
  const effectiveImageSize = options?.maxSizeOverride ?? getEffectiveImageSize(mesh, built.imageSize);
  const boundaryType = boundarySpecForFetch ? (typeof boundarySpecForFetch === "string" ? boundarySpecForFetch : "rect") : "none";
  log("paramsResolved", {
    imageSize: effectiveImageSize,
    boundaryType,
    skipBoundaryParam: Boolean(options?.skipBoundaryParam),
    preferThumbnail: Boolean(options?.preferThumbnail),
    content: built.content
  });
  const shouldSkipBoundary = Boolean(options?.skipBoundaryParam);
  const boundaryParam = !shouldSkipBoundary && boundarySpecForFetch
    ? await resolveBoundaryParam(boundarySpecForFetch, built.layer_identify ?? null)
    : undefined;
  const layerIdentify = resolveLayerIdentifyForContent(built.content, built.layer_identify ?? null);
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  const jimpImage = await getImage.getJimpImage({
    document_identify: documentIdentify,
    layer_identify: layerIdentify,
    boundary: boundaryParam,
    max_wh: effectiveImageSize,
    quality: built.imageQuality
  });
  log("jimpFetched", {
    width: jimpImage.bitmap.width,
    height: jimpImage.bitmap.height
  });

  if (built.content === "selection") {
    try {
      let selectionBoundaryParam = boundaryParam;
      if (!selectionBoundaryParam && boundarySpecForFetch) {
        selectionBoundaryParam = await resolveBoundaryParam(boundarySpecForFetch, built.layer_identify ?? null);
      }
      const selection = await getSelection({
        document_identify: documentIdentify,
        boundary: selectionBoundaryParam,
        max_wh: effectiveImageSize
      });
      const { blob, width, height } = selection;
      if (blob && blob.length === width * height) {
        let nonZero = 0;
        for (let i = 0; i < blob.length; i += 1) {
          if (blob[i] !== 0) {
            nonZero += 1;
          }
        }
        log("selectionBlobStats", {
          boundaryType,
          width,
          height,
          nonZero,
          total: blob.length,
          ratio: blob.length > 0 ? nonZero / blob.length : 0
        });
        for (let i = 0; i < width * height; i++) {
          const idx = i * 4;
          const alpha = blob[i];
          if (idx + 3 < jimpImage.bitmap.data.length) {
            jimpImage.bitmap.data[idx + 3] = alpha;
          }
        }
      }
      if ((!blob || blob.length !== width * height) && typeof console !== "undefined" && console.warn) {
        console.warn("[createFromCBM] selection blob size mismatch", {
          phase: "content",
          boundaryType,
          width,
          height,
          blobLength: blob?.length ?? null,
          expected: width * height
        });
      }
      log("selectionAlphaApplied");
    } catch {
      // ignore selection alpha errors
    }
  }
  log("completed");
  return {
    jimp: jimpImage
  };
}

async function loadMaskSnapshotJimp(
  mesh: any,
  boundaryUri: string,
  maskUri: string,
  options?: LoadMaskSnapshotOptions
) {
  const log = createPerfTracker("loadMaskSnapshotJimp");
  log("start", { boundaryUri, maskUri });
  const built = buildGetMaskParamsFromResources(boundaryUri, maskUri);
  const boundaryForFetch = options?.boundaryOverride ?? built.boundary;
  const effectiveImageSize = options?.maxSizeOverride ?? getEffectiveImageSize(mesh, built.imageSize);
  const boundaryType = typeof boundaryForFetch === "string" ? boundaryForFetch : "rect";
  log("paramsResolved", {
    imageSize: effectiveImageSize,
    maskType: built.maskType,
    reverse: built.reverse,
    boundaryType,
    preferThumbnail: Boolean(options?.preferThumbnail)
  });
  const boundaryParam = boundaryForFetch ? await resolveBoundaryParam(boundaryForFetch, built.layer_identify ?? null) : undefined;
  const layerIdentify = resolveLayerIdentifyForMask(built.content, built.layer_identify ?? null);
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  const jimpImage = await getImage.getJimpImage({
    document_identify: documentIdentify,
    layer_identify: layerIdentify,
    boundary: boundaryParam,
    max_wh: effectiveImageSize
  });
  log("jimpFetched", {
    width: jimpImage.bitmap.width,
    height: jimpImage.bitmap.height
  });

  if (built.content === "canvas") {
    log("canvasMaskFullCoverage", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (_x, _y, idx) => {
      jimpImage.bitmap.data[idx + 0] = 0;
      jimpImage.bitmap.data[idx + 1] = 0;
      jimpImage.bitmap.data[idx + 2] = 0;
      jimpImage.bitmap.data[idx + 3] = 0;
    });
  } else if (built.content === "empty") {
    log("emptyMaskNoCoverage", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (_x, _y, idx) => {
      jimpImage.bitmap.data[idx + 0] = 255;
      jimpImage.bitmap.data[idx + 1] = 255;
      jimpImage.bitmap.data[idx + 2] = 255;
      jimpImage.bitmap.data[idx + 3] = 255;
    });
  }

  if (built.content === "selection") {
    try {
      const selection = await getSelection({
        document_identify: documentIdentify,
        boundary: boundaryParam,
        max_wh: effectiveImageSize
      });
      const { blob, width, height } = selection;
      if (blob && blob.length === width * height) {
        let nonZero = 0;
        for (let i = 0; i < blob.length; i += 1) {
          if (blob[i] !== 0) {
            nonZero += 1;
          }
        }
        log("selectionBlobStats", {
          boundaryType,
          width,
          height,
          nonZero,
          total: blob.length,
          ratio: blob.length > 0 ? nonZero / blob.length : 0
        });
        for (let i = 0; i < width * height; i++) {
          const idx = i * 4;
          const alpha = blob[i];
          if (idx + 3 < jimpImage.bitmap.data.length) {
            jimpImage.bitmap.data[idx + 3] = alpha;
          }
        }
      }
      if ((!blob || blob.length !== width * height) && typeof console !== "undefined" && console.warn) {
        console.warn("[createFromCBM] selection blob size mismatch", {
          phase: "mask",
          boundaryType,
          width,
          height,
          blobLength: blob?.length ?? null,
          expected: width * height
        });
      }
      log("selectionAlphaApplied");
    } catch {
      // ignore selection alpha errors
    }

    // comfy 会将rgb为255的地方或者alpha为0的认为是遮罩
    jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (_x: number, _y: number, idx: number) => {
      const alpha = jimpImage.bitmap.data[idx + 3];
      const grayValue = built.reverse ? 255 - alpha : alpha;
      jimpImage.bitmap.data[idx + 0] = grayValue;
      jimpImage.bitmap.data[idx + 1] = grayValue;
      jimpImage.bitmap.data[idx + 2] = grayValue;
      jimpImage.bitmap.data[idx + 3] = 255 - grayValue;
    });

  }
  log("completed");
  return {
    jimp: jimpImage
  };
} 

function resizeImageToMaxSize(image: Jimp, maxSize?: number) {
  if (!(maxSize && maxSize > 0)) {
    return;
  }
  const maxSide = Math.max(image.bitmap.width, image.bitmap.height);
  if (maxSide <= maxSize) {
    return;
  }
  const scale = maxSize / maxSide;
  const targetWidth = Math.max(1, Math.round(image.bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(image.bitmap.height * scale));
  const beforeWidth = image.bitmap.width;
  const beforeHeight = image.bitmap.height;
  image.resize({
    w: targetWidth,
    h: targetHeight
  });
}

export async function materializeFromCBM(mesh: any, params: CbmMaterializeRequest): Promise<MaterializedCbmPayload> {
  const log = createPerfTracker("materializeFromCBM");
  log("start", {
    hasContent: Boolean(params.contentUri),
    hasMask: Boolean(params.maskUri),
    boundaryUri: params.boundaryUri
  });
  const contentUri = normalizeUri(params.contentUri);
  const maskUri = normalizeUri(params.maskUri);
  const maskIsCanvas = maskUri ? isCanvasMaskUri(maskUri) : false;
  const parsedMask = maskUri && maskUri.startsWith("uxp://mask/") ? parseMaskResource(maskUri) : null;
  const maskIsEmpty = parsedMask?.content === "empty";
  const maskIsFileResource = Boolean(maskUri && maskUri.startsWith("uxp://file/"));
  const contentIsFileResource = Boolean(contentUri && contentUri.startsWith("uxp://file/"));

  if (!contentUri && !maskUri) {
    throw new Error("contentUri or maskUri must be provided");
  }

  const boundaryUri = await resolveEffectiveBoundaryUri(params);
  log("boundaryResolved", { boundaryUri });
  const shouldDeferBoundaryCrop = Boolean(contentUri && boundaryUri && maskUri && !maskIsCanvas && !maskIsEmpty);
  const forceBoundaryCropFromFile = contentIsFileResource && Boolean(params.boundaryUri);
  const boundaryOverride: BoundaryFetchSpec | undefined = shouldDeferBoundaryCrop ? "canvas" : undefined;

  if (!contentUri && maskUri) {
    const maskLog = createPerfTracker("materializeFromCBM.maskOnly.load");
    const maskSnapshot = await loadMaskSnapshotForMaterializer(mesh, boundaryUri, maskUri);
    maskLog("completed", {
      hasSnapshot: Boolean(maskSnapshot),
      width: maskSnapshot?.jimp?.bitmap.width,
      height: maskSnapshot?.jimp?.bitmap.height
    });
    if (!maskSnapshot) {
      throw new Error("Unable to resolve mask snapshot");
    }
    log("maskOnlyReady", {
      width: maskSnapshot.jimp.bitmap.width,
      height: maskSnapshot.jimp.bitmap.height
    });
    return {
      type: "mask",
      image: maskSnapshot.jimp,
      mime: PNG_MIME,
      meta: {
        boundaryUri,
        sourceMaskUri: maskUri
      }
    };
  }

  if (!contentUri) {
    throw new Error("contentUri is required when maskUri is not provided");
  }

  const boundaryDetails = parseBoundaryResource(boundaryUri);
  const contentParams = contentIsFileResource
    ? {
        boundary: boundaryDetails.boundary,
        content: "canvas" as const,
        imageSize: boundaryDetails.imageSize ?? 0,
        imageQuality: boundaryDetails.imageQuality ?? 1,
        layer_identify: null
      }
    : buildGetImageParamsFromResources(boundaryUri, contentUri);
  const contentTimer = createPerfTracker("materializeFromCBM.content.load");
  const contentSnapshot = await loadContentSnapshotJimp(mesh, boundaryUri, contentUri, {
    boundaryOverride,
    prebuiltParams: contentParams
  });
  contentTimer("completed", {
    width: contentSnapshot.jimp.bitmap.width,
    height: contentSnapshot.jimp.bitmap.height
  });

  let snapshot = createSnapshot(contentSnapshot.jimp);
  const meta: Record<string, unknown> = {
    boundaryUri,
    contentUri
  };
  const projectedBoundary = projectBoundaryRectFromResource(boundaryUri);
  if (projectedBoundary && contentIsFileResource) {
    snapshot.image.resize({
      w: projectedBoundary.docWidth,
      h: projectedBoundary.docHeight
    });
    snapshot.rect = ensurePositiveRect({
      x: 0,
      y: 0,
      width: projectedBoundary.docWidth,
      height: projectedBoundary.docHeight
    });
  }

  if (maskUri && !maskIsCanvas && !maskIsEmpty) {
    const maskTimer = createPerfTracker("materializeFromCBM.mask.load");
    const maskSnapshot = await loadMaskSnapshotForMaterializer(
      mesh,
      boundaryUri,
      maskUri,
      boundaryOverride ? { boundaryOverride } : undefined
    );
    maskTimer("completed", {
      hasSnapshot: Boolean(maskSnapshot),
      width: maskSnapshot?.jimp?.bitmap.width,
      height: maskSnapshot?.jimp?.bitmap.height
    });
    if (!maskSnapshot) {
      throw new Error("Unable to resolve mask snapshot");
    }
    const normalizedMaskSnapshot: MaskSnapshot = {
      ...createSnapshot(maskSnapshot.jimp),
      maskRegion: null
    };
    if (projectedBoundary && maskIsFileResource) {
      normalizedMaskSnapshot.image.resize({
        w: projectedBoundary.docWidth,
        h: projectedBoundary.docHeight
      });
      normalizedMaskSnapshot.rect = ensurePositiveRect({
        x: 0,
        y: 0,
        width: projectedBoundary.docWidth,
        height: projectedBoundary.docHeight
      });
    }
    const invertSettingEnabled = Number(sdpppX["settings.imaging.applyMaskInvert"]) === 1;
    const reverseFlag = maskSnapshot.reverse === true;
    const invertMask = Boolean(invertSettingEnabled) !== reverseFlag;
    const applyTimer = createPerfTracker("materializeFromCBM.mask.apply");
    const applicationResult = await applyMaskToSnapshot(snapshot, {
      maskSnapshot: normalizedMaskSnapshot,
      invertMask
    });
    snapshot = applicationResult.snapshot;
    meta.maskApplied = maskUri;
    meta.maskStats = applicationResult.stats;
    if (maskSnapshot.reverse !== undefined) {
      meta.maskReverse = maskSnapshot.reverse;
    }
    applyTimer("completed");
  } else if (maskIsEmpty) {
    log("maskSkipped.empty", { maskUri });
  }

  if (projectedBoundary) {
    snapshot = await cropSnapshot(snapshot, projectedBoundary.cropRect);
    meta.boundaryDeferred = true;
  } else if (shouldDeferBoundaryCrop || forceBoundaryCropFromFile) {
    const boundaryType = typeof contentParams.boundary === "string" ? contentParams.boundary : "rect";
    if (boundaryType !== "canvas") {
      console.warn("[createFromCBM] boundary crop skipped: unsupported boundary", {
        boundaryUri,
        boundaryType
      });
    }
  }
  log("contentReady", { width: snapshot.image.bitmap.width, height: snapshot.image.bitmap.height });

  return {
    type: "image",
    image: snapshot.image,
    mime: PNG_MIME,
    meta
  };
}

export const normalizeContentParams = (params?: CreateByContentParams): CreateByContentParams => ({
  contentUri: params?.contentUri ?? "",
  options: params?.options
});

export const normalizeMaskParams = (params?: CreateByMaskParams): CreateByMaskParams => ({
  maskUri: params?.maskUri ?? "",
  options: params?.options
});

export const normalizeCombineParams = (params?: CombineByCbmParams): CombineByCbmParams => ({
  contentUri: params?.contentUri ?? "",
  boundaryUri: params?.boundaryUri ?? "",
  maskUri: params?.maskUri ?? undefined,
  thumbnail: params?.thumbnail ?? false,
  options: params?.options
});

export const actionErrorResult = (error: any) => ({
  error: error?.message || String(error)
});
