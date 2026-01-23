import { Buffer } from "buffer";
import { Jimp } from "jimp";

import { createSnapshot } from "@sdppp/cbm-calculator";
import { buildGetImageParamsFromResources, getImage, getSelection, SpeicialIDManager } from "../../../ps-adapter/index";
import { buildBoundaryUri, parseContentResource } from "../../../resource-uris.js";
import { resolveResourceBuffer as resolveSharedResourceBuffer } from "../../image-holder.js";
import { getJimpForResource, storeJimpForResource } from "./jimp-holder.js";
import type { CreateByContentParams, ImagingActionContext, MaterializedCbmPayload } from "./context.js";
import { actionErrorResult, createPerfTracker, normalizeContentParams } from "./cbm-materializer.js";
import {
  decodeDataUrl,
  getEffectiveImageSize,
  normalizeUri,
  resolveBoundaryParam,
  resolveLayerIdentifyForContent,
  type SdpppBoundary
} from "./cbm-utils.js";
import { persistMaterializedPayload } from "./cbm-persist.js";

export function registerCreateByContentAction(context: ImagingActionContext): void {
  const { mcpMesh } = context;
  const mesh = mcpMesh as any;
  const materialize =
    context.materializers?.fromContent ??
    (async (params: CreateByContentParams) => materializeContentOnly(mesh, params));

  mcpMesh.implementAction("fileResource.createByContent", async (rawParams?: CreateByContentParams) => {
    console.info("[fileResource.createByContent] invoked", rawParams);
    const actionLog = createPerfTracker("fileResource.createByContent.action");
    const start = Date.now();
    let last = start;
    const logStep = (label: string) => {
      const now = Date.now();
      console.info(`[fileResource.createByContent] ${label}`, {
        elapsedMs: now - last,
        totalMs: now - start
      });
      last = now;
    };
    try {
      actionLog("start");
      const params = normalizeContentParams(rawParams);
      logStep("normalizeContentParams");
      const payload = await materialize(params);
      logStep("materialize");
      const response = await persistMaterializedPayload(payload);
      logStep("persist");
      if (response.resource) {
        console.info("[fileResource.createByContent] resourceCreated", {
          resource: response.resource
        });
      }
      actionLog("completed", { width: response.width, height: response.height, totalMs: Date.now() - start });
      if (response.resource && payload.image) {
        storeJimpForResource(response.resource, payload.image, { mime: payload.mime });
        logStep("cache");
      }
      return response;
    } catch (error) {
      actionLog("failed", { message: (error as any)?.message, totalMs: Date.now() - start });
      console.info("[fileResource.createByContent] failed", {
        totalMs: Date.now() - start
      });
      return actionErrorResult(error);
    }
  });
}

const PNG_MIME = "image/png";
const DATA_URL_REGEX = /^data:([^;,]+)?(;base64)?,(.*)$/i;
async function materializeContentOnly(mesh: any, params: CreateByContentParams): Promise<MaterializedCbmPayload> {
  const contentUri = normalizeUri(params.contentUri);
  if (!contentUri) {
    throw new Error("contentUri is required for fileResource.createByContent");
  }

  const boundaryUri = resolveCanvasBoundaryForContent(contentUri);

  const log = createPerfTracker("fileResource.createByContent.materialize");
  log("boundaryResolved", { boundaryUri: boundaryUri ?? null });
  const contentSnapshot = await loadContentSnapshot(mesh, boundaryUri, contentUri, {
    maxSizeOverride: 0
  });
  log("snapshotLoaded", {
    width: contentSnapshot.jimp.bitmap.width,
    height: contentSnapshot.jimp.bitmap.height
  });

  let snapshot = createSnapshot(contentSnapshot.jimp);
  const meta: Record<string, unknown> = {
    contentUri
  };

  log("materialized", {
    width: snapshot.image.bitmap.width,
    height: snapshot.image.bitmap.height
  });

  return {
    type: "image",
    image: snapshot.image,
    mime: PNG_MIME,
    meta
  };
}

