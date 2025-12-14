import { Buffer } from "buffer";
import { Jimp } from "jimp";

import { app } from "photoshop";
import {
  buildGetMaskParamsFromResources,
  getImage,
  getSelection,
  SpeicialIDManager
} from "../../../ps-adapter/index";
import { buildBoundaryUri, parseMaskResource } from "../../../resource-uris.js";
import { resolveResourceBuffer as resolveSharedResourceBuffer } from "../../image-holder.js";
import { getJimpForResource, storeJimpForResource } from "./jimp-holder.js";
import type { CreateByMaskParams, ImagingActionContext, MaterializedCbmPayload } from "./context.js";
import { actionErrorResult, createPerfTracker, normalizeMaskParams } from "./cbm-materializer.js";
import {
  decodeDataUrl,
  getEffectiveImageSize,
  normalizeUri,
  resolveBoundaryParam,
  resolveLayerIdentifyForMask
} from "./cbm-utils.js";
import { persistMaterializedPayload } from "./cbm-persist.js";

export function registerCreateByMaskAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;
  const mesh = mcpMesh as any;
  const materialize =
    context.materializers?.fromMask ??
    (async (params: CreateByMaskParams) => materializeMaskOnly(mesh, params));

  mcpMesh.implementAction("fileResource.createByMask", async (rawParams?: CreateByMaskParams) => {
    const actionLog = createPerfTracker("fileResource.createByMask.action");
    try {
      actionLog("start");
      const params = normalizeMaskParams(rawParams);
      const payload = await materialize(params);
      const response = await persistMaterializedPayload(payload);
      actionLog("completed", { width: response.width, height: response.height });
      if (response.resource && payload.image) {
        storeJimpForResource(response.resource, payload.image, payload.mime);
      }
      return response;
    } catch (error) {
      actionLog("failed", { message: (error as any)?.message });
      return actionErrorResult(error);
    }
  });
}

const PNG_MIME = "image/png";
const DATA_URL_REGEX = /^data:([^;,]+)?(;base64)?,(.*)$/i;

async function materializeMaskOnly(mesh: any, params: CreateByMaskParams): Promise<MaterializedCbmPayload> {
  const maskUri = normalizeUri(params.maskUri);
  if (!maskUri) {
    throw new Error("maskUri is required for fileResource.createByMask");
  }

  const boundaryUri = resolveCanvasBoundaryForMask(maskUri);

  const log = createPerfTracker("fileResource.createByMask.materialize");
  log("boundaryResolved", { boundaryUri: boundaryUri ?? null });

  const maskSnapshot = await loadMaskSnapshot(mesh, boundaryUri, maskUri, {
    maxSizeOverride: 0
  });
  if (!maskSnapshot) {
    throw new Error("Unable to resolve mask snapshot");
  }

  log("maskReady", {
    width: maskSnapshot.jimp.bitmap.width,
    height: maskSnapshot.jimp.bitmap.height
  });

  return {
    type: "mask",
    image: maskSnapshot.jimp,
    mime: PNG_MIME,
    meta: {
      sourceMaskUri: maskUri,
      maskReverse: maskSnapshot.reverse
    }
  };
}

type MaskSnapshotPayload = { jimp: Jimp; reverse?: boolean };