async function loadContentSnapshot(
  mesh: any,
  boundaryUri: string | null,
  contentUri: string,
  options?: { maxSizeOverride?: number }
): Promise<{ jimp: Jimp }> {
  const log = createPerfTracker("fileResource.createByContent.loadContentSnapshot");
  log("start", { boundaryUri, contentUri });
  const normalizedContentUri = normalizeUri(contentUri);
  if (!normalizedContentUri) {
    throw new Error("contentUri is required for snapshot loading");
  }

  if (normalizedContentUri.startsWith("uxp://file/")) {
    const cached = getJimpForResource(normalizedContentUri);
    if (cached) {
      if (options?.maxSizeOverride) {
        scaleImageToMaxSize(cached.image, options.maxSizeOverride);
      }
      return { jimp: cached.image };
    }
    const fetchLog = createPerfTracker("fileResource.createByContent.resolveSharedBuffer");
    const { buffer } = await resolveSharedResourceBuffer(normalizedContentUri);
    const jimpImage = await Jimp.read(Buffer.from(buffer));
    if (options?.maxSizeOverride) {
      scaleImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    fetchLog("completed", {
      width: jimpImage.bitmap.width,
      height: jimpImage.bitmap.height
    });
    return { jimp: jimpImage };
  }

  if (DATA_URL_REGEX.test(normalizedContentUri)) {
    const decoded = decodeDataUrl(normalizedContentUri);
    const jimpImage = await Jimp.read(decoded.buffer);
    if (options?.maxSizeOverride) {
      scaleImageToMaxSize(jimpImage, options.maxSizeOverride);
    }
    return { jimp: jimpImage };
  }

  if (!boundaryUri) {
    throw new Error("Unable to resolve boundary for content resource");
  }
  const built = buildGetImageParamsFromResources(boundaryUri, normalizedContentUri);
  const boundaryParam = await resolveBoundaryParam(built.boundary, built.layer_identify ?? null);
  const layerIdentify = resolveLayerIdentifyForContent(built.content, built.layer_identify ?? null);
  const effectiveImageSize = options?.maxSizeOverride ?? getEffectiveImageSize(mesh, built.imageSize);
  const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();

  const jimpImage = await getImage.getJimpImage({
    document_identify: documentIdentify,
    layer_identify: layerIdentify,
    boundary: boundaryParam,
    max_wh: effectiveImageSize,
    quality: built.imageQuality
  });

  if (built.content === "selection") {
    await applySelectionAlpha(jimpImage, boundaryParam, effectiveImageSize);
  }

  log("completed", { width: jimpImage.bitmap.width, height: jimpImage.bitmap.height });
  return { jimp: jimpImage };
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
  const beforeWidth = image.bitmap.width;
  const beforeHeight = image.bitmap.height;
  image.resize({
    w: targetWidth,
    h: targetHeight
  });
}

async function applySelectionAlpha(
  jimpImage: Jimp,
  boundaryParam: SdpppBoundary | undefined,
  effectiveImageSize: number
): Promise<void> {
  try {
    const documentIdentify = SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT();
    const selection = await getSelection({
      document_identify: documentIdentify,
      boundary: boundaryParam,
      max_wh: effectiveImageSize
    });
    const { blob, width, height } = selection;
    if (!blob || blob.length !== width * height) {
      console.warn("[fileResource.createByContent] selection blob mismatch", {
        width,
        height,
        blobLength: blob?.length ?? null
      });
      return;
    }
    for (let i = 0; i < width * height; i += 1) {
      const idx = i * 4;
      const alpha = blob[i];
      if (idx + 3 < jimpImage.bitmap.data.length) {
        jimpImage.bitmap.data[idx + 3] = alpha;
      }
    }
  } catch (error) {
    console.warn("[fileResource.createByContent] selection alpha failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function resolveCanvasBoundaryForContent(contentUri: string): string | null {
  if (!contentUri) {
    return null;
  }
  try {
    const parsed = parseContentResource(contentUri);
    return buildBoundaryUri(parsed.docId, "canvas");
  } catch {
    return null;
  }
}