async function loadMaskSnapshot(
  mesh: any,
  boundaryUri: string | null,
  maskUri: string,
  options?: { maxSizeOverride?: number }
): Promise<MaskSnapshotPayload | null> {
  const log = createPerfTracker("fileResource.createByMask.loadMaskSnapshot");
  log("start", { boundaryUri, maskUri });
  const normalizedMaskUri = normalizeUri(maskUri);
  if (!normalizedMaskUri) {
    log("noMaskUri");
    return null;
  }

  if (normalizedMaskUri.startsWith("uxp://mask/")) {
    const parsedMask = parseMaskResource(normalizedMaskUri);
    const selectionEmpty =
      parsedMask.maskType === "selection" ? await isPhotoshopSelectionEmpty() : false;
    const fetchLog = createPerfTracker("fileResource.createByMask.getMaskSnapshot");
    const layerSnapshot = await loadMaskSnapshotJimp(mesh, boundaryUri, normalizedMaskUri, options);
    fetchLog("completed", {
      width: layerSnapshot.jimp.bitmap.width,
      height: layerSnapshot.jimp.bitmap.height
    });

    if (selectionEmpty) {
      const fallback = await createSolidMask(
        layerSnapshot.jimp.bitmap.width,
        layerSnapshot.jimp.bitmap.height
      );
      log("selectionEmptyFallback", {
        width: fallback.bitmap.width,
        height: fallback.bitmap.height,
        maskContent: parsedMask.maskType
      });
      return { jimp: fallback };
    }

    log("maskSnapshotReady", {
      width: layerSnapshot.jimp.bitmap.width,
      height: layerSnapshot.jimp.bitmap.height
    });
    return { jimp: layerSnapshot.jimp };
  }

  if (normalizedMaskUri.startsWith("uxp://file/")) {
    const normalized = normalizeFileResourceUri(normalizedMaskUri);
    const cached = getJimpForResource(normalized.resourceId);
    if (cached) {
      if (options?.maxSizeOverride) {
        scaleImageToMaxSize(cached.image, options.maxSizeOverride);
      }
      return {
        jimp: cached.image,
        reverse: normalized.reverse
      };
    }
    const { buffer } = await resolveSharedResourceBuffer(normalized.resourceId);
    const jimpImage = await Jimp.read(Buffer.from(buffer));
    if (options?.maxSizeOverride) {
      scaleImageToMaxSize(jimpImage, options.maxSizeOverride);
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
    const decoded = decodeDataUrl(normalizedMaskUri);
    const jimpImage = await Jimp.read(decoded.buffer);
    return { jimp: jimpImage };
  }

  log("unsupportedMaskUri", { maskUri: normalizedMaskUri });
  return null;
}

async function loadMaskSnapshotJimp(
  mesh: any,
  boundaryUri: string | null,
  maskUri: string,
  options?: { maxSizeOverride?: number }
): Promise<MaskSnapshotPayload> {
  const log = createPerfTracker("fileResource.createByMask.loadMaskSnapshotJimp");
  const effectiveBoundaryUri = boundaryUri ?? resolveCanvasBoundaryForMask(maskUri);
  if (!effectiveBoundaryUri) {
    throw new Error("Unable to resolve boundary for mask resource");
  }
  const built = buildGetMaskParamsFromResources(effectiveBoundaryUri, maskUri);
  const boundaryParam = await resolveBoundaryParam(built.boundary, built.layer_identify ?? null);
  const layerIdentify = resolveLayerIdentifyForMask(built.content, built.layer_identify ?? null);
  const effectiveImageSize = options?.maxSizeOverride ?? getEffectiveImageSize(mesh, built.imageSize);
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
        for (let i = 0; i < width * height; i += 1) {
          const idx = i * 4;
          const alpha = blob[i];
          if (idx + 3 < jimpImage.bitmap.data.length) {
            jimpImage.bitmap.data[idx + 3] = alpha;
          }
        }
      }
    } catch (error) {
      console.warn("[fileResource.createByMask] selection alpha failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    }

    jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (_x, _y, idx) => {
      const alpha = jimpImage.bitmap.data[idx + 3];
      const grayValue = built.reverse ? 255 - alpha : alpha;
      jimpImage.bitmap.data[idx + 0] = grayValue;
      jimpImage.bitmap.data[idx + 1] = grayValue;
      jimpImage.bitmap.data[idx + 2] = grayValue;
      jimpImage.bitmap.data[idx + 3] = 255 - grayValue;
    });
  }

  if (options?.maxSizeOverride) {
    scaleImageToMaxSize(jimpImage, options.maxSizeOverride);
  }
  log("completed", { width: jimpImage.bitmap.width, height: jimpImage.bitmap.height });
  return { jimp: jimpImage };
}

function resolveCanvasBoundaryForMask(maskUri: string): string | null {
  if (!maskUri) {
    return null;
  }
  try {
    const parsed = parseMaskResource(maskUri);
    return buildBoundaryUri(parsed.docId, "canvas");
  } catch {
    return null;
  }
}

function scaleImageToMaxSize(image: Jimp, maxSize: number) {
  if (!(maxSize > 0)) return;
  const maxSide = Math.max(image.bitmap.width, image.bitmap.height);
  if (maxSide <= maxSize) {
    return;
  }
  const scale = maxSize / maxSide;
  const targetWidth = Math.max(1, Math.round(image.bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(image.bitmap.height * scale));
  image.resize({
    w: targetWidth,
    h: targetHeight
  });
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
  } catch {
    return true;
  }
}

async function createSolidMask(width: number, height: number): Promise<Jimp> {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return new Jimp({ width: safeWidth, height: safeHeight, color: 0x00000000 });
}
